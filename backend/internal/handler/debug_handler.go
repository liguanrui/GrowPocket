package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"growpocket/internal/database"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/internal/util/timeutil"
	"growpocket/pkg/util"
)

// DebugHandler 提供开发环境的调试接口（时间穿越）
// 仅在 APP_ENV=development 时由 main.go 注册路由
type DebugHandler struct {
	taskGenService *service.TaskGenerationService
}

func NewDebugHandler(taskGenService *service.TaskGenerationService) *DebugHandler {
	return &DebugHandler{taskGenService: taskGenService}
}

// AdvanceTime POST /api/debug/advance-time body {"days":1}
// 推进虚拟时间 N 天，并主动触发任务生成 + 过期父任务检查
func (h *DebugHandler) AdvanceTime(c *gin.Context) {
	var req struct {
		Days int `json:"days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "无效的请求体")
		return
	}
	if req.Days <= 0 || req.Days > 365 {
		util.FailBadRequest(c, "days 必须在 1-365 之间")
		return
	}
	// 1. 推进虚拟时间
	timeutil.AdvanceTime(req.Days)
	// 2. 触发所有孩子的任务生成（含 habit_daily 生成 + 主题任务推进）
	h.taskGenService.GenerateForAllChildren()
	// 3. 触发当前家庭所有孩子的过期父任务检查
	familyID := middleware.GetFamilyID(c)
	var children []model.User
	database.DB.Where("family_id = ? AND role = ?", familyID, model.RoleChild).Find(&children)
	for _, child := range children {
		h.taskGenService.CheckStaleParentTasks(child.ID)
	}
	// 4. 返回新的虚拟时间
	now := timeutil.Now()
	util.OK(c, gin.H{
		"current_time":  now,
		"is_virtual":    timeutil.IsVirtual(),
		"advanced_days": req.Days,
	})
}

// ResetTime POST /api/debug/reset-time
// 清除虚拟时间，恢复为真实时间
func (h *DebugHandler) ResetTime(c *gin.Context) {
	wasVirtual := timeutil.IsVirtual()
	timeutil.ResetTime()
	util.OK(c, gin.H{
		"current_time": time.Now(),
		"is_virtual":   false,
		"was_virtual":  wasVirtual,
	})
}

// GetTime GET /api/debug/time
// 查询当前时间状态（虚拟 / 真实）
func (h *DebugHandler) GetTime(c *gin.Context) {
	util.OK(c, gin.H{
		"current_time": timeutil.GetVirtualTime(),
		"is_virtual":   timeutil.IsVirtual(),
		"real_time":    time.Now(),
	})
}
