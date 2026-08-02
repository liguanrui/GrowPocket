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

	// 8. 解析 AI 返回（解析失败时降级为本地拼接的阶段总结，保证页面有内容可展示）
	title := fmt.Sprintf("%s的阶段成长故事", childName)
	content := ""
	aiOK := false
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
					aiOK = true
				}
			} else {
				content = reply
				aiOK = true
			}
		} else if len(reply) > 20 {
			// AI 正常返回但非 JSON 结构，也视为可用文本，不触发降级
			content = reply
			aiOK = true
		}
	}
	// AI 降级：无 Key / 网络失败 / 返回为空 —— 基于任务与能力变化在本地生成一份可读总结，
	// 保证用户至少能看到阶段框架、任务列表与能力变化，而不是返回 500 让前端白屏。
	if !aiOK {
		parts := []string{fmt.Sprintf("## %s 的阶段回顾\n", childName)}
		startStr := cycle.StartDate.Format("2006 年 1 月 2 日")
		endStr := ""
		if !cycle.EndDate.IsZero() {
			endStr = " 至 " + cycle.EndDate.Format("2006 年 1 月 2 日")
		}
		parts = append(parts, fmt.Sprintf("\n这一阶段从 **%s**%s 开始，我们一起记录了 %d 个完成的小任务。\n",
			startStr, endStr, len(tasks)))
		if len(tasks) > 0 {
			parts = append(parts, "\n### 完成的任务\n")
			for i, t := range tasks {
				line := fmt.Sprintf("%d. **%s**", i+1, t.Title)
				if t.Points > 0 {
					line += fmt.Sprintf("（+%d 积分）", t.Points)
				}
				if t.Description != "" {
					desc := t.Description
					if len(desc) > 80 {
						desc = desc[:80] + "…"
					}
					line += fmt.Sprintf("：%s", desc)
				}
				parts = append(parts, line)
			}
			parts = append(parts, "")
		} else {
			parts = append(parts, "\n> 这个阶段还没有完成的任务。下次多陪孩子一起完成任务，故事就会更丰富啦。\n")
		}
		if len(abilityDeltas) > 0 {
			parts = append(parts, "\n### 能力变化\n")
			for _, d := range abilityDeltas {
				arrow := "↔"
				if d.Delta > 0 {
					arrow = "↑+"
				} else if d.Delta < 0 {
					arrow = "↓"
				}
				line := fmt.Sprintf("- **%s**：%d → %d（%s%d）",
					d.DimensionName, d.OldScore, d.NewScore, arrow, absInt(d.Delta))
				if d.TargetScore > 0 {
					line += fmt.Sprintf("（阶段目标 %d）", d.TargetScore)
				}
				parts = append(parts, line)
			}
			parts = append(parts, "")
		}
		if len(photoURLs) > 0 {
			parts = append(parts, fmt.Sprintf("\n这一阶段还留下了 %d 张珍贵的照片，都收藏在故事相册里啦。\n", len(photoURLs)))
		}
		if err != nil {
			// AI 本身返回了错误（非空 reply 的降级已在上面覆盖），仅作为家长可见提示
			log.Printf("[GrowthStory] cycle=%d 使用本地降级故事（AI 失败原因：%v）", cycleID, err)
			parts = append(parts, "\n---\n> 提示：成长故事使用了本地总结版本。配置 AI_API_KEY 后可以重新生成更有温度的故事。\n")
		} else {
			parts = append(parts, "\n---\n> 提示：系统 AI 暂未配置，当前为本地总结版本。配置 AI_API_KEY 后可以重新生成更有温度的故事。\n")
		}
		content = strings.Join(parts, "\n")
		// 降级故事的标题也更接地气一点
		title = fmt.Sprintf("%s 的阶段回顾（本地方）", childName)
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
	sanitizeGrowthStory(story)
	return story, nil
}

// GetStory 按 cycle_id + family_id 查询成长故事（加家庭归属校验，禁止越权读别家故事）
func (s *GrowthStoryService) GetStory(cycleID, familyID uint) (*model.GrowthStory, error) {
	var story model.GrowthStory
	if err := database.DB.Where("cycle_id = ? AND family_id = ?", cycleID, familyID).First(&story).Error; err != nil {
		return nil, errors.New("成长故事不存在")
	}
	sanitizeGrowthStory(&story)
	return &story, nil
}

// GenerateProjectStory 为指定大师挑战实例生成项目式成长故事
// V3.1 模块 B：写入 GrowthStory（type='project'，master_challenge_instance_id=instanceID）
// 幂等：若该实例已有 project 故事记录，直接返回已有故事
func (s *GrowthStoryService) GenerateProjectStory(instanceID uint) (*model.GrowthStory, error) {
	// 0. 幂等检查
	var existing model.GrowthStory
	if err := database.DB.Where("type = ? AND master_challenge_instance_id = ?", "project", instanceID).First(&existing).Error; err == nil {
		log.Printf("[GrowthStory] 大师挑战实例 %d 已有项目故事 story=%d，返回已有故事", instanceID, existing.ID)
		sanitizeGrowthStory(&existing)
		return &existing, nil
	}

	// 1. 查询实例
	var instance model.MasterChallengeInstance
	if err := database.DB.First(&instance, instanceID).Error; err != nil {
		return nil, errors.New("大师挑战实例不存在")
	}

	// 2. 查询阶段与提交
	var stages []model.MasterChallengeStage
	database.DB.Where("instance_id = ?", instanceID).Order("stage_index ASC").Find(&stages)

	var submission model.MasterChallengeSubmission
	hasSubmission := false
	if err := database.DB.Where("instance_id = ?", instanceID).Order("created_at DESC").First(&submission).Error; err == nil {
		hasSubmission = true
	}

	// 查询孩子姓名
	childName := ""
	var child model.User
	if err := database.DB.Where("id = ? AND role = ?", instance.ChildID, model.RoleChild).First(&child).Error; err == nil {
		childName = child.Nickname
	}

	// 3. 构造 AI prompt
	prompt := s.buildProjectStoryPrompt(childName, instance, stages, submission, hasSubmission)

	// 4. 调用 AI
	reply, err := s.aiService.Chat(prompt, nil, "请根据上述信息生成大师挑战项目式成长故事，返回 JSON 格式")
	if err != nil {
		log.Printf("[GrowthStory] AI 调用失败 instance=%d: %v", instanceID, err)
	}

	// 5. 解析 AI 返回（解析失败时降级）
	title := "大师挑战成长故事：" + instance.Title
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

	// 6. 拼接能力摘要（参与维度 + 评分）
	abilitySummary := ""
	if hasSubmission {
		summary := map[string]interface{}{
			"participation_score": submission.ParticipationScore,
			"application_score":   submission.ApplicationScore,
			"quality_score":       submission.QualityScore,
			"passed":              submission.Passed,
			"points_awarded":      submission.PointsAwarded,
		}
		if data, err := json.Marshal(summary); err == nil {
			abilitySummary = string(data)
		}
	}

	// 7. 提取附件作为相册（最多 5 张）
	photoURLs := make([]string, 0, 5)
	if hasSubmission && submission.Attachments != "" {
		var urls []string
		if json.Unmarshal([]byte(submission.Attachments), &urls) == nil {
			for _, u := range urls {
				if len(photoURLs) >= 5 {
					break
				}
				photoURLs = append(photoURLs, u)
			}
		}
	}
	photosJSON := ""
	if len(photoURLs) > 0 {
		data, _ := json.Marshal(photoURLs)
		photosJSON = string(data)
	}

	// 8. 写入 GrowthStory（type='project'）
	instanceIDVal := instanceID
	story := &model.GrowthStory{
		CycleID:                   0, // 项目故事不关联周期
		FamilyID:                  instance.FamilyID,
		ChildID:                   instance.ChildID,
		Title:                     title,
		Content:                   content,
		AbilitySummary:            abilitySummary,
		PhotoUrls:                 photosJSON,
		Type:                      "project",
		MasterChallengeInstanceID: &instanceIDVal,
	}
	if err := database.DB.Create(story).Error; err != nil {
		log.Printf("[GrowthStory] 保存项目故事失败 instance=%d: %v", instanceID, err)
		return nil, errors.New("保存项目成长故事失败")
	}

	log.Printf("[GrowthStory] 大师挑战实例 %d 项目故事生成完成 story=%d", instanceID, story.ID)
	sanitizeGrowthStory(story)
	return story, nil
}

// sanitizeGrowthStory 清理成长故事长文本字段中的非法控制字符，
// 确保 Go JSON 序列化后的响应能被前端 Node/axios 的严格 JSON.parse 正确解析。
//
// 根因背景：旧故事的 Content/Title/AbilitySummary 里可能含有未被转义的 LF/CR/FF/换页符
// 或其他 C0/C1 控制字符。Gin 的 c.JSON（json.Marshal）通常只对 LF/CR/TAB 做转义，
// 其他控制字符会以裸码点形式写入 JSON，导致前端 JSON.parse 抛出
// "Bad control character in string literal" 错误，axios 直接进入 error 分支。
func sanitizeGrowthStory(s *model.GrowthStory) {
	if s == nil {
		return
	}
	s.Title = sanitizeTextForJSON(s.Title)
	s.Content = sanitizeTextForJSON(s.Content)
	s.AbilitySummary = sanitizeTextForJSON(s.AbilitySummary)
	s.PhotoUrls = sanitizeTextForJSON(s.PhotoUrls)
}

// sanitizeTextForJSON 把会破坏 JSON 严格解析的控制字符清理或规范化：
//   - 移除：U+0000-U+001F 中除了 TAB(9)、LF(10)、CR(13) 之外的所有 C0 控制字符
//   - 移除：DEL (U+007F) 与 C1 控制字符 (U+0080-U+009F)
//   - 规范换行：\r\n、\r 统一为 \n；垂直制表 / 换页符 视作换行
//   - 连续超过 2 个空行压缩为最多 2 个
func sanitizeTextForJSON(s string) string {
	if s == "" {
		return s
	}
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch {
		case r == 0x09: // TAB
			b.WriteRune(r)
		case r == 0x0D: // CR -> LF
			b.WriteRune('\n')
		case r == 0x0A: // LF
			b.WriteRune('\n')
		case r == 0x0B || r == 0x0C: // 垂直制表 / 换页 -> LF
			b.WriteRune('\n')
		case r <= 0x1F:
			continue
		case 0x7F <= r && r <= 0x9F:
			continue
		default:
			b.WriteRune(r)
		}
	}
	out := b.String()
	// 连续 3 个及以上空行折叠成 2 个
	for strings.Contains(out, "\n\n\n") {
		out = strings.ReplaceAll(out, "\n\n\n", "\n\n")
	}
	return out
}

// buildProjectStoryPrompt 构造大师挑战项目故事生成提示词
func (s *GrowthStoryService) buildProjectStoryPrompt(childName string, instance model.MasterChallengeInstance, stages []model.MasterChallengeStage, submission model.MasterChallengeSubmission, hasSubmission bool) string {
	var parts []string
	parts = append(parts, fmt.Sprintf("你是儿童成长记录师。请为儿童 %s 完成的大师挑战项目 [%s] 生成一段项目式成长故事。",
		childName, instance.Title))
	parts = append(parts, fmt.Sprintf("项目状态：%s，启动时间：%s。", instance.Status, instance.StartedAt.Format("2006-01-02")))
	if instance.FinalSummary != "" {
		parts = append(parts, fmt.Sprintf("孩子总结：%s", instance.FinalSummary))
	}

	// 阶段进展
	if len(stages) > 0 {
		parts = append(parts, fmt.Sprintf("项目共分 %d 个阶段：", len(stages)))
		for _, st := range stages {
			statusText := st.Status
			if statusText == "" {
				statusText = "pending"
			}
			line := fmt.Sprintf("- 阶段%d [%s] %s（状态：%s", st.StageIndex+1, st.Title, st.Description, statusText)
			if st.Notes != "" {
				line += "，孩子记录：" + st.Notes
			}
			if st.SelfRating > 0 {
				line += fmt.Sprintf("，自评进度：%d/5", st.SelfRating)
			}
			line += "）"
			parts = append(parts, line)
		}
	}

	// 验收评分
	if hasSubmission {
		parts = append(parts, fmt.Sprintf("家长验收评分：参与度 %d/5，能力应用度 %d/5，成果满意度 %d/5，%s。",
			submission.ParticipationScore, submission.ApplicationScore, submission.QualityScore,
			map[bool]string{true: "通过", false: "未通过"}[submission.Passed]))
		if submission.ChildSummary != "" {
			parts = append(parts, fmt.Sprintf("孩子一句话总结：%s", submission.ChildSummary))
		}
		if submission.PointsAwarded > 0 {
			parts = append(parts, fmt.Sprintf("获得稀有积分奖励：%d。", submission.PointsAwarded))
		}
	}

	parts = append(parts, "要求：生成富有温度的项目式成长故事，突出孩子在项目中展现的能力进阶与心路历程，包含标题、正文（300-600 字）。")
	parts = append(parts, "返回纯 JSON（不要 markdown 代码块），格式：{\"title\":\"...\",\"content\":\"...\"}")
	return strings.Join(parts, "\n")
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
	for i := range stories {
		sanitizeGrowthStory(&stories[i])
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
