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

// assertChildInFamily 校验 child_id 属于当前家庭且角色为孩子
func assertChildInFamily(familyID, childID uint) error {
	var child model.User
	if err := database.DB.Where("id = ? AND family_id = ? AND role = ?", childID, familyID, model.RoleChild).First(&child).Error; err != nil {
		return errors.New("孩子档案不存在")
	}
	return nil
}

// CreateCycle 创建成长周期
func (s *GrowthCycleService) CreateCycle(familyID, childID uint, name string, startDate, endDate time.Time) (*model.GrowthCycle, error) {
	if endDate.Before(startDate) {
		return nil, errors.New("结束日期不能早于开始日期")
	}
	// 周期长度校验：必须在 1-4 周（7-28 天，含边界）之间
	if duration := endDate.Sub(startDate); duration < 7*24*time.Hour || duration > 28*24*time.Hour {
		return nil, errors.New("周期长度需在 1-4 周之间")
	}
	if err := assertChildInFamily(familyID, childID); err != nil {
		return nil, err
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

// GoalInput 批量设置目标的输入项
type GoalInput struct {
	GoalType     string `json:"goal_type"`      // dimension/habit/parent_task
	DimensionID  uint   `json:"dimension_id"`   // goal_type=dimension 时
	HabitID      *uint  `json:"habit_id"`       // goal_type=habit 时
	ParentTaskID *uint  `json:"parent_task_id"` // goal_type=parent_task 时
}

// SetGoalsBatch 批量设置阶段目标（支持 dimension/habit/parent_task 三种类型）
// - 同周期同类型同目标不重复创建：dimension 按 dimension_id 去重，habit 按 habit_id 去重，parent_task 按 parent_task_id 去重
// - 已存在的目标会被跳过（不更新），未存在的会新建
func (s *GrowthCycleService) SetGoalsBatch(cycleID, familyID, childID uint, goals []GoalInput) ([]model.Goal, error) {
	if len(goals) == 0 {
		return nil, errors.New("目标列表不能为空")
	}
	if err := assertChildInFamily(familyID, childID); err != nil {
		return nil, err
	}
	result := make([]model.Goal, 0, len(goals))
	for _, g := range goals {
		goalType := g.GoalType
		if goalType == "" {
			goalType = "dimension"
		}
		var (
			existing model.Goal
			found    bool
		)
		switch goalType {
		case "dimension":
			if g.DimensionID == 0 {
				return nil, errors.New("dimension 类型目标必须提供 dimension_id")
			}
			if err := database.DB.Where("cycle_id = ? AND goal_type = ? AND dimension_id = ?", cycleID, "dimension", g.DimensionID).First(&existing).Error; err == nil {
				found = true
			}
		case "habit":
			if g.HabitID == nil || *g.HabitID == 0 {
				return nil, errors.New("habit 类型目标必须提供 habit_id")
			}
			if err := database.DB.Where("cycle_id = ? AND goal_type = ? AND habit_id = ?", cycleID, "habit", *g.HabitID).First(&existing).Error; err == nil {
				found = true
			}
		case "parent_task":
			if g.ParentTaskID == nil || *g.ParentTaskID == 0 {
				return nil, errors.New("parent_task 类型目标必须提供 parent_task_id")
			}
			if err := database.DB.Where("cycle_id = ? AND goal_type = ? AND parent_task_id = ?", cycleID, "parent_task", *g.ParentTaskID).First(&existing).Error; err == nil {
				found = true
			}
		default:
			return nil, errors.New("无效的 goal_type，必须为 dimension/habit/parent_task")
		}
		if found {
			result = append(result, existing)
			continue
		}
		goal := &model.Goal{
			CycleID:     cycleID,
			FamilyID:    familyID,
			ChildID:     childID,
			GoalType:    goalType,
			DimensionID: 0,
			TargetScore: 0,
		}
		switch goalType {
		case "dimension":
			goal.DimensionID = g.DimensionID
		case "habit":
			goal.HabitID = g.HabitID
		case "parent_task":
			goal.ParentTaskID = g.ParentTaskID
		}
		if err := database.DB.Create(goal).Error; err != nil {
			return nil, errors.New("设置目标失败")
		}
		result = append(result, *goal)
	}
	return result, nil
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
	// 仅对 active 周期校验长度；completed 周期不动
	if cycle.Status == "active" {
		if duration := endDate.Sub(startDate); duration < 7*24*time.Hour || duration > 28*24*time.Hour {
			return nil, errors.New("周期长度需在 1-4 周之间")
		}
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

// CycleStats 周期累计统计
type CycleStats struct {
	CompletedTaskCount int64     `json:"completed_task_count"`
	TotalPointsEarned  int64     `json:"total_points_earned"`
	FocusDimNames      []string  `json:"focus_dim_names"`
	DaysRemaining      int       `json:"days_remaining"`
	CycleName          string    `json:"cycle_name"`
	CycleStart         time.Time `json:"cycle_start"`
	CycleEnd           time.Time `json:"cycle_end"`
}

// GetCycleStats 查询当前周期累计统计（daily 任务完成数、累计积分、聚焦维度、剩余天数等）
// 周期不存在时返回零值统计而非报错（前端可能未设置周期）
func (s *GrowthCycleService) GetCycleStats(childID, familyID uint) (*CycleStats, error) {
	stats := &CycleStats{FocusDimNames: []string{}}

	var cycle model.GrowthCycle
	if err := database.DB.Where("child_id = ? AND family_id = ? AND status = ?", childID, familyID, "active").First(&cycle).Error; err != nil {
		// 无 active 周期，返回零值统计
		return stats, nil
	}

	stats.CycleName = cycle.Name
	stats.CycleStart = cycle.StartDate.In(time.Local)
	stats.CycleEnd = cycle.EndDate.In(time.Local)

	// 统计本周期内 status=3 且 task_kind='daily' 的任务数
	taskFilter := "child_id = ? AND task_kind = ? AND status = ? AND created_at BETWEEN ? AND ?"
	taskArgs := []interface{}{childID, "daily", model.TaskStatusCompleted, cycle.StartDate, cycle.EndDate}
	if err := database.DB.Model(&model.Task{}).
		Where(taskFilter, taskArgs...).
		Count(&stats.CompletedTaskCount).Error; err != nil {
		return nil, err
	}

	// 累计上述任务的 points 之和（COALESCE 避免无记录时 SUM 返回 NULL）
	if err := database.DB.Model(&model.Task{}).
		Where(taskFilter, taskArgs...).
		Select("COALESCE(SUM(points), 0)").
		Row().Scan(&stats.TotalPointsEarned); err != nil {
		return nil, err
	}

	// 查询 focus_dim_names：goal_type='dimension' 的 Goal 关联 AbilityDimension 取名称
	var goals []model.Goal
	if err := database.DB.Where("cycle_id = ? AND goal_type = ?", cycle.ID, "dimension").Find(&goals).Error; err != nil {
		return nil, err
	}
	dimIDs := make([]uint, 0, len(goals))
	for _, g := range goals {
		if g.DimensionID != 0 {
			dimIDs = append(dimIDs, g.DimensionID)
		}
	}
	if len(dimIDs) > 0 {
		var dims []model.AbilityDimension
		if err := database.DB.Where("id IN ?", dimIDs).Order("sort_order ASC").Find(&dims).Error; err != nil {
			return nil, err
		}
		for _, d := range dims {
			stats.FocusDimNames = append(stats.FocusDimNames, d.Name)
		}
	}

	// 剩余天数：end_date - now，向下取整，负数返回 0
	daysRemaining := int(time.Until(cycle.EndDate).Hours() / 24)
	if daysRemaining < 0 {
		daysRemaining = 0
	}
	stats.DaysRemaining = daysRemaining

	return stats, nil
}

// GetCycleProgress 查询周期进度（基于周期内任务完成度计算）
func (s *GrowthCycleService) GetCycleProgress(cycleID uint) ([]map[string]interface{}, error) {
	var cycle model.GrowthCycle
	if err := database.DB.First(&cycle, cycleID).Error; err != nil {
		return nil, errors.New("周期不存在")
	}
	// 周期内已生成任务：task_kind ∈ daily/habit_daily/child，且创建时间落在周期内
	taskKinds := []string{"daily", "habit_daily", "child"}
	var totalTasks int64
	database.DB.Model(&model.Task{}).
		Where("child_id = ? AND task_kind IN ? AND created_at BETWEEN ? AND ?",
			cycle.ChildID, taskKinds, cycle.StartDate, cycle.EndDate).
		Count(&totalTasks)
	// 已完成任务：status = 3
	var completedTasks int64
	database.DB.Model(&model.Task{}).
		Where("child_id = ? AND task_kind IN ? AND status = ? AND created_at BETWEEN ? AND ?",
			cycle.ChildID, taskKinds, model.TaskStatusCompleted, cycle.StartDate, cycle.EndDate).
		Count(&completedTasks)
	// 进度 = 已完成数 / 总数 * 100，clamp 0-100，总数为 0 时返回 0
	progress := 0
	if totalTasks > 0 {
		progress = min(100, max(0, int(completedTasks*100/totalTasks)))
	}
	result := []map[string]interface{}{
		{
			"total_tasks":     totalTasks,
			"completed_tasks": completedTasks,
			"progress":        progress,
		},
	}
	return result, nil
}
