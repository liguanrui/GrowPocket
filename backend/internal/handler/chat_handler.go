package handler

import (
	"growpocket/internal/database"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
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

	// 如果没有 session_id，创建新会话
	sessionID := req.SessionID
	if sessionID == 0 {
		session, err := h.chatService.CreateSession(familyID, req.ChildID, userID, role)
		if err != nil {
			util.FailInternal(c, "创建会话失败")
			return
		}
		sessionID = session.ID
	}

	reply, intent, err := h.chatService.SendMessage(sessionID, role, req.ChildID, familyID, req.Message)
	if err != nil {
		util.FailInternal(c, "AI 回复失败: "+err.Error())
		return
	}

	util.OK(c, gin.H{
		"reply":      reply,
		"intent":     intent,
		"session_id": sessionID,
	})
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
