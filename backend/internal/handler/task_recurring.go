package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"

	"github.com/gin-gonic/gin"
)

type TaskRecurringHandler struct {
	service *service.TaskRecurringService
}

func NewTaskRecurringHandler() *TaskRecurringHandler {
	return &TaskRecurringHandler{
		service: service.NewTaskRecurringService(),
	}
}

type createRecurringConfigReq struct {
	TemplateID    uint   `json:"template_id"`
	ChildID       uint   `json:"child_id" binding:"required"`
	Title         string `json:"title" binding:"required"`
	Description   string `json:"description"`
	Points        int    `json:"points" binding:"required"`
	Frequency     string `json:"frequency"`
	WeekDays      string `json:"week_days"`
}

func (h *TaskRecurringHandler) CreateRecurringConfig(c *gin.Context) {
	var req createRecurringConfigReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	childService := service.NewChildService()
	child, err := childService.GetChild(req.ChildID, middleware.GetFamilyID(c))
	if err != nil {
		util.FailForbidden(c, "孩子档案不存在或不属于当前家庭")
		return
	}

	config, err := h.service.CreateRecurringConfig(service.CreateRecurringConfigInput{
		FamilyID:      middleware.GetFamilyID(c),
		TemplateID:    req.TemplateID,
		ChildID:       req.ChildID,
		ChildName:     child.Nickname,
		Title:         req.Title,
		Description:   req.Description,
		Points:        req.Points,
		Frequency:     req.Frequency,
		WeekDays:      req.WeekDays,
		CreatedBy:     middleware.GetUserID(c),
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, config)
}

func (h *TaskRecurringHandler) ListRecurringConfigs(c *gin.Context) {
	configs, err := h.service.ListRecurringConfigs(middleware.GetFamilyID(c))
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if configs == nil {
		configs = make([]model.TaskRecurringConfig, 0)
	}
	util.OK(c, configs)
}

func (h *TaskRecurringHandler) GetRecurringConfig(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}
	config, err := h.service.GetRecurringConfig(id, middleware.GetFamilyID(c))
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, config)
}

type updateRecurringConfigReq struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Frequency   *string `json:"frequency"`
	WeekDays    *string `json:"week_days"`
	Points      *int    `json:"points"`
	IsActive    *bool   `json:"is_active"`
}

func (h *TaskRecurringHandler) UpdateRecurringConfig(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	var req updateRecurringConfigReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	config, err := h.service.UpdateRecurringConfig(
		id,
		middleware.GetFamilyID(c),
		req.Title,
		req.Description,
		req.Frequency,
		req.WeekDays,
		req.Points,
		req.IsActive,
	)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, config)
}

func (h *TaskRecurringHandler) DeleteRecurringConfig(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}
	if err := h.service.DeleteRecurringConfig(id, middleware.GetFamilyID(c)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, nil)
}

func (h *TaskRecurringHandler) GenerateTasks(c *gin.Context) {
	if err := h.service.GenerateRecurringTasks(middleware.GetFamilyID(c)); err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{"message": "循环任务已生成"})
}
