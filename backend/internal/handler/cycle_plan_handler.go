package handler

import (
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// CyclePlanHandler Cycle 课程表 Handler（V1.3 Task 9）
type CyclePlanHandler struct {
	service *service.CyclePlanService
}

// NewCyclePlanHandler 构造函数
func NewCyclePlanHandler() *CyclePlanHandler {
	return &CyclePlanHandler{service: service.NewCyclePlanService()}
}

// Preview GET /api/cycle-plans/preview - 拉取周期课程表预览
// Query 参数: child_id (必填), start_monday (必填, yyyy-mm-dd), cycle_length_weeks (可选)
func (h *CyclePlanHandler) Preview(c *gin.Context) {
	childID, err := strconv.ParseUint(c.Query("child_id"), 10, 32)
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "请提供有效的 child_id")
		return
	}

	startMondayStr := c.Query("start_monday")
	if startMondayStr == "" {
		util.FailBadRequest(c, "请提供 start_monday (yyyy-mm-dd)")
		return
	}
	startMonday, err := time.Parse("2006-01-02", startMondayStr)
	if err != nil {
		util.FailBadRequest(c, "start_monday 格式错误,需为 yyyy-mm-dd")
		return
	}

	// cycle_length_weeks 可选,默认 0 表示从 goals 读取
	var cycleLengthWeeks uint = 0
	if clwStr := c.Query("cycle_length_weeks"); clwStr != "" {
		clw, err := strconv.ParseUint(clwStr, 10, 32)
		if err != nil || clw < 1 || clw > 4 {
			util.FailBadRequest(c, "cycle_length_weeks 必须为 1/2/3/4")
			return
		}
		cycleLengthWeeks = uint(clw)
	}

	preview, err := h.service.GetPreview(uint(childID), startMonday, cycleLengthWeeks)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, preview)
}

// LockCyclePlanRequest 锁版确认请求体
type LockCyclePlanRequest struct {
	LockVersion    uint   `json:"lock_version" binding:"required"`
	Action         string `json:"action" binding:"required"` // "lock" 或 "unlock"
	LockedByParent uint   `json:"locked_by_parent_id" binding:"required"`
}

// Lock POST /api/cycle-plans/:id/lock - 锁版确认
func (h *CyclePlanHandler) Lock(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		util.FailBadRequest(c, "无效的周期计划 ID")
		return
	}

	var req LockCyclePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 lock_version, action, locked_by_parent_id")
		return
	}

	switch req.Action {
	case "lock":
		plan, err := h.service.LockCyclePlan(uint(id), req.LockVersion, req.LockedByParent)
		if err != nil {
			util.FailInternal(c, err.Error())
			return
		}
		util.OK(c, gin.H{
			"status":       plan.Status,
			"lock_version": plan.LockVersion,
		})
	case "unlock":
		plan, err := h.service.UnlockCyclePlan(uint(id), req.LockVersion)
		if err != nil {
			util.FailInternal(c, err.Error())
			return
		}
		util.OK(c, gin.H{
			"status":       plan.Status,
			"lock_version": plan.LockVersion,
		})
	default:
		util.FailBadRequest(c, "action 必须为 lock 或 unlock")
	}
}

// RegenerateRequest 重新生成请求体
type RegenerateRequest struct {
	LockVersion      uint   `json:"lock_version" binding:"required"`
	ForceDimOverride []uint `json:"force_dim_override"` // 可选
}

// Regenerate POST /api/cycle-plans/:id/regenerate - 重新生成
func (h *CyclePlanHandler) Regenerate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		util.FailBadRequest(c, "无效的周期计划 ID")
		return
	}

	var req RegenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 lock_version")
		return
	}

	plan, err := h.service.Regenerate(uint(id))
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, plan)
}

// TaskAdjustRequest 单任务 5 类调整请求体
type TaskAdjustRequest struct {
	DailyTaskInstanceID   uint   `json:"daily_task_instance_id" binding:"required"`
	Operation             string `json:"operation" binding:"required"` // lock/replace/add/remove/escalate_supervision
	NewSupervision        *struct {
		Level           string `json:"level"` // confirm/accompany/doorstep
		SignOffRequired bool   `json:"sign_off_required"`
	} `json:"new_supervision"`
	ReplaceWithTemplateID *uint `json:"replace_with_template_id"`
	AddTemplateID         *uint `json:"add_template_id"`
}

// TaskAdjust POST /api/cycle-plans/:id/task-adjust - 单任务 5 类调整
func (h *CyclePlanHandler) TaskAdjust(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		util.FailBadRequest(c, "无效的周期计划 ID")
		return
	}

	var req TaskAdjustRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 daily_task_instance_id, operation")
		return
	}

	// 构建 service 参数 map
	params := map[string]interface{}{}
	if req.ReplaceWithTemplateID != nil {
		params["new_task_id"] = float64(*req.ReplaceWithTemplateID)
		params["task_id"] = float64(*req.ReplaceWithTemplateID)
	}
	if req.AddTemplateID != nil {
		params["task_id"] = float64(*req.AddTemplateID)
	}
	if req.NewSupervision != nil {
		params["new_supervision"] = req.NewSupervision
	}

	plan, err := h.service.TaskAdjust(uint(id), req.DailyTaskInstanceID, req.Operation, params)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, plan)
}

// ReplaceCandidates GET /api/cycle-plans/replace-candidates - 拉取替换候选
// Query 参数: child_id, task_id, date, dimension_id, difficulty
func (h *CyclePlanHandler) ReplaceCandidates(c *gin.Context) {
	childID, err := strconv.ParseUint(c.Query("child_id"), 10, 32)
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "请提供有效的 child_id")
		return
	}

	taskID, err := strconv.ParseUint(c.Query("task_id"), 10, 32)
	if err != nil || taskID == 0 {
		util.FailBadRequest(c, "请提供有效的 task_id")
		return
	}

	var date time.Time
	dateStr := c.Query("date")
	if dateStr != "" {
		date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			util.FailBadRequest(c, "date 格式错误,需为 yyyy-mm-dd")
			return
		}
	}

	var dimensionID uint = 0
	if dimStr := c.Query("dimension_id"); dimStr != "" {
		dim, err := strconv.ParseUint(dimStr, 10, 32)
		if err == nil {
			dimensionID = uint(dim)
		}
	}

	difficulty := c.Query("difficulty")

	candidates, err := h.service.GetReplaceCandidates(uint(childID), uint(taskID), date, dimensionID, difficulty)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, candidates)
}

// ToggleThemeWeekRequest 主题周开关 + 位置调整请求体
type ToggleThemeWeekRequest struct {
	ThemeDimID uint   `json:"theme_dim"`  // 0 表示关闭
	StartDate  string `json:"start_date"`
	EndDate    string `json:"end_date"`
	Position   string `json:"position"` // week1/week2/week3/week4 (V1.3 新增)
	Enable     bool   `json:"enable"`
}

// ToggleThemeWeek POST /api/cycle-plans/:id/toggle-theme-week - 主题周开关 + 位置调整
func (h *CyclePlanHandler) ToggleThemeWeek(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		util.FailBadRequest(c, "无效的周期计划 ID")
		return
	}

	var req ToggleThemeWeekRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请求体解析失败")
		return
	}

	plan, err := h.service.ToggleThemeWeek(uint(id), req.ThemeDimID, req.Position, req.Enable)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, plan)
}

// ExportPDF GET /api/cycle-plans/:id/export-pdf - 导出 PDF（占位实现）
func (h *CyclePlanHandler) ExportPDF(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		util.FailBadRequest(c, "无效的周期计划 ID")
		return
	}

	c.Header("Content-Type", "application/json")
	c.JSON(200, gin.H{
		"message":       "PDF 导出功能待实现",
		"cycle_plan_id": uint(id),
	})
}
