package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"
	"strings"

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

// ListStories GET /api/growth-stories?child_id=xxx&page=1&page_size=20
// 查询儿童所有成长故事历史（按时间倒序）
func (h *GrowthStoryHandler) ListStories(c *gin.Context) {
	childID64, err := strconv.ParseUint(c.Query("child_id"), 10, 32)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}
	childID := uint(childID64)
	familyID := middleware.GetFamilyID(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	stories, total, err := h.service.ListStories(childID, familyID, page, pageSize)
	if err != nil {
		util.FailInternal(c, "查询成长故事失败")
		return
	}
	util.OK(c, gin.H{
		"items": stories,
		"total": total,
		"page":  page,
		"page_size": pageSize,
	})
}

// GetCycleTasks GET /api/growth-stories/:cycle_id/tasks
// 查询周期内所有已完成任务（子任务时间线）
func (h *GrowthStoryHandler) GetCycleTasks(c *gin.Context) {
	cycleID64, err := strconv.ParseUint(c.Param("cycle_id"), 10, 32)
	if err != nil || cycleID64 == 0 {
		util.FailBadRequest(c, "无效的周期 ID")
		return
	}
	cycleID := uint(cycleID64)
	familyID := middleware.GetFamilyID(c)

	tasks, err := h.service.GetCycleTasks(cycleID, familyID)
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, tasks)
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
		// 业务校验错误用 400，数据库错误用 500
		msg := err.Error()
		if strings.Contains(msg, "保存成长故事失败") {
			util.FailInternal(c, msg)
		} else {
			util.FailBadRequest(c, msg)
		}
		return
	}
	util.OK(c, story)
}

// GetStory GET /api/growth-stories/:cycle_id
// 注意：路由参数叫 :cycle_id，但语义是成长周期 ID（growth_cycles.id），不是故事主键 id。
// 查询时强制加 family_id 归属校验，防止越权读别家故事。
// project 类型故事（cycle_id=0）不能用此接口，请使用 GetStoryByID。
func (h *GrowthStoryHandler) GetStory(c *gin.Context) {
	cycleID64, err := strconv.ParseUint(c.Param("cycle_id"), 10, 32)
	if err != nil || cycleID64 == 0 {
		util.FailBadRequest(c, "无效的周期 ID")
		return
	}
	cycleID := uint(cycleID64)
	familyID := middleware.GetFamilyID(c)

	story, err := h.service.GetStory(cycleID, familyID)
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, story)
}

// GetStoryByID GET /api/growth-stories/by-id/:story_id
// 按成长故事主键 ID 查询（支持 cycle 类型 + project 类型的通用查询接口）
// 强制加 family_id 归属校验，防止越权读别家故事。
func (h *GrowthStoryHandler) GetStoryByID(c *gin.Context) {
	storyID64, err := strconv.ParseUint(c.Param("story_id"), 10, 32)
	if err != nil || storyID64 == 0 {
		util.FailBadRequest(c, "无效的故事 ID")
		return
	}
	storyID := uint(storyID64)
	familyID := middleware.GetFamilyID(c)

	story, err := h.service.GetStoryByID(storyID, familyID)
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, story)
}
