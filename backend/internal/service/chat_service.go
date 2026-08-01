package service

import (
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"strings"
)

type ChatService struct {
	aiService *AIService
	ability   *AbilityService
	task      *TaskService
}

func NewChatService(aiService *AIService) *ChatService {
	return &ChatService{
		aiService: aiService,
		ability:   NewAbilityService(),
		task:      NewTaskService(),
	}
}

// SendMessage 发送消息并获取回复
func (s *ChatService) SendMessage(sessionID uint, userRole string, childID, familyID uint, userMessage string) (string, string, error) {
	// 构造系统提示词
	systemPrompt := s.buildSystemPrompt(childID, familyID, userRole)

	// 获取历史消息
	var history []model.ChatMessage
	database.DB.Where("session_id = ?", sessionID).Order("created_at ASC").Limit(10).Find(&history)

	// 转换为 aiService 需要的格式
	var histMessages []chatMessage
	for _, m := range history {
		histMessages = append(histMessages, chatMessage{Role: m.Role, Content: m.Content})
	}

	// 保存用户消息
	userMsg := &model.ChatMessage{
		SessionID: sessionID,
		Role:      "user",
		Content:   userMessage,
	}
	database.DB.Create(userMsg)

	// 调用 AI
	reply, err := s.aiService.Chat(systemPrompt, histMessages, userMessage)
	if err != nil {
		return "", "", err
	}

	// 简单意图识别（基于关键词）
	intent := s.detectIntent(userMessage)

	// 保存 AI 回复
	aiMsg := &model.ChatMessage{
		SessionID: sessionID,
		Role:      "assistant",
		Content:   reply,
		Intent:    intent,
	}
	database.DB.Create(aiMsg)

	return reply, intent, nil
}

// buildSystemPrompt 构造系统提示词（含儿童上下文）
func (s *ChatService) buildSystemPrompt(childID, familyID uint, userRole string) string {
	var parts []string
	parts = append(parts, "你是「小芽」，GrowPocket 的 AI 成长助理，一个温暖的种子精灵。你的角色是陪伴 6-12 岁儿童成长。")
	parts = append(parts, fmt.Sprintf("当前对话者角色：%s（parent=家长，child=儿童）。", userRole))
	parts = append(parts, "回答要简洁、温暖、富有鼓励性。如果家长请求设置目标或回顾，引导他们在成长页操作。")

	// 儿童信息
	var child model.User
	if err := database.DB.Where("id = ? AND role = ?", childID, "child").First(&child).Error; err == nil {
		parts = append(parts, fmt.Sprintf("儿童信息：姓名 %s，余额 %d 积分。", child.Nickname, child.Balance))
	}

	// 能力维度得分（需关联维度表获取名称）
	scores, _ := s.ability.GetChildScores(childID, familyID)
	if len(scores) > 0 {
		// 查询所有维度，构造 id->name 映射
		var dims []model.AbilityDimension
		database.DB.Find(&dims)
		dimNameMap := make(map[uint]string, len(dims))
		for _, d := range dims {
			dimNameMap[d.ID] = d.Name
		}
		var scoreStrs []string
		for _, sc := range scores {
			name := dimNameMap[sc.DimensionID]
			if name == "" {
				name = fmt.Sprintf("维度%d", sc.DimensionID)
			}
			scoreStrs = append(scoreStrs, fmt.Sprintf("%s=%d", name, sc.Score))
		}
		growthIndex, _ := s.ability.GetGrowthIndex(childID, familyID)
		parts = append(parts, fmt.Sprintf("能力维度得分：%s。成长指数：%d。", strings.Join(scoreStrs, "，"), growthIndex))
	}

	// 今日任务
	tasks, _, _ := s.task.ListTasks(familyID, childID, 0, 1, 5)
	if len(tasks) > 0 {
		var taskStrs []string
		for _, t := range tasks {
			taskStrs = append(taskStrs, fmt.Sprintf("%s(%d积分)", t.Title, t.Points))
		}
		parts = append(parts, fmt.Sprintf("最近任务：%s。", strings.Join(taskStrs, "，")))
	}

	// 权限说明
	if userRole == "child" {
		parts = append(parts, "注意：当前用户是儿童，不能执行家长专属操作（设置目标、阶段回顾）。如果儿童请求这些操作，温柔地告诉他们需要请家长帮忙。")
	}

	return strings.Join(parts, "\n")
}

// detectIntent 简单意图识别
func (s *ChatService) detectIntent(message string) string {
	msg := strings.ToLower(message)
	if strings.Contains(msg, "任务") || strings.Contains(msg, "今天") {
		if strings.Contains(msg, "提交") || strings.Contains(msg, "完成") {
			return "submit_task"
		}
		return "query_task"
	}
	if strings.Contains(msg, "积分") || strings.Contains(msg, "余额") {
		return "query_points"
	}
	if strings.Contains(msg, "能力") || strings.Contains(msg, "成长") {
		if strings.Contains(msg, "回顾") || strings.Contains(msg, "总结") {
			return "parent_review"
		}
		return "query_ability"
	}
	if strings.Contains(msg, "精灵") || strings.Contains(msg, "小芽") {
		return "query_sprite"
	}
	if strings.Contains(msg, "目标") || strings.Contains(msg, "设定") {
		return "parent_set_goal"
	}
	return "chat"
}

// CreateSession 创建对话会话
func (s *ChatService) CreateSession(familyID, childID, userID uint, role string) (*model.ChatSession, error) {
	session := &model.ChatSession{
		FamilyID: familyID,
		ChildID:  childID,
		UserID:   userID,
		Role:     role,
	}
	if err := database.DB.Create(session).Error; err != nil {
		return nil, err
	}
	return session, nil
}

// GetHistory 获取会话历史
func (s *ChatService) GetHistory(sessionID uint) ([]model.ChatMessage, error) {
	var messages []model.ChatMessage
	err := database.DB.Where("session_id = ?", sessionID).Order("created_at ASC").Limit(50).Find(&messages).Error
	return messages, err
}
