package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"time"
)

type GrowthCycleService struct{}

func NewGrowthCycleService() *GrowthCycleService {
	return &GrowthCycleService{}
}

// CreateCycle 创建成长周期
func (s *GrowthCycleService) CreateCycle(familyID, childID uint, name string, startDate, endDate time.Time) (*model.GrowthCycle, error) {
	if endDate.Before(startDate) {
		return nil, errors.New("结束日期不能早于开始日期")
	}
	// 如果该儿童有 active 周期，先完成旧周期
	var activeCycle model.GrowthCycle
	if err := database.DB.Where("child_id = ? AND family_id = ? AND status = ?", childID, familyID, "active").First(&activeCycle).Error; err == nil {
		activeCycle.Status = "completed"
		database.DB.Save(&activeCycle)
	}

	cycle := &model.GrowthCycle{
		FamilyID:  familyID,
		ChildID:   childID,
		Name:      name,
		StartDate: startDate,
		EndDate:   endDate,
		Status:    "active",
	}
	if err := database.DB.Create(cycle).Error; err != nil {
		return nil, errors.New("创建周期失败")
	}
	return cycle, nil
}

// SetGoalInput V1.3.1 统一目标入口入参（每维度独立目标提升分）
type SetGoalInput struct {
	ChildID          uint          `json:"child_id"`
	CycleLengthWeeks uint          `json:"cycle_length_weeks"` // 1/2/3/4
	FocusDims        []uint        `json:"focus_dims"`         // 1-3 个重点维度（用于课程表生成加权）
	DimTargets       map[uint]int  `json:"dim_targets"`        // 维度ID → 目标提升分（如 {1:15, 3:10}），keys 必须 ⊆ FocusDims
	// 可选：不传则按当前日期推算 start_monday 为下个周一
	StartMonday string `json:"start_monday"` // yyyy-mm-dd, 可选
}

// SetGoal V1.3 统一阶段目标设置（合并原 CycleGoalService.SetGoal + 自动生成 CyclePlan）
// 规则：周期长度仅支持 1/2/3/4 周；设置成功后自动调用 CyclePlanService 生成课程表
func (s *GrowthCycleService) SetGoal(familyID uint, input SetGoalInput) (*model.GrowthCycle, error) {
	// 1. 校验参数（V1.3.1: 校验 DimTargets 而非单一 PointsTarget）
	if err := validateCycleGoal(input.CycleLengthWeeks, input.FocusDims, input.DimTargets); err != nil {
		return nil, err
	}

	// 2. 解析 start_monday
	var startMonday time.Time
	var err error
	if input.StartMonday != "" {
		startMonday, err = time.Parse("2006-01-02", input.StartMonday)
		if err != nil {
			return nil, errors.New("start_monday 格式错误，应为 yyyy-mm-dd")
		}
	} else {
		startMonday = nextMonday(time.Now())
	}

	// 3. 解析孩子年级
	_, gradeStr, _ := resolveChildProfile(input.ChildID)

	// 4. 计算 end_date = start_monday + cycle_length_weeks*7 - 1
	cycleDays := int(input.CycleLengthWeeks) * 7
	endDate := startMonday.AddDate(0, 0, cycleDays-1)

	// 5. 查找或创建 active 成长周期
	var cycle model.GrowthCycle
	if err := database.DB.Where("child_id = ? AND family_id = ? AND status = ?", input.ChildID, familyID, "active").First(&cycle).Error; err != nil {
		// 不存在则创建
		cycle = model.GrowthCycle{
			FamilyID:         familyID,
			ChildID:          input.ChildID,
			Name:             fmt.Sprintf("%d周成长周期", input.CycleLengthWeeks),
			StartDate:        startMonday,
			EndDate:          endDate,
			Status:           "active",
			CycleLengthWeeks: input.CycleLengthWeeks,
		}
		if err := database.DB.Create(&cycle).Error; err != nil {
			return nil, errors.New("创建成长周期失败")
		}
	} else {
		// 已存在则更新（保留 id）
		cycle.StartDate = startMonday
		cycle.EndDate = endDate
		cycle.CycleLengthWeeks = input.CycleLengthWeeks
		cycle.Status = "active"
		if err := database.DB.Save(&cycle).Error; err != nil {
			return nil, errors.New("更新成长周期失败")
		}
	}

	// 6. 写入目标字段（V1.3.1: DimTargets 为主，PointsTarget 派生）
	focusDimsJSON, _ := json.Marshal(input.FocusDims)
	cycle.FocusDims = string(focusDimsJSON)
	dimTargetsJSON, _ := json.Marshal(input.DimTargets)
	cycle.DimTargets = string(dimTargetsJSON)
	// PointsTarget 派生 = sum(DimTargets)，保留字段用于向后兼容旧接口
	pointsSum := 0
	for _, v := range input.DimTargets {
		pointsSum += v
	}
	cycle.PointsTarget = pointsSum
	cycle.PointsTargetGrade = gradeStr
	cycle.IsDefault = false
	if err := database.DB.Save(&cycle).Error; err != nil {
		return nil, errors.New("保存阶段目标失败")
	}

	// 7. 自动生成 CyclePlan 课程表（V1.3 核心链路）
	goals := &CycleGoals{
		FocusDims:    input.FocusDims,
		PointsTarget: pointsSum, // 派生：各维度提升分之和
		Grade:        gradeStr,
	}
	planSvc := NewCyclePlanService()
	_, err = planSvc.GenerateCyclePlan(input.ChildID, startMonday, input.CycleLengthWeeks, goals)
	if err != nil {
		// 课程表生成失败不阻断目标保存，仅记录日志
		log.Printf("[GrowthCycle] 阶段目标已保存但课程表生成失败 child=%d: %v", input.ChildID, err)
	} else {
		log.Printf("[GrowthCycle] 阶段目标已设置并自动生成课程表 child=%d cycleID=%d", input.ChildID, cycle.ID)
	}

	return &cycle, nil
}

// GetGoal V1.3 查询已设阶段目标（从 GrowthCycle 读取，替代原 CycleGoalService.GetGoal）
func (s *GrowthCycleService) GetGoal(childID, familyID uint) (*model.GrowthCycle, error) {
	var cycle model.GrowthCycle
	if err := database.DB.Where("child_id = ? AND family_id = ? AND status = ?", childID, familyID, "active").First(&cycle).Error; err != nil {
		return nil, nil // 无 active 周期
	}
	return &cycle, nil
}

// UpdateCycle 更新周期（时间区间、名称）
func (s *GrowthCycleService) UpdateCycle(cycleID, familyID uint, name string, startDate, endDate time.Time) (*model.GrowthCycle, error) {
	if endDate.Before(startDate) {
		return nil, errors.New("结束日期不能早于开始日期")
	}
	var cycle model.GrowthCycle
	if err := database.DB.Where("id = ? AND family_id = ?", cycleID, familyID).First(&cycle).Error; err != nil {
		return nil, errors.New("周期不存在")
	}
	cycle.StartDate = startDate
	cycle.EndDate = endDate
	if name != "" {
		cycle.Name = name
	}
	if err := database.DB.Save(&cycle).Error; err != nil {
		return nil, errors.New("更新周期失败")
	}
	return &cycle, nil
}

// GetCurrentCycle 查询当前周期
func (s *GrowthCycleService) GetCurrentCycle(childID, familyID uint) (*model.GrowthCycle, []model.Goal, error) {
	var cycle model.GrowthCycle
	if err := database.DB.Where("child_id = ? AND family_id = ? AND status = ?", childID, familyID, "active").First(&cycle).Error; err != nil {
		return nil, nil, nil // 无 active 周期
	}
	var goals []model.Goal
	database.DB.Where("cycle_id = ?", cycle.ID).Find(&goals)
	return &cycle, goals, nil
}

// GetCycleProgress 查询周期进度（V1.3 改为基于 focus_dims 推算，兼容旧 goals 表）
func (s *GrowthCycleService) GetCycleProgress(cycleID uint) ([]map[string]interface{}, error) {
	var cycle model.GrowthCycle
	if err := database.DB.First(&cycle, cycleID).Error; err != nil {
		return nil, errors.New("周期不存在")
	}

	// V1.3.1: 优先使用 GrowthCycle.DimTargets 推算每维度进度（delta → target = current + delta）
	result := make([]map[string]interface{}, 0)
	if cycle.DimTargets != "" {
		var dimTargets map[uint]int
		if err := json.Unmarshal([]byte(cycle.DimTargets), &dimTargets); err == nil {
			for dimID, delta := range dimTargets {
				var dim model.AbilityDimension
				database.DB.First(&dim, dimID)
				var score model.ChildAbilityScore
				database.DB.Where("child_id = ? AND dimension_id = ?", cycle.ChildID, dimID).First(&score)
				current := 0
				if score.ID > 0 {
					current = score.Score
				}
				// 目标绝对分 = 当前分 + 提升分(delta)
				targetScore := current + delta
				progress := 0
				if targetScore > 0 {
					progress = min(100, current*100/targetScore)
				}
				result = append(result, map[string]interface{}{
					"dimension_id":   dimID,
					"dimension_name": dim.Name,
					"dimension_code": dim.Code,
					"target_score":   targetScore,
					"current_score":  current,
					"delta":          delta, // 提升分（V1.3.1 新增）
					"progress":       progress,
				})
			}
			return result, nil
		}
	}

	// V1.3 旧数据兼容：无 DimTargets 但有 FocusDims + PointsTarget，回退平均推算
	if cycle.FocusDims != "" && cycle.PointsTarget > 0 {
		var focusDims []uint
		if err := json.Unmarshal([]byte(cycle.FocusDims), &focusDims); err == nil {
			for _, dimID := range focusDims {
				var dim model.AbilityDimension
				database.DB.First(&dim, dimID)
				var score model.ChildAbilityScore
				database.DB.Where("child_id = ? AND dimension_id = ?", cycle.ChildID, dimID).First(&score)
				current := 0
				if score.ID > 0 {
					current = score.Score
				}
				targetScore := cycle.PointsTarget / max(1, len(focusDims))
				result = append(result, map[string]interface{}{
					"dimension_id":   dimID,
					"dimension_name": dim.Name,
					"dimension_code": dim.Code,
					"target_score":   targetScore,
					"current_score":  current,
					"progress":       min(100, current*100/max(targetScore, 1)),
				})
			}
			return result, nil
		}
	}

	// 兼容旧 goals 表（已废弃，仅历史数据）
	var goals []model.Goal
	if err := database.DB.Where("cycle_id = ?", cycleID).Find(&goals).Error; err != nil {
		return nil, err
	}
	for _, g := range goals {
		var dim model.AbilityDimension
		database.DB.First(&dim, g.DimensionID)
		var score model.ChildAbilityScore
		database.DB.Where("child_id = ? AND dimension_id = ?", g.ChildID, g.DimensionID).First(&score)
		current := 0
		if score.ID > 0 {
			current = score.Score
		}
		result = append(result, map[string]interface{}{
			"dimension_id":   g.DimensionID,
			"dimension_name": dim.Name,
			"dimension_code": dim.Code,
			"target_score":   g.TargetScore,
			"current_score":  current,
			"progress":       min(100, current*100/max(g.TargetScore, 1)),
		})
	}
	return result, nil
}

// ===================== V1.3 辅助方法 =====================

// validateCycleGoal V1.3.1 校验阶段目标参数（每维度独立提升分）
func validateCycleGoal(cycleLengthWeeks uint, focusDims []uint, dimTargets map[uint]int) error {
	if cycleLengthWeeks < 1 || cycleLengthWeeks > 4 {
		return fmt.Errorf("cycle_length_weeks 必须为 1/2/3/4, 当前为 %d", cycleLengthWeeks)
	}
	if len(focusDims) < 1 || len(focusDims) > 3 {
		return fmt.Errorf("focus_dims 长度必须 1-3, 当前 %d", len(focusDims))
	}
	if len(dimTargets) == 0 {
		return errors.New("dim_targets 不能为空，需为每个重点维度设置提升分")
	}
	// 校验 dimTargets 的 keys ⊆ focusDims，且每个 delta 合理（1-50）
	focusSet := make(map[uint]bool, len(focusDims))
	for _, id := range focusDims {
		focusSet[id] = true
	}
	for dimID, delta := range dimTargets {
		if !focusSet[dimID] {
			return fmt.Errorf("dim_targets 的维度 %d 不在 focus_dims 中", dimID)
		}
		if delta < 1 || delta > 50 {
			return fmt.Errorf("维度 %d 的提升分必须 1-50, 当前 %d", dimID, delta)
		}
	}
	return nil
}

// nextMonday 返回下一个周一（如果 today 是周一则返回 today）
func nextMonday(today time.Time) time.Time {
	daysUntilMonday := (1 - int(today.Weekday()) + 7) % 7
	if daysUntilMonday == 0 {
		daysUntilMonday = 7 // 如果今天是周一，推到下个周一（避免 0 天）
	}
	// V1.3 fix: 今天就是周一时直接用今天（不应推到下周一）
	if int(today.Weekday()) == 1 {
		daysUntilMonday = 0
	}
	return today.AddDate(0, 0, daysUntilMonday)
}
