package handler

import (
	"fmt"
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"time"

	"github.com/gin-gonic/gin"
)

// CycleGoalHandler 阶段目标设定 Handler（V1.3 Task 8）
type CycleGoalHandler struct {
	service      *service.CycleGoalService
	childService *service.ChildService
	analytics    *service.AnalyticsService
}

// NewCycleGoalHandler 构造函数
func NewCycleGoalHandler() *CycleGoalHandler {
	return &CycleGoalHandler{
		service:      service.NewCycleGoalService(),
		childService: service.NewChildService(),
		analytics:    service.NewAnalyticsService(),
	}
}

// SetCycleGoalRequest 设定阶段目标请求体
type SetCycleGoalRequest struct {
	ChildID              uint   `json:"child_id" binding:"required"`
	TargetCycleStartDate string `json:"target_cycle_start_date" binding:"required"` // yyyy-mm-dd
	CycleLengthWeeks     uint   `json:"cycle_length_weeks" binding:"required"`      // 1/2/3/4
	FocusDims            []uint `json:"focus_dims" binding:"required"`             // 1-3 个
	PointsTarget         int    `json:"points_target" binding:"required"`          // 50/100/200/300/500
}

// ThemeWeekPredictionResp 主题周预判响应
type ThemeWeekPredictionResp struct {
	WillTrigger bool   `json:"will_trigger"`
	ThemeDimID  uint   `json:"theme_dim_id"`
	ThemeTitle  string `json:"theme_title"`
	Reason      string `json:"reason"`
}

// SetCycleGoalResponse 设定阶段目标响应
type SetCycleGoalResponse struct {
	GoalSettingID         uint                   `json:"goal_setting_id"`
	RecommendedExtraSlots int                    `json:"recommended_extra_slots"`
	ThemeWeekPrediction   ThemeWeekPredictionResp `json:"theme_week_prediction"`
}

// SetGoal POST /api/cycle-goals - 设定阶段目标
func (h *CycleGoalHandler) SetGoal(c *gin.Context) {
	var req SetCycleGoalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 child_id, target_cycle_start_date, cycle_length_weeks, focus_dims, points_target")
		return
	}

	// 解析 target_cycle_start_date 字符串为 time.Time
	targetCycleStartDate, err := time.Parse("2006-01-02", req.TargetCycleStartDate)
	if err != nil {
		util.FailBadRequest(c, "target_cycle_start_date 格式错误,需为 yyyy-mm-dd")
		return
	}

	// 从 JWT context 获取父母 ID
	parentUserID := middleware.GetUserID(c)
	familyID := middleware.GetFamilyID(c)

	// 解析孩子年级（用于积分目标档位记录）
	grade := ""
	if child, err := h.childService.GetChild(req.ChildID, familyID); err == nil {
		if g, _ := service.ResolveGrade(child); g >= 1 && g <= 6 {
			grade = fmt.Sprintf("G%d", g)
		}
	}

	// 调用 service.SetGoal
	goal, err := h.service.SetGoal(req.ChildID, parentUserID, targetCycleStartDate, req.CycleLengthWeeks, req.FocusDims, req.PointsTarget, grade)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}

	// 调用 service.PredictThemeWeekTrigger 预判主题周
	themeDimID, themeTitle, reason := h.service.PredictThemeWeekTrigger(req.ChildID, req.FocusDims)

	// 计算推荐拓展槽数量（与 service.extraCountBaseForGrade 逻辑一致）
	recommendedSlots := extraCountBaseForGradeHandler(grade)

	resp := SetCycleGoalResponse{
		GoalSettingID:         goal.ID,
		RecommendedExtraSlots: recommendedSlots,
		ThemeWeekPrediction: ThemeWeekPredictionResp{
			WillTrigger: themeDimID > 0,
			ThemeDimID:  themeDimID,
			ThemeTitle:  themeTitle,
			Reason:      reason,
		},
	}

	// 埋点:cycle_goal_set（V1.3 Task 11）
	h.analytics.Event("cycle_goal_set", map[string]interface{}{
		"child_id":           req.ChildID,
		"cycle_length_weeks": req.CycleLengthWeeks,
		"focus_dims":         req.FocusDims,
		"points_target":      req.PointsTarget,
		"is_default_yesno":   goal.IsDefault,
	})
	util.OK(c, resp)
}

// extraCountBaseForGradeHandler 根据年级返回拓展槽基数（G1-2=2, G3-4=3, G5-6=4）
func extraCountBaseForGradeHandler(grade string) int {
	switch grade {
	case "G1", "G2":
		return 2
	case "G3", "G4":
		return 3
	case "G5", "G6":
		return 4
	default:
		return 3
	}
}
