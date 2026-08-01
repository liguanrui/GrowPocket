package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
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

// SetGoal 设置阶段目标
func (s *GrowthCycleService) SetGoal(cycleID, familyID, childID, dimensionID uint, targetScore int) (*model.Goal, error) {
	if targetScore <= 0 {
		return nil, errors.New("目标分值必须大于 0")
	}
	// 检查是否已有该维度的目标
	var existing model.Goal
	if err := database.DB.Where("cycle_id = ? AND dimension_id = ?", cycleID, dimensionID).First(&existing).Error; err == nil {
		existing.TargetScore = targetScore
		database.DB.Save(&existing)
		return &existing, nil
	}
	goal := &model.Goal{
		CycleID:     cycleID,
		FamilyID:    familyID,
		ChildID:     childID,
		DimensionID: dimensionID,
		TargetScore: targetScore,
	}
	if err := database.DB.Create(goal).Error; err != nil {
		return nil, errors.New("设置目标失败")
	}
	return goal, nil
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

// GetCycleProgress 查询周期进度（含当前能力得分对比目标）
func (s *GrowthCycleService) GetCycleProgress(cycleID uint) ([]map[string]interface{}, error) {
	var goals []model.Goal
	if err := database.DB.Where("cycle_id = ?", cycleID).Find(&goals).Error; err != nil {
		return nil, err
	}
	result := make([]map[string]interface{}, 0, len(goals))
	for _, g := range goals {
		var dim model.AbilityDimension
		database.DB.First(&dim, g.DimensionID)
		// 查当前得分
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
