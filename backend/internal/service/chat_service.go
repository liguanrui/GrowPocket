package service

import (
	"context"
	"encoding/json"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"strings"
	"time"

	"gorm.io/gorm"
)

// ToolExecuteFunc 工具执行函数签名
// args: LLM 传来的参数(map);familyID/childID/userRole:鉴权三要素
// 返回 tool 执行结果的 JSON 字符串
type ToolExecuteFunc func(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (resultJSON string, err error)

// ToolEntry 工具注册项
type ToolEntry struct {
	Definition ToolDefinition
	Execute    ToolExecuteFunc
	// IsWrite 标记是否为写工具。写工具的 ExecuteFunc 不执行真正写操作，
	// 仅查询信息构造 ActionSuggestion JSON 返回，由 SendMessage 收集后下发给前端确认。
	IsWrite bool
}

// ActionSuggestion AI 返回的写操作建议（前端渲染确认卡片，用户确认后直接调 REST API）
type ActionSuggestion struct {
	Action         string         `json:"action"`                    // 动作类型，如 submit_task/redeem_item
	Params         map[string]any `json:"params"`                    // 动作参数
	Summary        string         `json:"summary"`                   // 卡片正文摘要
	ConfirmText    string         `json:"confirm_text"`              // 确认按钮文案
	CancelText     string         `json:"cancel_text"`               // 取消按钮文案
	APIEndpoint    string         `json:"api_endpoint"`              // 确认后调用的 REST API
	APIMethod      string         `json:"api_method"`                // HTTP 方法
	APIBody        map[string]any `json:"api_body,omitempty"`        // 请求体
	RequiresParent bool           `json:"requires_parent"`           // 是否需要家长权限
}

type ChatService struct {
	aiService       *AIService
	ability         *AbilityService
	task            *TaskService
	score           *ScoreService
	redeem          *RedeemService
	growth          *GrowthService
	growthCycle     *GrowthCycleService
	growthStory     *GrowthStoryService
	masterChallenge *MasterChallengeService
	activity        *ActivityService
	toolRegistry    map[string]ToolEntry
}

func NewChatService(aiService *AIService) *ChatService {
	s := &ChatService{
		aiService:       aiService,
		ability:         NewAbilityService(),
		task:            NewTaskService(),
		score:           NewScoreService(),
		redeem:          NewRedeemService(),
		growth:          NewGrowthService(),
		growthCycle:     NewGrowthCycleService(),
		growthStory:     NewGrowthStoryService(aiService),
		masterChallenge: NewMasterChallengeService(aiService),
		activity:        NewActivityService(),
		toolRegistry:    make(map[string]ToolEntry),
	}
	// 注册只读工具
	s.registerReadonlyTools()
	// 注册写工具（写工具不执行真正写操作，仅生成 ActionSuggestion 供前端确认）
	s.registerWriteTools()
	return s
}

// SendMessage 发送消息并获取回复
// 返回：reply 文字回复、intent 意图、suggestedActions 写操作建议卡片列表
func (s *ChatService) SendMessage(sessionID uint, userRole string, childID, familyID uint, userMessage string) (string, string, []ActionSuggestion, error) {
	ctx := context.Background()

	// 构造系统提示词
	systemPrompt := s.buildSystemPrompt(childID, familyID, userRole)

	// 获取历史消息
	var history []model.ChatMessage
	database.DB.Where("session_id = ?", sessionID).Order("created_at ASC").Limit(10).Find(&history)

	// 保存用户消息
	userMsg := &model.ChatMessage{
		SessionID: sessionID,
		Role:      "user",
		Content:   userMessage,
	}
	database.DB.Create(userMsg)

	// 将用户消息追加到工作 history（ChatWithTools 首次及后续调用 userMessage 传空，
	// 因为 userMessage 已作为最后一条 user 消息进入 history）
	history = append(history, *userMsg)

	// 工具调用循环：调用 ChatWithTools，若返回 tool_calls 则执行工具并追加结果后再次调用
	tools := s.getToolDefinitions()
	var reply string
	var toolCalls []ToolCall
	var firstToolName string
	var suggestedActions []ActionSuggestion
	const maxLoop = 3 // 循环上限，超过强制收尾
	loopCount := 0

	for {
		loopCount++
		if loopCount > maxLoop {
			// 超过循环上限，强制返回固定提示，清空 toolCalls
			reply = "请一次只问一个问题"
			toolCalls = nil
			break
		}

		r, tc, err := s.aiService.ChatWithTools(systemPrompt, history, "", tools)
		if err != nil {
			return "", "", nil, err
		}
		reply = r
		toolCalls = tc

		// 无工具调用，循环结束，reply 即最终回复
		if len(toolCalls) == 0 {
			break
		}

		// 记录本轮第一个工具名，用于反推 intent
		if firstToolName == "" {
			firstToolName = toolCalls[0].Function.Name
		}

		// 追加 assistant 消息（携带 tool_calls 请求，原样回传给 LLM）
		toolCallsJSON, _ := json.Marshal(toolCalls)
		history = append(history, model.ChatMessage{
			Role:      "assistant",
			Content:   reply,
			ToolCalls: string(toolCallsJSON),
		})

		// 执行每个工具并追加 tool 结果消息
		for _, call := range toolCalls {
			entry, ok := s.toolRegistry[call.Function.Name]
			if !ok {
				history = append(history, model.ChatMessage{
					Role:       "tool",
					ToolCallID: call.ID,
					Content:    fmt.Sprintf(`{"error":%q}`, "工具 "+call.Function.Name+" 未注册"),
				})
				continue
			}

			resultJSON, execErr := s.executeToolCall(ctx, call.Function.Name, call.Function.Arguments, familyID, childID, userRole)
			if execErr != nil {
				history = append(history, model.ChatMessage{
					Role:       "tool",
					ToolCallID: call.ID,
					Content:    fmt.Sprintf(`{"error":%q}`, execErr.Error()),
				})
				continue
			}

			// 写工具：ExecuteFunc 返回 ActionSuggestion JSON，不作为真实结果送回 LLM 循环；
			// 改为收集到 suggestedActions，并给 LLM 一个简短结果让其生成配套文字回复。
			if entry.IsWrite {
				var sug ActionSuggestion
				if err := json.Unmarshal([]byte(resultJSON), &sug); err == nil && sug.Action != "" {
					suggestedActions = append(suggestedActions, sug)
				}
				resultJSON = `{"status":"已向用户展示确认卡片,等待用户确认"}`
			} else {
				// 只读工具：结果截断，超过 500 字符则截断并追加提示
				if runes := []rune(resultJSON); len(runes) > 500 {
					resultJSON = string(runes[:500]) + "\n...(如需详情请追问)"
				}
			}

			history = append(history, model.ChatMessage{
				Role:       "tool",
				ToolCallID: call.ID,
				Content:    resultJSON,
			})
		}
	}

	// 用工具名反推 intent；无工具调用时 intentFromToolName 返回 "chat"
	intent := s.intentFromToolName(firstToolName)

	// 序列化 suggested_actions 以持久化（供前端回查历史渲染卡片状态）
	suggestedActionsJSON := ""
	if len(suggestedActions) > 0 {
		if bs, err := json.Marshal(suggestedActions); err == nil {
			suggestedActionsJSON = string(bs)
		}
	}

	// 保存 AI 回复
	aiMsg := &model.ChatMessage{
		SessionID:        sessionID,
		Role:             "assistant",
		Content:          reply,
		Intent:           intent,
		SuggestedActions: suggestedActionsJSON,
	}
	database.DB.Create(aiMsg)

	// 更新会话的 last_message / last_message_at / message_count / title
	now := time.Now()
	updates := map[string]interface{}{
		"last_message":    truncateForPreview(userMessage),
		"last_message_at": now,
	}
	database.DB.Model(&model.ChatSession{}).Where("id = ?", sessionID).
		UpdateColumn("message_count", gorm.Expr("message_count + 2")).
		Updates(updates)

	// 首次消息时生成会话标题（兜底：首条用户消息前 20 字符）
	var session model.ChatSession
	if err := database.DB.Select("id, title, message_count").First(&session, sessionID).Error; err == nil {
		if session.Title == "" {
			title := truncateForTitle(userMessage)
			database.DB.Model(&session).Update("title", title)
		}
	}

	return reply, intent, suggestedActions, nil
}

// buildSystemPrompt 构造系统提示词（精简版，仅注入角色与鉴权上下文，数据快照由工具按需获取）
func (s *ChatService) buildSystemPrompt(childID, familyID uint, userRole string) string {
	var parts []string
	parts = append(parts, "你是「小萌芽」，GrowPocket 的 AI 成长助理，一个温暖的种子精灵。")
	parts = append(parts, "你的角色是陪伴 6-12 岁儿童成长。")
	parts = append(parts, fmt.Sprintf("当前对话者角色：%s（parent=家长，child=儿童）。", userRole))
	parts = append(parts, fmt.Sprintf("当前儿童 ID：%d，家庭 ID：%d。", childID, familyID))
	parts = append(parts, "回答要简洁、温暖、富有鼓励性。")
	parts = append(parts, "如果家长请求设置目标或回顾，你可以调用对应工具协助。")
	parts = append(parts, "注意：当前用户是儿童时，不能执行家长专属操作（设置目标、调整积分、创建周期），若儿童请求这些操作，温柔地告诉他们需要请家长帮忙。")
	return strings.Join(parts, "\n")
}

// executeToolCall 工具调用分发器：根据工具名查找注册项并执行
func (s *ChatService) executeToolCall(ctx context.Context, toolName, argsJSON string, familyID, childID uint, userRole string) (string, error) {
	entry, ok := s.toolRegistry[toolName]
	if !ok {
		return "", fmt.Errorf("工具 %s 未注册", toolName)
	}

	var args map[string]any
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		return "", fmt.Errorf("工具 %s 参数解析失败: %w", toolName, err)
	}

	return entry.Execute(ctx, args, familyID, childID, userRole)
}

// getToolDefinitions 收集已注册工具的定义列表
func (s *ChatService) getToolDefinitions() []ToolDefinition {
	defs := make([]ToolDefinition, 0, len(s.toolRegistry))
	for _, entry := range s.toolRegistry {
		defs = append(defs, entry.Definition)
	}
	return defs
}

// intentFromToolName 从本轮调用的工具名反推 intent（用于前端 IP 表情）
func (s *ChatService) intentFromToolName(toolName string) string {
	switch toolName {
	case "submit_task":
		return "submit_task"
	case "query_child_balance":
		return "query_points"
	case "query_child_scores", "get_current_cycle", "get_growth_timeline", "get_growth_album":
		return "query_ability"
	case "list_tasks", "get_task_detail", "list_master_challenges", "list_activities":
		return "query_task"
	case "list_redeem_items", "list_redeem_records", "redeem_item":
		return "query_reward"
	case "set_stage_goal", "create_cycle", "adjust_score":
		return "parent_set_goal"
	case "list_growth_stories":
		return "parent_review"
	case "":
		return "chat"
	default:
		return "query_task"
	}
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
	if strings.Contains(msg, "精灵") || strings.Contains(msg, "小萌芽") || strings.Contains(msg, "小芽") {
		return "query_sprite"
	}
	if strings.Contains(msg, "奖励") || strings.Contains(msg, "兑换") || strings.Contains(msg, "商城") {
		return "query_reward"
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

// ListSessions 获取儿童的会话列表（按最后消息时间倒序）
func (s *ChatService) ListSessions(childID, familyID uint) ([]model.ChatSession, error) {
	var sessions []model.ChatSession
	err := database.DB.Where("child_id = ? AND family_id = ?", childID, familyID).
		Order("last_message_at DESC").Find(&sessions).Error
	return sessions, err
}

// SearchSessions 搜索会话（匹配标题或最后消息）
func (s *ChatService) SearchSessions(childID, familyID uint, q string) ([]model.ChatSession, error) {
	var sessions []model.ChatSession
	like := "%" + q + "%"
	err := database.DB.Where("child_id = ? AND family_id = ? AND (title LIKE ? OR last_message LIKE ?)", childID, familyID, like, like).
		Order("last_message_at DESC").Find(&sessions).Error
	return sessions, err
}

// GetSessionMessages 获取指定会话的全部消息
func (s *ChatService) GetSessionMessages(sessionID, familyID uint) ([]model.ChatMessage, error) {
	var session model.ChatSession
	if err := database.DB.Where("id = ? AND family_id = ?", sessionID, familyID).First(&session).Error; err != nil {
		return nil, fmt.Errorf("会话不存在")
	}
	return s.GetHistory(sessionID)
}

// truncateForPreview 截断最后消息预览（前 50 字符）
func truncateForPreview(s string) string {
	r := []rune(s)
	if len(r) > 50 {
		return string(r[:50]) + "..."
	}
	return s
}

// truncateForTitle 截断会话标题（前 20 字符）
func truncateForTitle(s string) string {
	r := []rune(s)
	if len(r) > 20 {
		return string(r[:20]) + "..."
	}
	return s
}
