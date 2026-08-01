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
	// 1. 查询周期并校验 status=active
	var cycle model.GrowthCycle
	if err := database.DB.First(&cycle, cycleID).Error; err != nil {
		return nil, errors.New("周期不存在")
	}
	if cycle.FamilyID != familyID || cycle.ChildID != childID {
		return nil, errors.New("周期与儿童不匹配")
	}
	if cycle.Status != "active" {
		return nil, errors.New("仅 active 状态的周期可生成成长故事")
	}

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

	// 3. 查询当前能力维度得分
	scores, _ := s.ability.GetChildScores(childID, familyID)
	dimensions, _ := s.ability.ListDimensions()

	// 4. 查询周期内相册精选（取前 5 张）
	var albumTasks []model.Task
	database.DB.Where("family_id = ? AND child_id = ? AND photo IS NOT NULL AND photo != '' AND created_at BETWEEN ? AND ?",
		familyID, childID, cycle.StartDate, cycle.EndDate).
		Order("created_at DESC").Limit(5).Find(&albumTasks)
	photoURLs := make([]string, 0, len(albumTasks))
	for _, t := range albumTasks {
		photoURLs = append(photoURLs, t.Photo)
	}

	// 5. 构造 system prompt
	prompt := s.buildStoryPrompt(childName, cycle, tasks, scores, dimensions, photoURLs)

	// 6. 调用 AI
	reply, err := s.aiService.Chat(prompt, nil, "请根据上述信息生成阶段成长故事，返回 JSON 格式")
	if err != nil {
		log.Printf("[GrowthStory] AI 调用失败 cycle=%d: %v", cycleID, err)
	}

	// 7. 解析 AI 返回（解析失败时降级）
	title := "周期成长故事"
	content := ""
	abilitySummary := ""
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
				abilitySummary = result.AbilitySummary
			} else {
				// JSON 解析失败，降级为 AI 原始返回
				content = reply
			}
		} else {
			// 非 JSON 格式，降级为 AI 原始返回
			content = reply
		}
	}

	// 8. 创建 GrowthStory 记录
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
		AbilitySummary: abilitySummary,
		PhotoUrls:      photosJSON,
	}
	if err := database.DB.Create(story).Error; err != nil {
		return nil, errors.New("保存成长故事失败")
	}

	// 9. 标记周期 status=completed
	cycle.Status = "completed"
	database.DB.Save(&cycle)

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

// buildStoryPrompt 构造成长故事生成提示词
func (s *GrowthStoryService) buildStoryPrompt(childName string, cycle model.GrowthCycle, tasks []model.Task, scores []model.ChildAbilityScore, dims []model.AbilityDimension, photos []string) string {
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

	// 能力维度得分
	if len(scores) > 0 && len(dims) > 0 {
		var scoreStrs []string
		for _, sc := range scores {
			for _, d := range dims {
				if d.ID == sc.DimensionID {
					scoreStrs = append(scoreStrs, fmt.Sprintf("%s=%d", d.Name, sc.Score))
					break
				}
			}
		}
		if len(scoreStrs) > 0 {
			parts = append(parts, fmt.Sprintf("当前能力维度得分：%s。", strings.Join(scoreStrs, "，")))
		}
	}

	// 精选照片
	if len(photos) > 0 {
		parts = append(parts, fmt.Sprintf("周期内共有 %d 张精选成果照片。", len(photos)))
	}

	parts = append(parts, "要求：生成富有温度的成长故事，包含标题、正文（300-600 字）、能力提升摘要（简述各维度成长亮点）。")
	parts = append(parts, "返回纯 JSON（不要 markdown 代码块），格式：{\"title\":\"...\",\"content\":\"...\",\"ability_summary\":\"...\"}")
	return strings.Join(parts, "\n")
}
