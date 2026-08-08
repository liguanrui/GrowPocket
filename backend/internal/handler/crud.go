package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ======================== 自定义勋章 CRUD ========================

type createAchievementReq struct {
	Name        string `json:"name" binding:"required,max=50"`
	Description string `json:"description" binding:"max=200"`
	Icon        string `json:"icon" binding:"required,max=100"`
	IconColor   string `json:"icon_color" binding:"max=20"`
	Type        int    `json:"type" binding:"required,min=1,max=7"`
	TargetValue int    `json:"target_value" binding:"min=0"`
	TemplateID  int    `json:"template_id"`
	Points      int    `json:"points" binding:"min=0"`
}

func (h *AchievementHandler) CreateAchievement(c *gin.Context) {
	var req createAchievementReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	achievement, err := h.service.CreateAchievement(
		middleware.GetFamilyID(c),
		middleware.GetUserID(c),
		req.Name,
		req.Description,
		req.Icon,
		req.IconColor,
		req.Type,
		req.TargetValue,
		req.TemplateID,
		req.Points,
	)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, achievement)
}

type updateAchievementReq struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Icon        *string `json:"icon"`
	IconColor   *string `json:"icon_color"`
	Type        *int    `json:"type"`
	TargetValue *int    `json:"target_value"`
	TemplateID  *int    `json:"template_id"`
	Points      *int    `json:"points"`
}

func (h *AchievementHandler) UpdateAchievement(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	var req updateAchievementReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	achievement, err := h.service.UpdateAchievement(
		id,
		middleware.GetFamilyID(c),
		req.Name,
		req.Description,
		req.Icon,
		req.IconColor,
		req.Type,
		req.TargetValue,
		req.TemplateID,
		req.Points,
	)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, achievement)
}

func (h *AchievementHandler) DeleteAchievement(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	if err := h.service.DeleteAchievement(id, middleware.GetFamilyID(c)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, nil)
}

// ======================== 任务模板 CRUD ========================

type TaskTemplateHandler struct {
	service *service.TaskTemplateService
}

func NewTaskTemplateHandler() *TaskTemplateHandler {
	return &TaskTemplateHandler{
		service: service.NewTaskTemplateService(),
	}
}

type createTaskTemplateReq struct {
	Title              string `json:"title" binding:"required,max=200"`
	Description        string `json:"description"`
	Points             int    `json:"points" binding:"min=0"`
	Icon               string `json:"icon" binding:"max=50"`
	Category           string `json:"category" binding:"max=50"`
	SortOrder          int    `json:"sort_order"`
	MinAge             int    `json:"min_age"`
	MaxAge             int    `json:"max_age"`
	EstimatedTime      int    `json:"estimated_time"`
	Difficulty         string `json:"difficulty"`
	Frequency          string `json:"frequency"`
	Tags               string `json:"tags"`
	AbilityDimensionID uint   `json:"ability_dimension_id"`
	TemplateType       string `json:"template_type"`  // daily/habit/parent
	EstimatedDays      int    `json:"estimated_days"` // 仅 parent
	KeyMilestones      string `json:"key_milestones"` // 仅 parent JSON
}

func (h *TaskTemplateHandler) CreateTemplate(c *gin.Context) {
	var req createTaskTemplateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	template, err := h.service.CreateTemplate(
		middleware.GetFamilyID(c),
		middleware.GetUserID(c),
		req.Title,
		req.Description,
		req.Icon,
		req.Category,
		req.Points,
		req.SortOrder,
		req.MinAge,
		req.MaxAge,
		req.EstimatedTime,
		req.Difficulty,
		req.Frequency,
		req.Tags,
		req.AbilityDimensionID,
		req.TemplateType,
		req.EstimatedDays,
		req.KeyMilestones,
	)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, template)
}

type updateTaskTemplateReq struct {
	Title              *string `json:"title"`
	Description        *string `json:"description"`
	Points             *int    `json:"points"`
	Icon               *string `json:"icon"`
	Category           *string `json:"category"`
	Difficulty         *string `json:"difficulty"`
	Frequency          *string `json:"frequency"`
	Tags               *string `json:"tags"`
	SortOrder          *int    `json:"sort_order"`
	MinAge             *int    `json:"min_age"`
	MaxAge             *int    `json:"max_age"`
	EstimatedTime      *int    `json:"estimated_time"`
	IsActive           *bool   `json:"is_active"`
	AbilityDimensionID *uint   `json:"ability_dimension_id"`
	TemplateType       *string `json:"template_type"`
	EstimatedDays      *int    `json:"estimated_days"`
	KeyMilestones      *string `json:"key_milestones"`
}

func (h *TaskTemplateHandler) UpdateTemplate(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	var req updateTaskTemplateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	template, err := h.service.UpdateTemplate(
		id,
		middleware.GetFamilyID(c),
		req.Title,
		req.Description,
		req.Icon,
		req.Category,
		req.Difficulty,
		req.Frequency,
		req.Tags,
		req.Points,
		req.SortOrder,
		req.MinAge,
		req.MaxAge,
		req.EstimatedTime,
		req.IsActive,
		req.AbilityDimensionID,
		req.TemplateType,
		req.EstimatedDays,
		req.KeyMilestones,
	)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, template)
}

func (h *TaskTemplateHandler) DeleteTemplate(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	if err := h.service.DeleteTemplate(id, middleware.GetFamilyID(c)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, nil)
}

func (h *TaskTemplateHandler) ListTemplates(c *gin.Context) {
	familyID := middleware.GetFamilyID(c)
	// A 筛选：支持 dimension_id / is_system / age / category 查询参数
	filter := &service.TemplateFilter{}
	hasFilter := false
	if dimStr := c.Query("dimension_id"); dimStr != "" {
		if dimID, err := strconv.ParseUint(dimStr, 10, 64); err == nil {
			d := uint(dimID)
			filter.DimensionID = &d
			hasFilter = true
		}
	}
	if sysStr := c.Query("is_system"); sysStr != "" {
		isSys := sysStr == "true" || sysStr == "1"
		filter.IsSystem = &isSys
		hasFilter = true
	}
	if ageStr := c.Query("age"); ageStr != "" {
		if age, err := strconv.Atoi(ageStr); err == nil {
			filter.AgeMin = &age
			filter.AgeMax = &age
			hasFilter = true
		}
	}
	if catStr := c.Query("category"); catStr != "" {
		filter.Category = &catStr
		hasFilter = true
	}
	if ttStr := c.Query("template_type"); ttStr != "" {
		filter.TemplateType = &ttStr
		hasFilter = true
	}
	var fptr *service.TemplateFilter
	if hasFilter {
		fptr = filter
	}
	templates, err := h.service.ListTemplates(familyID, fptr)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if templates == nil {
		templates = make([]model.TaskTemplate, 0)
	}
	util.OK(c, templates)
}

func (h *TaskTemplateHandler) GetTemplate(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	template, err := h.service.GetTemplate(id, middleware.GetFamilyID(c))
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, template)
}

type createFromTemplateReq struct {
	ChildID uint `json:"child_id" binding:"required"`
}

func (h *TaskTemplateHandler) CreateTaskFromTemplate(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	var req createFromTemplateReq
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

	task, err := h.service.CreateTaskFromTemplate(
		id,
		middleware.GetFamilyID(c),
		req.ChildID,
		child.Nickname,
		middleware.GetUserID(c),
	)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, task)
}

// ===== B 恢复系统默认模板 =====

func (h *TaskTemplateHandler) ResetSystemTemplate(c *gin.Context) {
	title := c.Query("title")
	if title == "" {
		util.FailBadRequest(c, "title 参数不能为空")
		return
	}
	if err := h.service.ResetSystemTemplate(middleware.GetFamilyID(c), title); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"message": "已恢复为系统默认"})
}

func (h *TaskTemplateHandler) RestoreAllSystemTemplates(c *gin.Context) {
	restored, err := h.service.RestoreAllSystemTemplates(middleware.GetFamilyID(c))
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{"restored": restored})
}

// ===== C 按维度批量启停 =====

type batchToggleReq struct {
	DimensionID uint `json:"dimension_id" binding:"required"`
	IsActive    bool `json:"is_active"`
}

func (h *TaskTemplateHandler) BatchToggleByDimension(c *gin.Context) {
	var req batchToggleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}
	affected, err := h.service.BatchToggleByDimension(middleware.GetFamilyID(c), req.DimensionID, req.IsActive)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{"affected": affected})
}

// C 多选批量启停
type batchToggleByIDsReq struct {
	IDs      []uint `json:"ids" binding:"required"`
	IsActive bool   `json:"is_active"`
}

func (h *TaskTemplateHandler) BatchToggleByIDs(c *gin.Context) {
	var req batchToggleByIDsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}
	affected, err := h.service.BatchToggleByIDs(middleware.GetFamilyID(c), req.IDs, req.IsActive)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{"affected": affected})
}

// ===== D 模板广场 =====

func (h *TaskTemplateHandler) ShareToPlaza(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}
	plaza, err := h.service.ShareToPlaza(middleware.GetFamilyID(c), id, middleware.GetUserID(c))
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, plaza)
}

func (h *TaskTemplateHandler) ListPlaza(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	var dimID *uint
	if dimStr := c.Query("dimension_id"); dimStr != "" {
		if d, err := strconv.ParseUint(dimStr, 10, 64); err == nil {
			dd := uint(d)
			dimID = &dd
		}
	}
	list, total, err := h.service.ListPlaza(dimID, page, size)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{"list": list, "total": total, "page": page, "size": size})
}

func (h *TaskTemplateHandler) ImportFromPlaza(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}
	tpl, err := h.service.ImportFromPlaza(middleware.GetFamilyID(c), middleware.GetUserID(c), id)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, tpl)
}

