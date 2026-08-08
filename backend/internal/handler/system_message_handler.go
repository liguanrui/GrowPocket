package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type SystemMessageHandler struct {
	svc *service.SystemMessageService
}

func NewSystemMessageHandler() *SystemMessageHandler {
	return &SystemMessageHandler{svc: service.NewSystemMessageService()}
}

// List GET /api/messages?page=&page_size=&unread_only=
func (h *SystemMessageHandler) List(c *gin.Context) {
	familyID := middleware.GetFamilyID(c)
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "30"))
	unreadOnly := c.Query("unread_only") == "1" || c.Query("unread_only") == "true"

	items, total, err := h.svc.List(service.ListMessagesParams{
		FamilyID:   familyID,
		UserID:     userID,
		UnreadOnly: unreadOnly,
		Page:       page,
		PageSize:   pageSize,
	})
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{"items": items, "total": total, "page": page, "page_size": pageSize})
}

// UnreadCount GET /api/messages/unread-count
func (h *SystemMessageHandler) UnreadCount(c *gin.Context) {
	familyID := middleware.GetFamilyID(c)
	userID := middleware.GetUserID(c)
	count, err := h.svc.UnreadCount(familyID, userID)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{"count": count})
}

// MarkRead POST /api/messages/:id/read
func (h *SystemMessageHandler) MarkRead(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的消息 ID")
		return
	}
	if err := h.svc.MarkRead(uint(id), middleware.GetFamilyID(c), middleware.GetUserID(c)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"success": true})
}

// MarkAllRead POST /api/messages/read-all
func (h *SystemMessageHandler) MarkAllRead(c *gin.Context) {
	if err := h.svc.MarkAllRead(middleware.GetFamilyID(c), middleware.GetUserID(c)); err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{"success": true})
}
