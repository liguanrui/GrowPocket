package handler

import (
	"encoding/json"
	"growpocket/internal/database"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"log"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ChatHandler struct {
	chatService *service.ChatService
}

func NewChatHandler(chatService *service.ChatService) *ChatHandler {
	return &ChatHandler{chatService: chatService}
}

// SendMessage POST /api/chat/message
func (h *ChatHandler) SendMessage(c *gin.Context) {
	var req struct {
		Message   string `json:"message" binding:"required"`
		SessionID uint   `json:"session_id"`
		ChildID   uint   `json:"child_id" binding:"required"`
		Mode      string `json:"mode"` // parent=家长代聊 / child=儿童本人；空值按 role 推断
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 message 和 child_id")
		return
	}

	userID := middleware.GetUserID(c)
	familyID := middleware.GetFamilyID(c)

	// 查询用户角色
	var user model.User
	if err := database.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		util.FailUnauthorized(c, "用户不存在")
		return
	}
	role := user.Role
	if role == "" {
		role = "parent"
	}

	// 规范化 mode：儿童角色强制 child 模式（防止伪造）
	mode := req.Mode
	if role == "child" {
		mode = "child"
	} else if mode != "child" {
		mode = "parent"
	}

	// 如果没有 session_id，创建新会话
	sessionID := req.SessionID
	if sessionID == 0 {
		session, err := h.chatService.CreateSession(familyID, req.ChildID, userID, role, mode)
		if err != nil {
			util.FailInternal(c, "创建会话失败")
			return
		}
		sessionID = session.ID
	}

	reply, intent, suggestedActions, err := h.chatService.SendMessage(sessionID, role, req.ChildID, familyID, req.Message, mode)
	if err != nil {
		log.Printf("[Chat] SendMessage 失败 session=%d child=%d family=%d role=%s mode=%s msg=%q err=%v",
			sessionID, req.ChildID, familyID, role, mode, req.Message, err)
		util.FailInternal(c, "AI 回复失败: "+err.Error())
		return
	}

	util.OK(c, gin.H{
		"reply":             reply,
		"intent":            intent,
		"session_id":        sessionID,
		"suggested_actions": suggestedActions,
	})
}

// ConfirmMessage POST /api/chat/message/confirm
// 前端在用户对 suggested_action 确认卡片做出操作（确认/取消）后回调，
// 仅记录审计日志，不执行写操作（写操作已由前端直接调 REST API 完成）。
func (h *ChatHandler) ConfirmMessage(c *gin.Context) {
	var req struct {
		MessageID   uint           `json:"message_id"`
		Action      string         `json:"action" binding:"required"`
		Params      map[string]any `json:"params"`
		Result      string         `json:"result"`       // success/failed/cancelled/expired
		APIResponse map[string]any `json:"api_response"` // 前端调 REST API 的响应
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 action")
		return
	}

	userID := middleware.GetUserID(c)
	familyID := middleware.GetFamilyID(c)

	// 通过 message_id 反查 session_id 与 child_id（校验该消息属于当前家庭）
	var msg model.ChatMessage
	var sessionID uint
	var childID uint
	if req.MessageID > 0 {
		if err := database.DB.First(&msg, req.MessageID).Error; err == nil {
			var session model.ChatSession
			if database.DB.Where("id = ? AND family_id = ?", msg.SessionID, familyID).First(&session).Error == nil {
				sessionID = session.ID
				childID = session.ChildID
			}
		}
	}

	// 从 api_response 中提取错误信息
	var errMsg string
	if req.APIResponse != nil {
		if e, ok := req.APIResponse["error"].(string); ok && e != "" {
			errMsg = e
		}
		if e, ok := req.APIResponse["message"].(string); ok && e != "" && errMsg == "" {
			errMsg = e
		}
	}

	paramsJSON := ""
	if req.Params != nil {
		if bs, err := json.Marshal(req.Params); err == nil {
			paramsJSON = string(bs)
		}
	}

	auditLog := &model.AIAuditLog{
		FamilyID:     familyID,
		ChildID:      childID,
		UserID:       userID,
		SessionID:    sessionID,
		MessageID:    req.MessageID,
		ToolName:     req.Action,
		Params:       paramsJSON,
		Result:       req.Result,
		ErrorMessage: errMsg,
	}
	if err := database.DB.Create(auditLog).Error; err != nil {
		util.FailInternal(c, "记录审计日志失败")
		return
	}

	util.OK(c, gin.H{"id": auditLog.ID})
}

// GetHistory GET /api/chat/history/:child_id
func (h *ChatHandler) GetHistory(c *gin.Context) {
	childID, err := strconv.ParseUint(c.Param("child_id"), 10, 32)
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "无效的 child_id")
		return
	}
	familyID := middleware.GetFamilyID(c)

	// 查找该儿童最近的会话
	var session model.ChatSession
	if err := database.DB.Where("child_id = ? AND family_id = ?", childID, familyID).Order("created_at DESC").First(&session).Error; err != nil {
		util.OK(c, gin.H{"messages": []interface{}{}, "session_id": 0})
		return
	}

	messages, err := h.chatService.GetHistory(session.ID)
	if err != nil {
		util.FailInternal(c, "获取历史失败")
		return
	}
	util.OK(c, gin.H{"messages": messages, "session_id": session.ID})
}

// ListSessions GET /api/chat/sessions?child_id=xxx
// 获取儿童的会话列表（按最后消息时间倒序）
func (h *ChatHandler) ListSessions(c *gin.Context) {
	childID64, err := strconv.ParseUint(c.Query("child_id"), 10, 32)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}
	childID := uint(childID64)
	familyID := middleware.GetFamilyID(c)

	sessions, err := h.chatService.ListSessions(childID, familyID)
	if err != nil {
		util.FailInternal(c, "查询会话列表失败")
		return
	}
	util.OK(c, sessions)
}

// SearchSessions GET /api/chat/sessions/search?child_id=xxx&q=xxx
// 搜索会话（匹配标题或最后消息）
func (h *ChatHandler) SearchSessions(c *gin.Context) {
	childID64, err := strconv.ParseUint(c.Query("child_id"), 10, 32)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}
	childID := uint(childID64)
	familyID := middleware.GetFamilyID(c)
	q := c.Query("q")

	sessions, err := h.chatService.SearchSessions(childID, familyID, q)
	if err != nil {
		util.FailInternal(c, "搜索会话失败")
		return
	}
	util.OK(c, sessions)
}

// CreateSession POST /api/chat/sessions
// 主动新建会话
func (h *ChatHandler) CreateSession(c *gin.Context) {
	var req struct {
		ChildID uint   `json:"child_id" binding:"required"`
		Mode    string `json:"mode"` // parent/child；空值按 role 推断
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}
	userID := middleware.GetUserID(c)
	familyID := middleware.GetFamilyID(c)

	var user model.User
	if err := database.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		util.FailUnauthorized(c, "用户不存在")
		return
	}
	role := user.Role
	if role == "" {
		role = "parent"
	}

	// 规范化 mode：儿童角色强制 child 模式
	mode := req.Mode
	if role == "child" {
		mode = "child"
	} else if mode != "child" {
		mode = "parent"
	}

	session, err := h.chatService.CreateSession(familyID, req.ChildID, userID, role, mode)
	if err != nil {
		util.FailInternal(c, "创建会话失败")
		return
	}
	util.OK(c, session)
}

// GetSessionMessages GET /api/chat/sessions/:id/messages
// 获取指定会话的全部消息
func (h *ChatHandler) GetSessionMessages(c *gin.Context) {
	sessionID64, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || sessionID64 == 0 {
		util.FailBadRequest(c, "无效的会话 ID")
		return
	}
	sessionID := uint(sessionID64)
	familyID := middleware.GetFamilyID(c)

	messages, err := h.chatService.GetSessionMessages(sessionID, familyID)
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, messages)
}
