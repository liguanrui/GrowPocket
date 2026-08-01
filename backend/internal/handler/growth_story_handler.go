package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GrowthStoryHandler 成长故事 handler（v3）
type GrowthStoryHandler struct {
	service *service.GrowthStoryService
}

// NewGrowthStoryHandler 创建成长故事 handler
func NewGrowthStoryHandler(svc *service.GrowthStoryService) *GrowthStoryHandler {
	return &GrowthStoryHandler{service: svc}
}

// GenerateStory POST /api/growth-stories/:cycle_id
func (h *GrowthStoryHandler) GenerateStory(c *gin.Context) {
	cycleID64, err := strconv.ParseUint(c.Param("cycle_id"), 10, 32)
	if err != nil || cycleID64 == 0 {
		util.FailBadRequest(c, "无效的周期 ID")
		return
	}
	cycleID := uint(cycleID64)

	var req struct {
		ChildID   uint   `json:"child_id" binding:"required"`
		ChildName string `json:"child_name"` // 可选，未提供时由服务层查数据库
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}

	if middleware.GetRole(c) != "parent" {
		util.FailForbidden(c, "仅家长可生成成长故事")
		return
	}

	familyID := middleware.GetFamilyID(c)
	story, err := h.service.GenerateStory(cycleID, familyID, req.ChildID, req.ChildName)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, story)
}

// GetStory GET /api/growth-stories/:cycle_id
func (h *GrowthStoryHandler) GetStory(c *gin.Context) {
	cycleID64, err := strconv.ParseUint(c.Param("cycle_id"), 10, 32)
	if err != nil || cycleID64 == 0 {
		util.FailBadRequest(c, "无效的周期 ID")
		return
	}
	cycleID := uint(cycleID64)

	story, err := h.service.GetStory(cycleID)
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, story)
}
