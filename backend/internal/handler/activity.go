package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type ActivityHandler struct {
	service *service.ActivityService
}

func NewActivityHandler() *ActivityHandler {
	return &ActivityHandler{
		service: service.NewActivityService(),
	}
}

type createActivityReq struct {
	Title           string `json:"title"`
	ActivityType    int    `json:"activity_type"`
	Description     string `json:"description"`
	Location        string `json:"location"`
	ContactPhone    string `json:"contact_phone"`
	EventTime       string `json:"event_time"` // ISO 格式
	MaxParticipants int    `json:"max_participants"`
	Points          int    `json:"points"`
}

func (h *ActivityHandler) CreateActivity(c *gin.Context) {
	var req createActivityReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误")
		return
	}

	eventTime, err := time.Parse(time.RFC3339, req.EventTime)
	if err != nil {
		eventTime, _ = time.Parse("2006-01-02 15:04:05", req.EventTime)
	}
	if eventTime.IsZero() {
		eventTime = time.Now().AddDate(0, 0, 7) // 默认一周后
	}

	familyID := middleware.GetFamilyID(c)
	userID := middleware.GetUserID(c)
	nickname := middleware.GetNickname(c)

	activity, err := h.service.CreateActivity(service.CreateActivityInput{
		FamilyID:         familyID,
		UserID:           userID,
		Nickname:         nickname,
		Title:            req.Title,
		ActivityType:     req.ActivityType,
		Description:      req.Description,
		Location:         req.Location,
		ContactPhone:     req.ContactPhone,
		EventTime:        eventTime,
		MaxParticipants:  req.MaxParticipants,
		Points:           req.Points,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, activity)
}

func (h *ActivityHandler) ListActivities(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	typeParam, _ := strconv.Atoi(c.DefaultQuery("type", "0"))

	activities, total, err := h.service.ListActivities(service.ListActivitiesParams{
		Page:     page,
		PageSize: pageSize,
		Type:     typeParam,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, gin.H{
		"items":      activities,
		"total":      total,
		"page":       page,
		"page_size":  pageSize,
	})
}

func (h *ActivityHandler) GetActivity(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	activity, err := h.service.GetActivity(uint(id))
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}

	participants, _ := h.service.GetParticipants(uint(id))
	util.OK(c, gin.H{
		"activity":     activity,
		"participants": participants,
	})
}

func (h *ActivityHandler) JoinActivity(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	// 获取 child_id 参数
	childIDStr := c.Query("child_id")
	if childIDStr == "" {
		util.FailBadRequest(c, "请选择孩子")
		return
	}
	childID, err := strconv.ParseUint(childIDStr, 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的孩子ID")
		return
	}

	familyID := middleware.GetFamilyID(c)

	participant, err := h.service.JoinActivity(uint(id), familyID, uint(childID))
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, participant)
}

type completeActivityReq struct {
	ChildID uint   `json:"child_id"` // 必填，完成的孩子ID
	Photo   string `json:"photo"`
}

func (h *ActivityHandler) CompleteActivity(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	var req completeActivityReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误")
		return
	}

	if req.ChildID == 0 {
		util.FailBadRequest(c, "请选择孩子")
		return
	}

	familyID := middleware.GetFamilyID(c)
	points, err := h.service.CompleteActivity(uint(id), familyID, req.ChildID, req.Photo)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, gin.H{"points_earned": points, "success": true})
}

func (h *ActivityHandler) DeleteActivity(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	familyID := middleware.GetFamilyID(c)
	if err := h.service.DeleteActivity(uint(id), familyID); err != nil {
		util.FailForbidden(c, err.Error())
		return
	}
	util.OK(c, gin.H{"success": true})
}

func (h *ActivityHandler) ListMyActivities(c *gin.Context) {
	familyID := middleware.GetFamilyID(c)
	activities, err := h.service.ListMyActivities(familyID)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"items": activities, "total": len(activities)})
}
