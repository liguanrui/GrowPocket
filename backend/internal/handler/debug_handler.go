package handler

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/internal/util/timeutil"
	"growpocket/pkg/util"
)

// DebugHandler 提供开发环境的调试接口（时间穿越）
type DebugHandler struct {
	taskGenService *service.TaskGenerationService
}

func NewDebugHandler(taskGenService *service.TaskGenerationService) *DebugHandler {
	return &DebugHandler{taskGenService: taskGenService}
}

// AdvanceTime POST /api/debug/advance-time body {"days":1}
// 按天推进虚拟时间；每步只做当前家庭的轻量日切（习惯 + 主题过期推进），
// AI 任务生成放到后台，避免前端 10s 超时。
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

	familyID := middleware.GetFamilyID(c)
	start := time.Now()

	// 按天推进：每天做习惯打卡就绪 + 主题过期检查（不调 LLM）
	for d := 0; d < req.Days; d++ {
		timeutil.AdvanceTime(1)
		if h.taskGenService != nil {
			h.taskGenService.PrepareDayForFamily(familyID)
		}
	}

	// AI 补生成放到后台，不阻塞响应
	if h.taskGenService != nil {
		go func(fid uint) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[DebugAdvance] 后台 AI 生成 panic: %v", r)
				}
			}()
			h.taskGenService.GenerateAIForFamily(fid)
		}(familyID)
	}

	now := timeutil.Now()
	log.Printf("[DebugAdvance] family=%d days=%d cost=%s virtual=%s",
		familyID, req.Days, time.Since(start), now.Format(time.RFC3339))
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
