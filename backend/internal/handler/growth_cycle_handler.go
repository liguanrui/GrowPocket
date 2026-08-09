package handler

import (
	"errors"
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"log"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type GrowthCycleHandler struct {
	service      *service.GrowthCycleService
	habitService *service.HabitService // 用于设置习惯目标后立即生成当日习惯任务
}

func NewGrowthCycleHandler() *GrowthCycleHandler {
	return &GrowthCycleHandler{
		service:      service.NewGrowthCycleService(),
		habitService: service.NewHabitService(nil), // 降级模式，不调AI
	}
}

// CreateCycle POST /api/growth-cycles
func (h *GrowthCycleHandler) CreateCycle(c *gin.Context) {
	var req struct {
		ChildID   uint   `json:"child_id" binding:"required"`
		Name      string `json:"name"`
		StartDate string `json:"start_date" binding:"required"` // RFC3339
		EndDate   string `json:"end_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 child_id, start_date, end_date")
		return
	}
	familyID := middleware.GetFamilyID(c)
	startDate, err := time.Parse(time.RFC3339, req.StartDate)
	if err != nil {
		util.FailBadRequest(c, "start_date 格式错误")
		return
	}
	endDate, err := time.Parse(time.RFC3339, req.EndDate)
	if err != nil {
		util.FailBadRequest(c, "end_date 格式错误")
		return
	}
	name := req.Name
	if name == "" {
		name = "成长周期"
	}
	cycle, err := h.service.CreateCycle(familyID, req.ChildID, name, startDate, endDate)
	if err != nil {
		if err.Error() == "孩子档案不存在" || err.Error() == "结束日期不能早于开始日期" || err.Error() == "周期长度需在 1-4 周之间" {
			util.FailBadRequest(c, err.Error())
			return
		}
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, cycle)
}

// SetGoalsBatch POST /api/growth/goals/batch
// 批量设置阶段目标（支持 dimension/habit/parent_task 三种类型）
func (h *GrowthCycleHandler) SetGoalsBatch(c *gin.Context) {
	var req struct {
		CycleID uint                `json:"cycle_id" binding:"required"`
		ChildID uint                `json:"child_id" binding:"required"`
		Goals   []service.GoalInput `json:"goals" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 cycle_id, child_id, goals")
		return
	}
	if len(req.Goals) == 0 {
		util.FailBadRequest(c, "goals 不能为空")
		return
	}
	if middleware.GetRole(c) != "parent" {
		util.FailForbidden(c, "仅家长可设置阶段目标")
		return
	}
	familyID := middleware.GetFamilyID(c)
	goals, err := h.service.SetGoalsBatch(req.CycleID, familyID, req.ChildID, req.Goals)
	if err != nil {
		// 区分参数校验错误（400）和服务器错误（500）
		if errors.Is(err, service.ErrInvalidGoalInput) {
			util.FailBadRequest(c, err.Error())
			return
		}
		util.FailInternal(c, err.Error())
		return
	}

	// 兜底：若本次设置包含 habit 类型目标，立即生成当日习惯打卡任务
	// 避免用户需等到 08:00 定时任务或重启后端才能看到习惯任务
	hasHabitGoal := false
	for _, g := range req.Goals {
		if g.GoalType == "habit" {
			hasHabitGoal = true
			break
		}
	}
	if hasHabitGoal && h.habitService != nil {
		if err := h.habitService.EnsureHabitDailyReadyLite(req.ChildID); err != nil {
			log.Printf("[GrowthCycle][SetGoalsBatch] 设置习惯目标后立即生成任务失败 child=%d: %v", req.ChildID, err)
			// 不返回错误，仅记录日志
		}
	}

	util.OK(c, gin.H{"goals": goals})
}

// UpdateCycle PUT /api/growth-cycles/:id
func (h *GrowthCycleHandler) UpdateCycle(c *gin.Context) {
	cycleID64, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || cycleID64 == 0 {
		util.FailBadRequest(c, "无效的周期 ID")
		return
	}
	cycleID := uint(cycleID64)
	var req struct {
		Name      string `json:"name"`
		StartDate string `json:"start_date" binding:"required"`
		EndDate   string `json:"end_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 start_date, end_date")
		return
	}
	if middleware.GetRole(c) != "parent" {
		util.FailForbidden(c, "仅家长可修改成长周期")
		return
	}
	familyID := middleware.GetFamilyID(c)
	startDate, err := time.Parse(time.RFC3339, req.StartDate)
	if err != nil {
		util.FailBadRequest(c, "start_date 格式错误")
		return
	}
	endDate, err := time.Parse(time.RFC3339, req.EndDate)
	if err != nil {
		util.FailBadRequest(c, "end_date 格式错误")
		return
	}
	cycle, err := h.service.UpdateCycle(cycleID, familyID, req.Name, startDate, endDate)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, cycle)
}

// GetCurrentCycle GET /api/growth-cycles/current/:child_id
func (h *GrowthCycleHandler) GetCurrentCycle(c *gin.Context) {
	childID64, err := strconv.ParseUint(c.Param("child_id"), 10, 32)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "无效的 child_id")
		return
	}
	childID := uint(childID64)
	familyID := middleware.GetFamilyID(c)
	cycle, goals, err := h.service.GetCurrentCycle(childID, familyID)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if cycle == nil {
		util.OK(c, gin.H{"cycle": nil, "goals": []interface{}{}})
		return
	}
	// 查询进度
	progress, _ := h.service.GetCycleProgress(cycle.ID)
	util.OK(c, gin.H{"cycle": cycle, "goals": goals, "progress": progress})
}

// GetCycleStats GET /api/growth-cycles/cycle-stats?child_id=N
// 返回当前周期累计统计（供前端 daily 任务详情页展示「本周期累计」）
func (h *GrowthCycleHandler) GetCycleStats(c *gin.Context) {
	childID64, err := strconv.ParseUint(c.Query("child_id"), 10, 32)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "无效的 child_id")
		return
	}
	childID := uint(childID64)
	familyID := middleware.GetFamilyID(c)
	stats, err := h.service.GetCycleStats(childID, familyID)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, stats)
}
