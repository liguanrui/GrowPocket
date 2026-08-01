package service

import (
	"encoding/json"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"strings"
	"time"
)

// TaskGenerationService 负责 AI 每日任务生成（v3）
type TaskGenerationService struct {
	aiService    *AIService
	ability      *AbilityService
	cycleService *GrowthCycleService
	taskService  *TaskService
}

// NewTaskGenerationService 创建任务生成服务
func NewTaskGenerationService(aiService *AIService) *TaskGenerationService {
	return &TaskGenerationService{
		aiService:    aiService,
		ability:      NewAbilityService(),
		cycleService: NewGrowthCycleService(),
		taskService:  NewTaskService(),
	}
}

// aiTaskSuggestion AI 返回的单个任务建议
type aiTaskSuggestion struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Points      int    `json:"points"`
	Difficulty  string `json:"difficulty"`
	Category    string `json:"category"`
	DimensionID uint   `json:"dimension_id"`
}

// GenerateTasksForChild 为儿童生成每日 AI 任务
func (s *TaskGenerationService) GenerateTasksForChild(childID, familyID, createdBy uint, childName string) error {
	// 1. 收集上下文
	scores, _ := s.ability.GetChildScores(childID, familyID)
	dimensions, _ := s.ability.ListDimensions()
	cycle, goals, _ := s.cycleService.GetCurrentCycle(childID, familyID)

	// 找最弱维度
	weakestDim := ""
	minScore := 101
	for _, sc := range scores {
		if sc.Score < minScore {
			minScore = sc.Score
			// 通过 dimension_id 查维度名称
			for _, d := range dimensions {
				if d.ID == sc.DimensionID {
					weakestDim = d.Name
					break
				}
			}
		}
	}

	// 查儿童档案（取生日用于适龄判断）
	var child model.User
	database.DB.Where("id = ?", childID).First(&child)

	// 构造提示词
	prompt := s.buildGenerationPrompt(childName, child, weakestDim, scores, dimensions, cycle, goals)

	// 2. 调用 AI
	reply, err := s.aiService.Chat(prompt, nil, "请生成 1-3 个适合的任务，返回 JSON 数组格式")
	if err != nil {
		return fmt.Errorf("AI 生成失败: %w", err)
	}

	// 3. 解析 JSON（AI 返回可能包含 markdown 代码块，需清理）
	reply = cleanJSONResponse(reply)
	// 无 API Key 时 AI 会返回降级文本（非 JSON），这里显式返回错误，避免日志噪音
	if !strings.HasPrefix(reply, "[") && !strings.HasPrefix(reply, "{") {
		return fmt.Errorf("AI 返回非 JSON 格式（可能未配置 API Key）: %s", reply)
	}
	var suggestions []aiTaskSuggestion
	if err := json.Unmarshal([]byte(reply), &suggestions); err != nil {
		return fmt.Errorf("解析 AI 返回失败: %w, reply: %s", err, reply)
	}

	// 4. 创建任务
	created := 0
	for _, sug := range suggestions {
		if sug.Title == "" || sug.Points == 0 {
			continue
		}
		dimID := sug.DimensionID
		if dimID == 0 && weakestDim != "" {
			// 默认关联最弱维度
			for _, d := range dimensions {
				if d.Name == weakestDim {
					dimID = d.ID
					break
				}
			}
		}
		difficulty := sug.Difficulty
		if difficulty == "" {
			difficulty = "medium"
		}
		category := sug.Category
		if category == "" {
			category = "其他"
		}

		task := &model.Task{
			FamilyID:           familyID,
			Title:              sug.Title,
			Description:        sug.Description,
			Points:             sug.Points,
			Status:             model.TaskStatusInProgress,
			ChildID:            childID,
			ChildName:          childName,
			CreatedBy:          createdBy,
			Difficulty:         difficulty,
			Category:           category,
			AbilityDimensionID: dimID,
			AIGenerated:        true,
		}
		if err := database.DB.Create(task).Error; err != nil {
			log.Printf("[TaskGen] 创建 AI 任务失败: %v", err)
			continue
		}
		created++
	}

	log.Printf("[TaskGen] 为儿童 %d 生成了 %d 个 AI 任务", childID, created)
	return nil
}

// buildGenerationPrompt 构造 AI 任务生成提示词
func (s *TaskGenerationService) buildGenerationPrompt(childName string, child model.User, weakestDim string, scores []model.ChildAbilityScore, dims []model.AbilityDimension, cycle *model.GrowthCycle, goals []model.Goal) string {
	var parts []string
	parts = append(parts, fmt.Sprintf("你是儿童成长任务设计师。为儿童 %s 设计每日任务。", childName))
	if child.Birthday != nil {
		age := computeAge(*child.Birthday)
		if age > 0 {
			parts = append(parts, fmt.Sprintf("儿童年龄：%d 岁。", age))
		}
	}
	parts = append(parts, "要求：生成 1-3 个任务，返回纯 JSON 数组（不要 markdown 代码块），每个任务包含字段：title, description, points, difficulty(easy/medium/hard), category(学习/家务/行为习惯/运动/其他), dimension_id。")
	if len(dims) > 0 {
		parts = append(parts, "dimension_id 从以下选择：")
		for _, d := range dims {
			parts = append(parts, fmt.Sprintf("  %d=%s", d.ID, d.Name))
		}
	}
	if weakestDim != "" {
		parts = append(parts, fmt.Sprintf("重点提升维度：%s（当前最弱）。", weakestDim))
	}
	if len(goals) > 0 {
		var goalStrs []string
		for _, g := range goals {
			for _, d := range dims {
				if d.ID == g.DimensionID {
					goalStrs = append(goalStrs, fmt.Sprintf("%s目标%d分", d.Name, g.TargetScore))
					break
				}
			}
		}
		if len(goalStrs) > 0 {
			parts = append(parts, fmt.Sprintf("家长目标：%s。", strings.Join(goalStrs, "，")))
		}
	}
	parts = append(parts, "任务要适龄、有趣、可执行。积分建议 10-200。")
	return strings.Join(parts, "\n")
}

// computeAge 根据生日计算周岁
func computeAge(birthday time.Time) int {
	now := time.Now()
	age := now.Year() - birthday.Year()
	if now.Month() < birthday.Month() || (now.Month() == birthday.Month() && now.Day() < birthday.Day()) {
		age--
	}
	if age < 0 {
		return 0
	}
	return age
}

// cleanJSONResponse 清理 AI 返回中的 markdown 代码块标记
func cleanJSONResponse(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

// GenerateForAllChildren 为所有儿童生成任务（定时任务调用）
// 同一天内已生成过 AI 任务的儿童会被跳过，避免重复
func (s *TaskGenerationService) GenerateForAllChildren() {
	var children []model.User
	database.DB.Where("role = ?", model.RoleChild).Find(&children)
	for _, child := range children {
		// 检查今日是否已生成过 AI 任务
		if hasTodayAITask(child.ID, child.FamilyID) {
			log.Printf("[TaskGen] 儿童 %d 今日已生成过 AI 任务，跳过", child.ID)
			continue
		}
		// 找家长 ID
		var parent model.User
		database.DB.Where("family_id = ? AND role = ?", child.FamilyID, model.RoleParent).First(&parent)
		createdBy := parent.ID
		if createdBy == 0 {
			createdBy = child.ID
		}
		if err := s.GenerateTasksForChild(child.ID, child.FamilyID, createdBy, child.Nickname); err != nil {
			log.Printf("[TaskGen] 儿童 %d 生成失败: %v", child.ID, err)
		}
	}
}

// hasTodayAITask 判断儿童今日是否已有 AI 生成的任务
func hasTodayAITask(childID, familyID uint) bool {
	today := time.Date(time.Now().Year(), time.Now().Month(), time.Now().Day(), 0, 0, 0, 0, time.Now().Location())
	tomorrow := today.Add(24 * time.Hour)
	var count int64
	database.DB.Model(&model.Task{}).
		Where("child_id = ? AND family_id = ? AND ai_generated = ? AND created_at >= ? AND created_at < ?",
			childID, familyID, true, today, tomorrow).
		Count(&count)
	return count > 0
}

// StartDailyScheduler 启动每日定时生成（每天 08:00），非阻塞
// 启动时若今日尚未为儿童生成过任务，会立即生成一次
func (s *TaskGenerationService) StartDailyScheduler() {
	go func() {
		// 启动时立即尝试生成一次（跳过当日已生成的儿童）
		log.Printf("[TaskGen] 启动时检查并生成当日 AI 任务")
		s.GenerateForAllChildren()

		for {
			now := time.Now()
			next := time.Date(now.Year(), now.Month(), now.Day(), 8, 0, 0, 0, now.Location())
			if !next.After(now) {
				next = next.Add(24 * time.Hour)
			}
			time.Sleep(next.Sub(now))
			log.Printf("[TaskGen] 开始每日 AI 任务生成")
			s.GenerateForAllChildren()
		}
	}()
}
