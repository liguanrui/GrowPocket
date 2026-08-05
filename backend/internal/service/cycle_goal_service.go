package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"gorm.io/gorm"
	"time"
)

// PRIMARY_DIMS 本年级主维 map（V1.3 阶段目标设定）
// 维度 ID 含义:1=生活自理, 2=责任担当, 3=学习探索, 4=社交协作, 5=创意审美, 6=运动健康
var PRIMARY_DIMS = map[string][]uint{
	"G1": {1},       // 生活自理
	"G2": {1, 2},    // 生活自理 + 责任担当
	"G3": {2},       // 责任担当
	"G4": {2, 3},    // 责任担当 + 学习探索
	"G5": {4, 5},    // 社交协作 + 创意审美
	"G6": {4, 5, 6}, // 社交协作 + 创意审美 + 运动健康
}

type CycleGoalService struct{}

func NewCycleGoalService() *CycleGoalService {
	return &CycleGoalService{}
}

// SetGoal 设定阶段目标（后写覆盖前写,通过 UNIQUE KEY uk_child_target_cycle 实现）
func (s *CycleGoalService) SetGoal(childID, parentUserID uint, targetCycleStartDate time.Time, cycleLengthWeeks uint, focusDims []uint, pointsTarget int, grade string) (*model.CycleGoalSetting, error) {
	if err := s.ValidateGoal(cycleLengthWeeks, focusDims, pointsTarget); err != nil {
		return nil, err
	}

	focusDimsJSON, err := json.Marshal(focusDims)
	if err != nil {
		return nil, fmt.Errorf("序列化 focusDims 失败: %v", err)
	}

	// 先 First 查询,存在则 Updates,否则 Create（利用 uk_child_target_cycle 后写覆盖前写）
	var existing model.CycleGoalSetting
	err = database.DB.Where("child_id = ? AND target_cycle_start_date = ?", childID, targetCycleStartDate).First(&existing).Error
	if err == nil {
		// 已存在,更新
		existing.ParentUserID = parentUserID
		existing.CycleLengthWeeks = cycleLengthWeeks
		existing.FocusDims = string(focusDimsJSON)
		existing.PointsTarget = pointsTarget
		existing.PointsTargetGrade = grade
		existing.IsDefault = false
		if err := database.DB.Save(&existing).Error; err != nil {
			return nil, fmt.Errorf("更新阶段目标失败: %v", err)
		}
		return &existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询阶段目标失败: %v", err)
	}

	// 不存在,创建
	goal := &model.CycleGoalSetting{
		ChildID:              childID,
		ParentUserID:         parentUserID,
		TargetCycleStartDate: targetCycleStartDate,
		CycleLengthWeeks:     cycleLengthWeeks,
		FocusDims:            string(focusDimsJSON),
		PointsTarget:         pointsTarget,
		PointsTargetGrade:    grade,
		IsDefault:            false,
	}
	if err := database.DB.Create(goal).Error; err != nil {
		return nil, fmt.Errorf("创建阶段目标失败: %v", err)
	}
	return goal, nil
}

// GetGoal 查询目标（按 child_id + target_cycle_start_date）
func (s *CycleGoalService) GetGoal(childID uint, targetCycleStartDate time.Time) (*model.CycleGoalSetting, error) {
	var goal model.CycleGoalSetting
	err := database.DB.Where("child_id = ? AND target_cycle_start_date = ?", childID, targetCycleStartDate).First(&goal).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorm.ErrRecordNotFound
		}
		return nil, err
	}
	return &goal, nil
}

// CalculateDefaultGoal 系统默认推算（本年级主维 + 自动积分目标）
// 用于家长未主动设定时
func (s *CycleGoalService) CalculateDefaultGoal(childID, parentUserID uint, targetCycleStartDate time.Time, grade string) (*model.CycleGoalSetting, error) {
	focusDims, ok := PRIMARY_DIMS[grade]
	if !ok || len(focusDims) == 0 {
		return nil, fmt.Errorf("无效的年级: %s", grade)
	}

	pointsTarget := s.GetRecommendedPointsTarget(grade, 2)

	// 先用 SetGoal 写入主体（IsDefault=false），再单独更新 IsDefault=true
	goal, err := s.SetGoal(childID, parentUserID, targetCycleStartDate, 2, focusDims, pointsTarget, grade)
	if err != nil {
		return nil, err
	}

	if err := database.DB.Model(&model.CycleGoalSetting{}).Where("id = ?", goal.ID).Update("is_default", true).Error; err != nil {
		return nil, fmt.Errorf("更新默认标记失败: %v", err)
	}
	goal.IsDefault = true
	return goal, nil
}

// GetRecommendedPointsTarget 系统推算积分目标
// 基础锚任务积分×周期天数 + 拓展任务预估积分×拓展槽数量
func (s *CycleGoalService) GetRecommendedPointsTarget(grade string, cycleLengthWeeks uint) int {
	baseAnchor := map[string]int{
		"G1": 80, "G2": 100, "G3": 120, "G4": 150, "G5": 180, "G6": 200,
	}
	extPoints := map[string]int{
		"G1": 10, "G2": 12, "G3": 15, "G4": 18, "G5": 20, "G6": 25,
	}
	dailySlots := map[string]int{
		"G1": 2, "G2": 2, "G3": 3, "G4": 3, "G5": 4, "G6": 4,
	}

	base, ok1 := baseAnchor[grade]
	ext, ok2 := extPoints[grade]
	slots, ok3 := dailySlots[grade]
	if !ok1 || !ok2 || !ok3 {
		return 50 // 未知年级回退到最低档
	}

	days := int(cycleLengthWeeks) * 7
	raw := base*days + ext*slots*days
	return roundToPointsTier(raw)
}

// PredictThemeWeekTrigger 预判主题周是否触发（供 API 返回给家长预览）
// 返回: theme_dim_id(0 表示不触发), theme_title, reason
func (s *CycleGoalService) PredictThemeWeekTrigger(childID uint, focusDims []uint) (uint, string, string) {
	if len(focusDims) == 0 {
		return 0, "", ""
	}
	// 简化实现:返回 focusDims[0] 作为预判 theme_dim（实际预判由 cycle_plan_service 计算）
	return focusDims[0], "本周期重点维度", "基于家长设定的重点维度"
}

// ValidateGoal 校验目标参数合法性
func (s *CycleGoalService) ValidateGoal(cycleLengthWeeks uint, focusDims []uint, pointsTarget int) error {
	if cycleLengthWeeks < 1 || cycleLengthWeeks > 4 {
		return fmt.Errorf("cycleLengthWeeks 必须为 1/2/3/4, 当前为 %d", cycleLengthWeeks)
	}
	if len(focusDims) < 1 || len(focusDims) > 3 {
		return fmt.Errorf("focusDims 长度必须为 1-3, 当前为 %d", len(focusDims))
	}
	validPoints := map[int]bool{50: true, 100: true, 200: true, 300: true, 500: true}
	if !validPoints[pointsTarget] {
		return fmt.Errorf("pointsTarget 必须为 50/100/200/300/500, 当前为 %d", pointsTarget)
	}
	return nil
}

// roundToPointsTier 将原始积分取整到最接近的 50/100/200/300/500 档位
func roundToPointsTier(raw int) int {
	tiers := []int{50, 100, 200, 300, 500}
	nearest := tiers[0]
	minDiff := raw - nearest
	if minDiff < 0 {
		minDiff = -minDiff
	}
	for _, t := range tiers[1:] {
		diff := raw - t
		if diff < 0 {
			diff = -diff
		}
		if diff < minDiff {
			minDiff = diff
			nearest = t
		}
	}
	return nearest
}
