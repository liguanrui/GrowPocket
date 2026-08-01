package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"strings"
)

// GrowthStoryService 成长故事服务（v3）
type GrowthStoryService struct {
	aiService     *AIService
	ability        *AbilityService
	cycleService   *GrowthCycleService
	questionnaire  *QuestionnaireService
}

// NewGrowthStoryService 创建成长故事服务实例
func NewGrowthStoryService(aiService *AIService) *GrowthStoryService {
	return &GrowthStoryService{
		aiService:     aiService,
		ability:       NewAbilityService(),
		cycleService:  NewGrowthCycleService(),
		questionnaire: NewQuestionnaireService(),
	}
}

// aiStoryResult AI 返回的成长故事结构
type aiStoryResult struct {
	Title          string `json:"title"`
	Content        string `json:"content"`
	AbilitySummary string `json:"ability_summary"`
}

// GenerateStory 为指定周期生成阶段成长故事
func (s *GrowthStoryService) GenerateStory(cycleID, familyID, childID uint, childName string) (*model.GrowthStory, error) {
	// 0. 幂等检查：若该周期已有故事记录，直接返回（防止重复生成）
	var existing model.GrowthStory
	if err := database.DB.Where("cycle_id = ?", cycleID).First(&existing).Error; err == nil {
		log.Printf("[GrowthStory] 周期 %d 已有故事记录 story=%d，返回已有故事", cycleID, existing.ID)
		return &existing, nil
	}

	// 1. 查询周期并校验权限
	var cycle model.GrowthCycle
	if err := database.DB.First(&cycle, cycleID).Error; err != nil {
		return nil, errors.New("周期不存在")
	}
	if cycle.FamilyID != familyID || cycle.ChildID != childID {
		return nil, errors.New("周期与儿童不匹配")
	}
	// 1.1 状态校验 & 自动恢复：
	// - active：正常生成
	// - reviewing：上次生成过程崩溃/中断的遗留状态（因断电/重启/Panic 导致 defer 未执行）
	//             若无故事记录，自动恢复为 active 后继续生成（幂等检查已确认无故事）
	// - completed：拒绝（已生成过故事，不应再走 GenerateStory）
	switch cycle.Status {
	case "active":
		// OK, 正常流程
	case "reviewing":
		log.Printf("[GrowthStory] 周期 %d 状态为 reviewing（疑似崩溃遗留），自动恢复为 active", cycleID)
		cycle.Status = "active"
		if err := database.DB.Save(&cycle).Error; err != nil {
			log.Printf("[GrowthStory] 周期 %d 状态恢复失败: %v", cycleID, err)
		}
	case "completed":
		return nil, errors.New("该周期已完成阶段回顾，如需重新生成请联系管理员")
	default:
		return nil, fmt.Errorf("周期状态异常：%s", cycle.Status)
	}

	// 1.5 并发保护：立即将周期状态改为 reviewing，防止并发请求重复生成
	cycle.Status = "reviewing"
	if err := database.DB.Save(&cycle).Error; err != nil {
		return nil, errors.New("周期状态更新失败，请稍后重试")
	}
	// 生成失败时恢复状态（defer）
	// 注意：若进程在此之后、completed 之前崩溃/重启，defer 不会执行，
	// 周期会残留 reviewing 状态 → 由下次调用的 1.1 自动恢复逻辑兜底修复
	generationFailed := true
	defer func() {
		if generationFailed {
			cycle.Status = "active"
			if err := database.DB.Save(&cycle).Error; err != nil {
				log.Printf("[GrowthStory] 周期 %d 状态回滚为 active 失败: %v", cycleID, err)
			}
		}
	}()

	// child_name 未提供时从用户表查询
	if childName == "" {
		var child model.User
		if err := database.DB.Where("id = ? AND role = ?", childID, model.RoleChild).First(&child).Error; err == nil {
			childName = child.Nickname
		}
	}

	// 2. 收集周期内完成的任务（status=completed）
	var tasks []model.Task
	database.DB.Where("family_id = ? AND child_id = ? AND status = ? AND created_at BETWEEN ? AND ?",
		familyID, childID, model.TaskStatusCompleted, cycle.StartDate, cycle.EndDate).
		Order("created_at ASC").Find(&tasks)

	// 3. 查询能力维度列表
	dimensions, _ := s.ability.ListDimensions()

	// 4. 【新增】AI 重新评定能力得分
	abilityDeltas, _ := s.ability.ReassessScores(s.aiService, childID, familyID, tasks, dimensions)
	// 查询周期目标，填充 TargetScore
	var goals []model.Goal
	database.DB.Where("cycle_id = ?", cycleID).Find(&goals)
	goalMap := make(map[uint]int)
	for _, g := range goals {
		goalMap[g.DimensionID] = g.TargetScore
	}
	for i := range abilityDeltas {
		abilityDeltas[i].TargetScore = goalMap[abilityDeltas[i].DimensionID]
	}
	// 将能力变化序列化为 ability_summary
	abilitySummaryJSON := ""
	if len(abilityDeltas) > 0 {
		if data, err := json.Marshal(abilityDeltas); err == nil {
			abilitySummaryJSON = string(data)
		}
	}

	// 5. 查询周期内相册精选（取前 5 张）
	var albumTasks []model.Task
	database.DB.Where("family_id = ? AND child_id = ? AND photo IS NOT NULL AND photo != '' AND created_at BETWEEN ? AND ?",
		familyID, childID, cycle.StartDate, cycle.EndDate).
		Order("created_at DESC").Limit(5).Find(&albumTasks)
	photoURLs := make([]string, 0, len(albumTasks))
	for _, t := range albumTasks {
		photoURLs = append(photoURLs, t.Photo)
	}

	// 6. 构造 system prompt（使用评定后的能力变化）
	prompt := s.buildStoryPrompt(childName, cycle, tasks, abilityDeltas, photoURLs)

	// 7. 调用 AI
	reply, err := s.aiService.Chat(prompt, nil, "请根据上述信息生成阶段成长故事，返回 JSON 格式")
	if err != nil {
		log.Printf("[GrowthStory] AI 调用失败 cycle=%d: %v", cycleID, err)
	}

	// 8. 解析 AI 返回（解析失败时降级）
	title := "周期成长故事"
	content := ""
	if reply != "" {
		cleaned := cleanJSONResponse(reply)
		if strings.HasPrefix(cleaned, "{") {
			var result aiStoryResult
			if json.Unmarshal([]byte(cleaned), &result) == nil {
				if result.Title != "" {
					title = result.Title
				}
				if result.Content != "" {
					content = result.Content
				}
			} else {
				content = reply
			}
		} else {
			content = reply
		}
	}

	// 9. 创建 GrowthStory 记录
	photosJSON := ""
	if len(photoURLs) > 0 {
		data, _ := json.Marshal(photoURLs)
		photosJSON = string(data)
	}
	story := &model.GrowthStory{
		CycleID:        cycleID,
		FamilyID:       familyID,
		ChildID:        childID,
		Title:          title,
		Content:        content,
		AbilitySummary: abilitySummaryJSON,
		PhotoUrls:      photosJSON,
	}
	if err := database.DB.Create(story).Error; err != nil {
		log.Printf("[GrowthStory] 保存成长故事失败 cycle=%d: %v", cycleID, err)
		// generationFailed 初始即为 true（Fail-Safe），保持不变
		return nil, errors.New("保存成长故事失败")
	}

	// 10. 标记周期 status=completed
	cycle.Status = "completed"
	if err := database.DB.Save(&cycle).Error; err != nil {
		log.Printf("[GrowthStory] 标记周期 %d 为 completed 失败: %v", cycleID, err)
		// 故事已保存成功，但周期状态异常——保留 reviewing
		// 下次请求时因幂等检查（已有故事）会直接返回故事，不影响用户体验
	}

	// 关键：所有步骤成功后，取消失败回滚标记
	// 注意：必须在 100% 成功后才赋值，否则 Fail-Safe 默认回滚
	generationFailed = false

	log.Printf("[GrowthStory] 周期 %d 成长故事生成完成 story=%d", cycleID, story.ID)
	return story, nil
}

// GetStory 按 cycle_id 查询成长故事
func (s *GrowthStoryService) GetStory(cycleID uint) (*model.GrowthStory, error) {
	var story model.GrowthStory
	if err := database.DB.Where("cycle_id = ?", cycleID).First(&story).Error; err != nil {
		return nil, errors.New("成长故事不存在")
	}
	return &story, nil
}

// ListStories 查询儿童所有成长故事（按时间倒序）
func (s *GrowthStoryService) ListStories(childID, familyID uint, page, pageSize int) ([]model.GrowthStory, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	var stories []model.GrowthStory
	var total int64
	db := database.DB.Where("child_id = ? AND family_id = ?", childID, familyID)
	db.Model(&model.GrowthStory{}).Count(&total)
	if err := db.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&stories).Error; err != nil {
		return nil, 0, err
	}
	return stories, total, nil
}

// GetCycleTasks 查询周期内所有任务（按时间正序），供故事详情页展示子任务时间线
func (s *GrowthStoryService) GetCycleTasks(cycleID, familyID uint) ([]model.Task, error) {
	var cycle model.GrowthCycle
	if err := database.DB.Where("id = ? AND family_id = ?", cycleID, familyID).First(&cycle).Error; err != nil {
		return nil, errors.New("周期不存在")
	}
	var tasks []model.Task
	database.DB.Where("family_id = ? AND child_id = ? AND status = ? AND created_at BETWEEN ? AND ?",
		familyID, cycle.ChildID, model.TaskStatusCompleted, cycle.StartDate, cycle.EndDate).
		Order("created_at ASC").Find(&tasks)
	return tasks, nil
}

// buildStoryPrompt 构造成长故事生成提示词
func (s *GrowthStoryService) buildStoryPrompt(childName string, cycle model.GrowthCycle, tasks []model.Task, deltas []AbilityDelta, photos []string) string {
	var parts []string
	parts = append(parts, fmt.Sprintf("你是儿童成长记录师。请为儿童 %s 在周期 [%s]（%s ~ %s）内生成一段成长故事。",
		childName, cycle.Name,
		cycle.StartDate.Format("2006-01-02"), cycle.EndDate.Format("2006-01-02")))

	// 完成的任务
	if len(tasks) > 0 {
		parts = append(parts, fmt.Sprintf("周期内完成的任务共 %d 项：", len(tasks)))
		limit := len(tasks)
		if limit > 20 {
			limit = 20
		}
		for i := 0; i < limit; i++ {
			t := tasks[i]
			parts = append(parts, fmt.Sprintf("- %s（%s，%d 积分）", t.Title, t.Category, t.Points))
		}
	} else {
		parts = append(parts, "周期内暂无完成的任务记录。")
	}

	// 能力维度变化
	if len(deltas) > 0 {
		var deltaStrs []string
		for _, d := range deltas {
			if d.Delta > 0 {
				deltaStrs = append(deltaStrs, fmt.Sprintf("%s：%d→%d（+%d）", d.DimensionName, d.OldScore, d.NewScore, d.Delta))
			} else if d.Delta < 0 {
				deltaStrs = append(deltaStrs, fmt.Sprintf("%s：%d→%d（%d）", d.DimensionName, d.OldScore, d.NewScore, d.Delta))
			} else {
				deltaStrs = append(deltaStrs, fmt.Sprintf("%s：%d（持平）", d.DimensionName, d.NewScore))
			}
		}
		parts = append(parts, fmt.Sprintf("能力维度变化：%s。", strings.Join(deltaStrs, "，")))
	}

	// 精选照片
	if len(photos) > 0 {
		parts = append(parts, fmt.Sprintf("周期内共有 %d 张精选成果照片。", len(photos)))
	}

	parts = append(parts, "要求：生成富有温度的成长故事，包含标题、正文（300-600 字）。")
	parts = append(parts, "返回纯 JSON（不要 markdown 代码块），格式：{\"title\":\"...\",\"content\":\"...\"}")
	return strings.Join(parts, "\n")
}
