package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"math/rand"
	"sort"
	"time"

	"gorm.io/gorm"
)

// CyclePlanService Cycle 编排核心服务（V1.3 7.6.1）
type CyclePlanService struct {
	goalService *CycleGoalService
	ability     *AbilityService
	taskService *TaskService
	analytics   *AnalyticsService
}

// NewCyclePlanService 构造函数
func NewCyclePlanService() *CyclePlanService {
	return &CyclePlanService{
		goalService: NewCycleGoalService(),
		ability:     NewAbilityService(),
		taskService: NewTaskService(),
		analytics:   NewAnalyticsService(),
	}
}

// CycleGoals 阶段目标设定输入参数
type CycleGoals struct {
	FocusDims    []uint `json:"focus_dims"`
	PointsTarget int    `json:"points_target"`
	Grade        string `json:"grade"`
}

// ThemeWeekConfig 主题周配置（V1.3 新增 position 字段）
type ThemeWeekConfig struct {
	Active     bool   `json:"active"`
	Dim        uint   `json:"dim"`
	ThemeTitle string `json:"theme_title"`
	StartDate  string `json:"start_date"`  // yyyy-mm-dd
	EndDate    string `json:"end_date"`    // yyyy-mm-dd
	Position   string `json:"position"`    // week1/week2/week3/week4
}

// CyclePlanPreview 预览数据结构
type CyclePlanPreview struct {
	CyclePlan       *model.CyclePlan                  `json:"cycle_plan"`
	DailyInstances  map[string][]model.TaskTemplate   `json:"daily_instances"`
	DimensionRatio  map[string]float64                `json:"dimension_ratio"`
	ThemeWeekConfig *ThemeWeekConfig                 `json:"theme_week_config"`
	GoalsBadge      *CycleGoals                       `json:"goals_badge"`
	LockVersion     int                               `json:"lock_version"`
}

// ===================== GenerateCyclePlan 主方法（Task 5） =====================

// GenerateCyclePlan 生成可配置周期(1-4 周)的 Cycle 课程表
// 对应 PRD V1.3 7.6.1 伪代码
func (s *CyclePlanService) GenerateCyclePlan(
	childID uint,
	startMonday time.Time, // 下个 Cycle 周一日期
	cycleLengthWeeks uint, // 1/2/3/4
	goals *CycleGoals, // 可选,如果为 nil 则使用默认值
) (*model.CyclePlan, error) {
	// 参数校验
	if cycleLengthWeeks < 1 || cycleLengthWeeks > 4 {
		return nil, fmt.Errorf("cycleLengthWeeks 必须为 1/2/3/4, 当前为 %d", cycleLengthWeeks)
	}

	// ---- Step 1: 加载输入 ----
	familyID, gradeStr, _ := resolveChildProfile(childID)

	if goals == nil {
		// 调用 CalculateDefaultGoal 获取默认目标
		goal, err := s.goalService.CalculateDefaultGoal(childID, 0, startMonday, gradeStr)
		if err == nil && goal != nil {
			var focusDims []uint
			json.Unmarshal([]byte(goal.FocusDims), &focusDims)
			goals = &CycleGoals{
				FocusDims:    focusDims,
				PointsTarget: goal.PointsTarget,
				Grade:        gradeStr,
			}
		} else {
			// 回退到简化默认值
			focusDims := PRIMARY_DIMS[gradeStr]
			if len(focusDims) == 0 {
				focusDims = PRIMARY_DIMS["G3"]
			}
			goals = &CycleGoals{
				FocusDims:    focusDims,
				PointsTarget: s.getRecommendedPointsTarget(gradeStr, cycleLengthWeeks),
				Grade:        gradeStr,
			}
		}
	}
	if goals.Grade == "" {
		goals.Grade = gradeStr
	}

	// 拉取能力基线分（简化:忽略错误时使用空数组）
	_, _ = s.ability.GetChildScores(childID, familyID)

	// ---- Step 2: 初始化空容器 ----
	cycleDays := int(cycleLengthWeeks) * 7 // 7/14/21/28 天
	plan := make(map[string][]model.TaskTemplate, cycleDays)

	// 每天注入锚任务(V1.3 fix: 必须按 family_id 过滤,否则会查出其他家庭/其他年级的锚任务)
	anchors := s.loadAnchorTasks(familyID, gradeStr)
	for i := 0; i < cycleDays; i++ {
		date := startMonday.AddDate(0, 0, i)
		key := dateKey(date)
		dayTasks := make([]model.TaskTemplate, 0, len(anchors)+8)
		dayTasks = append(dayTasks, anchors...)
		plan[key] = dayTasks
	}

	// ---- Step 3: 主题周配置 ----
	themeDimID, themeTitle, shouldTrigger := s.detectWeakDimAndDecideTheme(childID, goals.FocusDims)
	var themeCfg *ThemeWeekConfig
	if shouldTrigger && themeDimID > 0 {
		themeCfg = s.applyThemeWeekRule(cycleLengthWeeks, startMonday, themeDimID, themeTitle)
	}

	// ---- Step 4: 每日拓展槽生成 ----
	extraCountBase := extraCountBaseForGrade(goals.Grade)
	recommendedTarget := s.getRecommendedPointsTarget(goals.Grade, cycleLengthWeeks)
	boost := 0
	if goals.PointsTarget > recommendedTarget {
		boost = 1
		if goals.PointsTarget > recommendedTarget*2 {
			boost = 2
		}
	}
	extraCountBase += boost
	if extraCountBase > 6 {
		extraCountBase = 6
	}

	// 冷却池: V1.3 Task 22 改为按日期索引存储,确保滑动窗口准确覆盖 N 天
	// dailyUsedIDs[dayIndex] = 当天使用的所有拓展任务 ID
	dailyUsedIDs := make([][]uint, cycleDays)
	// V1.3 Task 22: 潜维本 Cycle 内 100% 不重复的 cycle-wide 集合
	latentUsedInCycle := make(map[uint]bool)

	// 排序日期 key 确保确定性遍历
	dateKeys := make([]string, 0, cycleDays)
	for i := 0; i < cycleDays; i++ {
		dateKeys = append(dateKeys, dateKey(startMonday.AddDate(0, 0, i)))
	}
	sort.Strings(dateKeys)

	// 重点维度加权 map（非主题周时 +20%）
	focusDimBoost := make(map[uint]float64)
	for _, dim := range goals.FocusDims {
		focusDimBoost[dim] = 1.2
	}

	// V1.3 Task 22: 加载年级指南用于判断潜维
	gradeGuides := loadGradeGuides(gradeToInt(goals.Grade))

	for dayIdx, key := range dateKeys {
		date, _ := time.Parse("2006-01-02", key)

		var dayExtraCount int
		var mainRatio float64
		var forceDim *uint
		var dayBoost map[uint]float64

		if isInThemeWeek(themeCfg, date) {
			// 主题周内：拓展槽 ×3，全部派给 theme_dim
			dayExtraCount = extraCountBase * 3
			mainRatio = 1.0
			forceDim = &themeDimID
			dayBoost = nil
		} else {
			// 非主题周：正常拓展槽
			dayExtraCount = extraCountBase
			mainRatio = 0.65
			dayBoost = focusDimBoost
		}

		// V1.3 Task 22: 按日期窗口精确构建冷却排除集
		var last3d, last5d, last14d []uint
		for i := 0; i < dayIdx; i++ {
			gap := dayIdx - i
			if gap < 3 {
				last3d = append(last3d, dailyUsedIDs[i]...)
			}
			if gap < 5 {
				last5d = append(last5d, dailyUsedIDs[i]...)
			}
			if gap < 14 {
				last14d = append(last14d, dailyUsedIDs[i]...)
			}
		}

		extras, err := s.sampleDayExtraWithGlobalCooldown(
			familyID, goals.Grade, dayExtraCount, mainRatio,
			last3d, last5d, last14d,
			latentUsedInCycle,
			forceDim, dayBoost,
		)
		if err != nil {
			log.Printf("[CyclePlan] 拓展槽抽样失败 child=%d date=%s: %v", childID, key, err)
		}
		plan[key] = append(plan[key], extras...)

		// 记录当天使用的 ID
		dailyUsedIDs[dayIdx] = make([]uint, len(extras))
		for i, t := range extras {
			dailyUsedIDs[dayIdx][i] = t.ID
			// V1.3 Task 22: 潜维任务标记为本 Cycle 已用
			if focus, ok := gradeGuides[t.AbilityDimensionID]; ok && focus == "latent" {
				latentUsedInCycle[t.ID] = true
			}
		}
	}

	// ---- Step 5: 父任务里程碑均匀分布 ----
	var parentTasks []model.ParentTask
	database.DB.Where("child_id = ? AND status = ?", childID, model.ParentTaskStatusActive).Find(&parentTasks)
	plan = s.spreadParentSubtasksEvenly(parentTasks, plan, 1, cycleDays)

	// ---- Step 6: RAG R-1/R-2 规则 ----
	plan = s.applyRagRules(plan, themeDimID)

	// ---- Step 7: Sanitize S-1/S-2/S-3 ----
	var skills []model.SkillUnlock
	database.DB.Where("child_id = ?", childID).Find(&skills)
	plan = s.applySanitizeRules(plan, childID, skills, cycleLengthWeeks)

	// ---- Step 8: 校验整 Cycle 主次潜占比 ----
	// V1.3 Task 21: validateCycleRatio 和 swapEndToFitRatio 都排除主题周天数
	ratioWarningShown := !s.validateCycleRatio(plan, goals.Grade, themeCfg)
	if ratioWarningShown {
		plan = s.swapEndToFitRatio(plan, goals.Grade, themeCfg)
	}

	// ---- Step 9: 保存 cycle_plan 快照 ----
	ratioSummary := computeRatioSummary(plan, goals.Grade, themeDimID, themeCfg)

	goalsJSON, _ := json.Marshal(goals)
	themeJSON := ""
	if themeCfg != nil {
		b, _ := json.Marshal(themeCfg)
		themeJSON = string(b)
	}
	ratioJSON, _ := json.Marshal(ratioSummary)
	dailyJSON, _ := json.Marshal(plan)

	endDate := startMonday.AddDate(0, 0, cycleDays-1)

	cyclePlan := &model.CyclePlan{
		ChildID:               childID,
		StartDate:             startMonday,
		EndDate:               endDate,
		CycleLengthWeeks:      cycleLengthWeeks,
		GoalsJSON:             string(goalsJSON),
		Status:                model.CyclePlanStatusDraft,
		ThemeWeekConfig:       themeJSON,
		DimensionRatioSummary: string(ratioJSON),
		DailyInstancesJSON:    string(dailyJSON),
		LockVersion:           0,
	}

	// 利用 uk_child_start_date 判断是否存在，存在则 Updates 覆盖
	var existing model.CyclePlan
	err := database.DB.Where("child_id = ? AND start_date = ?", childID, startMonday).First(&existing).Error
	if err == nil {
		// 已存在，更新（保留 lock_version 由乐观锁控制）
		cyclePlan.ID = existing.ID
		cyclePlan.LockVersion = existing.LockVersion
		if err := database.DB.Save(cyclePlan).Error; err != nil {
			return nil, fmt.Errorf("更新周期计划失败: %v", err)
		}
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		// 不存在，创建
		if err := database.DB.Create(cyclePlan).Error; err != nil {
			return nil, fmt.Errorf("创建周期计划失败: %v", err)
		}
	} else {
		return nil, fmt.Errorf("查询周期计划失败: %v", err)
	}

	// ---- Step 10: 返回 ----
	// 埋点:cycle_plan_generated（V1.3 Task 11）
	s.analytics.Event("cycle_plan_generated", map[string]interface{}{
		"child_id":             childID,
		"cycle_length_weeks":   cycleLengthWeeks,
		"days_count":           int(cycleLengthWeeks) * 7,
		"theme_week_triggered": themeCfg != nil && themeCfg.Active,
		"ratio_warning_shown":  ratioWarningShown,
	})
	return cyclePlan, nil
}

// ===================== 主题周规则（Task 7） =====================

// detectWeakDimAndDecideTheme 识别弱维并决定是否触发主题周
// 历史窗口=最近一个已锁版 Cycle 的实际长度（V1.3 改动）
// 简化实现：返回 focusDims[0] 作为 theme_dim（如果有），否则返回 0（不触发）
func (s *CyclePlanService) detectWeakDimAndDecideTheme(
	childID uint,
	focusDims []uint, // 阶段目标设定的重点维度
) (themeDimID uint, themeTitle string, shouldTrigger bool) {
	// TODO: 后续可接入问卷基线分 + 完成率统计来识别弱维
	if len(focusDims) == 0 {
		return 0, "", false
	}
	return focusDims[0], "本周期重点维度", true
}

// applyThemeWeekRule 根据周期长度应用主题周规则
// 1 周 Cycle: 整周期=主题周（7 天全部派 theme_dim）
// 2-4 周 Cycle: 主题周占其中 1 周（默认 week1,家长可调整 position）
func (s *CyclePlanService) applyThemeWeekRule(
	cycleLengthWeeks uint,
	startMonday time.Time,
	themeDimID uint,
	themeTitle string,
) *ThemeWeekConfig {
	position := "week1"

	// 1 周时整周期为主题周，2-4 周时默认 week1
	weekStart := startMonday
	weekEnd := startMonday.AddDate(0, 0, 6)

	return &ThemeWeekConfig{
		Active:     true,
		Dim:        themeDimID,
		ThemeTitle: themeTitle,
		StartDate:  dateKey(weekStart),
		EndDate:    dateKey(weekEnd),
		Position:   position,
	}
}

// ToggleThemeWeek 主题周开关 + 位置调整
func (s *CyclePlanService) ToggleThemeWeek(
	cyclePlanID uint,
	themeDimID uint, // 0 表示关闭
	position string, // week1/week2/week3/week4
	enable bool,
) (*model.CyclePlan, error) {
	var plan model.CyclePlan
	if err := database.DB.First(&plan, cyclePlanID).Error; err != nil {
		return nil, fmt.Errorf("周期计划不存在: %v", err)
	}

	var cfg ThemeWeekConfig
	if plan.ThemeWeekConfig != "" {
		json.Unmarshal([]byte(plan.ThemeWeekConfig), &cfg)
	}

	// 记录旧 position 用于位置变更埋点
	oldPosition := cfg.Position

	if enable {
		if themeDimID == 0 {
			return nil, errors.New("启用主题周时 themeDimID 不能为 0")
		}
		if position == "" {
			position = "week1"
		}
		weekNum := positionToWeekNum(position)
		if weekNum > int(plan.CycleLengthWeeks) {
			return nil, fmt.Errorf("位置 %s 超出周期长度 %d 周", position, plan.CycleLengthWeeks)
		}
		cfg.Active = true
		cfg.Dim = themeDimID
		cfg.ThemeTitle = "本周期重点维度"
		cfg.Position = position
		weekStart := plan.StartDate.AddDate(0, 0, (weekNum-1)*7)
		weekEnd := weekStart.AddDate(0, 0, 6)
		cfg.StartDate = dateKey(weekStart)
		cfg.EndDate = dateKey(weekEnd)
	} else {
		cfg.Active = false
	}

	cfgJSON, _ := json.Marshal(cfg)
	plan.ThemeWeekConfig = string(cfgJSON)

	// TODO: 重新生成受影响天数的拓展任务以应用主题周变更
	// 当前仅更新配置,家长可调用 Regenerate 重新生成

	if err := database.DB.Save(&plan).Error; err != nil {
		return nil, fmt.Errorf("更新主题周配置失败: %v", err)
	}

	// 埋点（V1.3 Task 11）
	if enable {
		// 主题周开启:theme_week_triggered
		s.analytics.Event("theme_week_triggered", map[string]interface{}{
			"child_id":          plan.ChildID,
			"cycle_length_weeks": plan.CycleLengthWeeks,
			"theme_dim_id":      themeDimID,
			"position":          position,
		})
		// 位置变更:theme_week_position_changed（当新旧 position 不同时）
		if oldPosition != "" && oldPosition != position {
			s.analytics.Event("theme_week_position_changed", map[string]interface{}{
				"child_id":          plan.ChildID,
				"old_position":      oldPosition,
				"new_position":      position,
				"theme_dim_id":      themeDimID,
			})
		}
	} else {
		// 主题周关闭:theme_week_toggled_off
		s.analytics.Event("theme_week_toggled_off", map[string]interface{}{
			"child_id":          plan.ChildID,
			"cycle_length_weeks": plan.CycleLengthWeeks,
			"position":          oldPosition,
		})
	}
	return &plan, nil
}

// ===================== 数据访问方法 =====================

// GetLockedCyclePlan 获取某天的已锁版 Cycle 快照
func (s *CyclePlanService) GetLockedCyclePlan(childID uint, date time.Time) (*model.CyclePlan, error) {
	var plan model.CyclePlan
	err := database.DB.Where("child_id = ? AND start_date <= ? AND end_date >= ? AND status = ?",
		childID, date, date, model.CyclePlanStatusLocked).First(&plan).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorm.ErrRecordNotFound
		}
		return nil, err
	}
	return &plan, nil
}

// GetDailySlice 从 Cycle 快照切片某天的任务
func (s *CyclePlanService) GetDailySlice(plan *model.CyclePlan, date time.Time) ([]model.TaskTemplate, error) {
	if plan == nil {
		return nil, errors.New("plan 不能为空")
	}

	var dailyInstances map[string][]model.TaskTemplate
	if err := json.Unmarshal([]byte(plan.DailyInstancesJSON), &dailyInstances); err != nil {
		return nil, fmt.Errorf("解析 DailyInstancesJSON 失败: %v", err)
	}

	key := dateKey(date)
	tasks, ok := dailyInstances[key]
	if !ok {
		return []model.TaskTemplate{}, nil
	}
	return tasks, nil
}

// LockCyclePlan 锁版（乐观锁）
func (s *CyclePlanService) LockCyclePlan(id uint, lockVersion uint, parentID uint) (*model.CyclePlan, error) {
	now := time.Now()
	result := database.DB.Model(&model.CyclePlan{}).
		Where("id = ? AND lock_version = ?", id, lockVersion).
		Updates(map[string]interface{}{
			"status":           model.CyclePlanStatusLocked,
			"lock_version":     lockVersion + 1,
			"locked_at":        now,
			"locked_by_parent": parentID,
		})

	if result.Error != nil {
		return nil, fmt.Errorf("锁版失败: %v", result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, errors.New("锁版失败：版本号不匹配或计划不存在")
	}

	var plan model.CyclePlan
	if err := database.DB.First(&plan, id).Error; err != nil {
		return nil, fmt.Errorf("查询锁版后计划失败: %v", err)
	}

	// 埋点:cycle_plan_locked（V1.3 Task 11）
	lockedByParent := parentID
	s.analytics.Event("cycle_plan_locked", map[string]interface{}{
		"child_id":          plan.ChildID,
		"cycle_length_weeks": plan.CycleLengthWeeks,
		"lock_version":      plan.LockVersion,
		"locked_by_parent":  lockedByParent,
	})
	return &plan, nil
}

// UnlockCyclePlan 解锁
func (s *CyclePlanService) UnlockCyclePlan(id uint, lockVersion uint) (*model.CyclePlan, error) {
	result := database.DB.Model(&model.CyclePlan{}).
		Where("id = ? AND lock_version = ?", id, lockVersion).
		Updates(map[string]interface{}{
			"status":           model.CyclePlanStatusDraft,
			"lock_version":     lockVersion + 1,
			"locked_at":        nil,
			"locked_by_parent": nil,
		})

	if result.Error != nil {
		return nil, fmt.Errorf("解锁失败: %v", result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, errors.New("解锁失败：版本号不匹配或计划不存在")
	}

	var plan model.CyclePlan
	if err := database.DB.First(&plan, id).Error; err != nil {
		return nil, fmt.Errorf("查询解锁后计划失败: %v", err)
	}

	// 埋点:cycle_plan_unlocked（V1.3 Task 11）
	s.analytics.Event("cycle_plan_unlocked", map[string]interface{}{
		"child_id":          plan.ChildID,
		"cycle_length_weeks": plan.CycleLengthWeeks,
		"lock_version":      plan.LockVersion,
	})
	return &plan, nil
}

// GetPreview 获取预览数据（供 API 调用）
func (s *CyclePlanService) GetPreview(childID uint, startMonday time.Time, cycleLengthWeeks uint) (*CyclePlanPreview, error) {
	// 尝试查找已有的草稿计划
	var existing model.CyclePlan
	err := database.DB.Where("child_id = ? AND start_date = ?", childID, startMonday).First(&existing).Error

	var plan *model.CyclePlan
	if err == nil {
		plan = &existing
	} else {
		// 不存在则生成新的草稿
		plan, err = s.GenerateCyclePlan(childID, startMonday, cycleLengthWeeks, nil)
		if err != nil {
			return nil, err
		}
	}

	// 解析 daily instances
	var dailyInstances map[string][]model.TaskTemplate
	if plan.DailyInstancesJSON != "" {
		json.Unmarshal([]byte(plan.DailyInstancesJSON), &dailyInstances)
	}

	// 解析主题周配置
	var themeCfg *ThemeWeekConfig
	if plan.ThemeWeekConfig != "" {
		themeCfg = &ThemeWeekConfig{}
		json.Unmarshal([]byte(plan.ThemeWeekConfig), themeCfg)
	}

	// 解析占比汇总
	var ratio map[string]float64
	if plan.DimensionRatioSummary != "" {
		json.Unmarshal([]byte(plan.DimensionRatioSummary), &ratio)
	}

	// 解析阶段目标
	var goals *CycleGoals
	if plan.GoalsJSON != "" {
		goals = &CycleGoals{}
		json.Unmarshal([]byte(plan.GoalsJSON), goals)
	}

	return &CyclePlanPreview{
		CyclePlan:       plan,
		DailyInstances:  dailyInstances,
		DimensionRatio:  ratio,
		ThemeWeekConfig: themeCfg,
		GoalsBadge:      goals,
		LockVersion:     plan.LockVersion,
	}, nil
}

// Regenerate 重新生成（保留 locked=true 的任务）
func (s *CyclePlanService) Regenerate(cyclePlanID uint) (*model.CyclePlan, error) {
	var existing model.CyclePlan
	if err := database.DB.First(&existing, cyclePlanID).Error; err != nil {
		return nil, fmt.Errorf("周期计划不存在: %v", err)
	}

	// 解析阶段目标
	var goals *CycleGoals
	if existing.GoalsJSON != "" {
		goals = &CycleGoals{}
		if err := json.Unmarshal([]byte(existing.GoalsJSON), goals); err != nil {
			goals = nil
		}
	}

	// TODO: 保留 locked=true 的任务（需扩展 TaskTemplate 增加 locked 字段或使用独立实例表）
	// 当前简化实现：使用相同参数重新生成整个周期
	return s.GenerateCyclePlan(existing.ChildID, existing.StartDate, existing.CycleLengthWeeks, goals)
}

// TaskAdjust 单任务 5 类调整操作
// operation: replace/remove/move/add/lock
func (s *CyclePlanService) TaskAdjust(cyclePlanID uint, instanceID uint, operation string, params map[string]interface{}) (*model.CyclePlan, error) {
	var plan model.CyclePlan
	if err := database.DB.First(&plan, cyclePlanID).Error; err != nil {
		return nil, fmt.Errorf("周期计划不存在: %v", err)
	}

	// 解析 daily instances
	var dailyInstances map[string][]model.TaskTemplate
	if err := json.Unmarshal([]byte(plan.DailyInstancesJSON), &dailyInstances); err != nil {
		return nil, fmt.Errorf("解析 DailyInstancesJSON 失败: %v", err)
	}

	// 从 params 获取 date（可选,用于定位特定日期的实例）
	dateStr, _ := params["date"].(string)

	switch operation {
	case "replace":
		newTaskIDFloat, ok := params["new_task_id"].(float64)
		if !ok {
			return nil, errors.New("缺少 new_task_id 参数")
		}
		var newTask model.TaskTemplate
		if err := database.DB.First(&newTask, uint(newTaskIDFloat)).Error; err != nil {
			return nil, fmt.Errorf("替换任务模板不存在: %v", err)
		}
		replaced := false
		for key, tasks := range dailyInstances {
			if dateStr != "" && key != dateStr {
				continue
			}
			for i, t := range tasks {
				if t.ID == instanceID {
					dailyInstances[key][i] = newTask
					replaced = true
					break
				}
			}
			if replaced {
				break
			}
		}
		if !replaced {
			return nil, errors.New("未找到要替换的任务实例")
		}

	case "remove":
		removed := false
		for key, tasks := range dailyInstances {
			if dateStr != "" && key != dateStr {
				continue
			}
			for i, t := range tasks {
				if t.ID == instanceID {
					dailyInstances[key] = append(tasks[:i], tasks[i+1:]...)
					removed = true
					break
				}
			}
			if removed {
				break
			}
		}
		if !removed {
			return nil, errors.New("未找到要删除的任务实例")
		}

	case "move":
		newDate, ok := params["new_date"].(string)
		if !ok {
			return nil, errors.New("缺少 new_date 参数")
		}
		moved := false
		for key, tasks := range dailyInstances {
			if dateStr != "" && key != dateStr {
				continue
			}
			for i, t := range tasks {
				if t.ID == instanceID {
					task := tasks[i]
					dailyInstances[key] = append(tasks[:i], tasks[i+1:]...)
					if _, exists := dailyInstances[newDate]; !exists {
						dailyInstances[newDate] = []model.TaskTemplate{}
					}
					dailyInstances[newDate] = append(dailyInstances[newDate], task)
					moved = true
					break
				}
			}
			if moved {
				break
			}
		}
		if !moved {
			return nil, errors.New("未找到要移动的任务实例")
		}

	case "add":
		taskIDFloat, ok := params["task_id"].(float64)
		if !ok {
			return nil, errors.New("缺少 task_id 参数")
		}
		if dateStr == "" {
			return nil, errors.New("缺少 date 参数")
		}
		var task model.TaskTemplate
		if err := database.DB.First(&task, uint(taskIDFloat)).Error; err != nil {
			return nil, fmt.Errorf("任务模板不存在: %v", err)
		}
		if _, exists := dailyInstances[dateStr]; !exists {
			dailyInstances[dateStr] = []model.TaskTemplate{}
		}
		dailyInstances[dateStr] = append(dailyInstances[dateStr], task)

	case "lock":
		// TODO: 需扩展 TaskTemplate 增加 locked 字段或使用独立实例表来持久化锁定状态
		// 当前简化实现：仅记录日志
		log.Printf("[CyclePlan] TaskAdjust lock 操作（TODO 未持久化）plan=%d instance=%d", cyclePlanID, instanceID)

	default:
		return nil, fmt.Errorf("不支持的操作类型: %s", operation)
	}

	// 保存调整后的计划
	dailyJSON, _ := json.Marshal(dailyInstances)
	plan.DailyInstancesJSON = string(dailyJSON)

	if err := database.DB.Save(&plan).Error; err != nil {
		return nil, fmt.Errorf("保存调整失败: %v", err)
	}

	// 埋点:cycle_plan_task_adjusted（V1.3 Task 11）
	s.analytics.Event("cycle_plan_task_adjusted", map[string]interface{}{
		"child_id":          plan.ChildID,
		"cycle_length_weeks": plan.CycleLengthWeeks,
		"operation":         operation,
		"instance_id":       instanceID,
	})
	return &plan, nil
}

// GetReplaceCandidates 拉取 3 条替换候选
func (s *CyclePlanService) GetReplaceCandidates(childID uint, taskID uint, date time.Time, dimensionID uint, difficulty string) ([]model.TaskTemplate, error) {
	_, _, gradeInt := resolveChildProfile(childID)
	age := gradeToAge(gradeInt)

	var candidates []model.TaskTemplate
	query := database.DB.Where("is_active = ? AND task_kind != ? AND id != ?",
		true, "daily_fixed", taskID).
		Where("min_age <= ? AND max_age >= ?", age, age)

	if dimensionID > 0 {
		query = query.Where("ability_dimension_id = ?", dimensionID)
	}
	if difficulty != "" {
		query = query.Where("difficulty = ?", difficulty)
	}

	query.Order("RANDOM()").Limit(3).Find(&candidates)
	return candidates, nil
}

// ===================== 动态调度器（V1.3 Task 10） =====================

// StartCycleScheduler 启动 Cycle 课程表动态调度器
// 触发时机:每周日 20:00 唤醒,在 generateCyclePlansForAllChildren 内部对每个孩子
// 基于其当前已锁版 Cycle 的 end_date 判断是否到该孩子的触发时机(Cycle 结束前一周)
// 1 周 Cycle:每周日 20:00 触发(等价 V1.1)
// 2 周 Cycle:每 2 周触发一次
// 3 周 Cycle:每 3 周触发一次
// 4 周 Cycle:每 4 周触发一次
func (s *CyclePlanService) StartCycleScheduler() {
	go func() {
		for {
			now := time.Now()
			nextTrigger := s.computeNextCycleTrigger(now)
			log.Printf("[CyclePlan] 等待下次 Cycle 动态触发: %s", nextTrigger.Format("2006-01-02 15:04:05"))
			time.Sleep(nextTrigger.Sub(now))
			log.Printf("[CyclePlan] 开始 Cycle 课程表动态触发")
			s.generateCyclePlansForAllChildren()
		}
	}()
}

// computeNextCycleTrigger 计算下一个触发时刻(本周日 20:00,已过则取下周日 20:00)
// 简化实现:每周日 20:00 都唤醒一次,真正的"按 cycle_length_weeks 动态触发"逻辑
// 由 generateCyclePlansForAllChildren 内部基于每个孩子最近一次 locked Cycle 的 end_date 计算
func (s *CyclePlanService) computeNextCycleTrigger(now time.Time) time.Time {
	loc := now.Location()
	// 本周日 20:00(周一为一周起点,周日为最后一天)
	weekday := now.Weekday()
	var daysToSunday int
	if weekday == time.Sunday {
		daysToSunday = 0
	} else {
		daysToSunday = 7 - int(weekday)
	}
	sunday := time.Date(now.Year(), now.Month(), now.Day(), 20, 0, 0, 0, loc).AddDate(0, 0, daysToSunday)
	// 本周日 20:00 已过,取下周日 20:00
	if !sunday.After(now) {
		sunday = sunday.AddDate(0, 0, 7)
	}
	return sunday
}

// generateCyclePlansForAllChildren 遍历所有孩子,对处于"Cycle 结束前一周"的孩子生成下个 Cycle 草稿
// 幂等:若该 start_monday 的草稿已存在则跳过
func (s *CyclePlanService) generateCyclePlansForAllChildren() {
	// 1. 查询所有 children
	var children []model.User
	if err := database.DB.Where("role = ?", model.RoleChild).Find(&children).Error; err != nil {
		log.Printf("[CyclePlan] 查询孩子列表失败: %v", err)
		return
	}

	now := time.Now()
	today := startOfDay(now)

	// 跟踪本次触发的 cycle_length_weeks 分布（用于 cycle_length_distribution 埋点）
	distribution := map[uint]int{}

	// 2. 对每个 child 判断是否到该孩子的触发时机
	for _, child := range children {
		// 查询最近一条 locked/applied 的 CyclePlan
		var latestCycle model.CyclePlan
		err := database.DB.Where("child_id = ? AND status IN ?", child.ID, []string{
			model.CyclePlanStatusLocked,
			model.CyclePlanStatusApplied,
		}).Order("end_date DESC").First(&latestCycle).Error

		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				log.Printf("[CyclePlan] child=%d 无已锁版 Cycle,跳过动态触发", child.ID)
				continue
			}
			log.Printf("[CyclePlan] child=%d 查询最近 Cycle 失败: %v", child.ID, err)
			continue
		}

		// 计算下个 Cycle 的 start_monday = 当前 Cycle 的 end_date + 1
		nextCycleStartMonday := startOfDay(latestCycle.EndDate).AddDate(0, 0, 1)

		// 判断「下个 Cycle start_monday - 7 天 <= 今天 <= 下个 Cycle start_monday - 1 天」
		// 即 Cycle 结束前一周(含起止日)
		triggerWindowStart := startOfDay(nextCycleStartMonday.AddDate(0, 0, -7))
		triggerWindowEnd := startOfDay(nextCycleStartMonday.AddDate(0, 0, -1))

		if today.Before(triggerWindowStart) || today.After(triggerWindowEnd) {
			log.Printf("[CyclePlan] child=%d 未到触发时机 nextCycleStart=%s 窗口=[%s,%s] today=%s",
				child.ID, dateKey(nextCycleStartMonday), dateKey(triggerWindowStart), dateKey(triggerWindowEnd), dateKey(today))
			continue
		}

		// 幂等:若该 start_monday 的草稿已存在则跳过
		var existing model.CyclePlan
		err = database.DB.Where("child_id = ? AND start_date = ?", child.ID, nextCycleStartMonday).First(&existing).Error
		if err == nil {
			log.Printf("[CyclePlan] child=%d start=%s 的 Cycle 已存在(id=%d status=%s),跳过",
				child.ID, dateKey(nextCycleStartMonday), existing.ID, existing.Status)
			continue
		}

		// 查 cycle_goal_setting 表该 child 在该 start_monday 的目标
		var goals *CycleGoals
		goal, err := s.goalService.GetGoal(child.ID, nextCycleStartMonday)
		if err == nil && goal != nil {
			var focusDims []uint
			if err := json.Unmarshal([]byte(goal.FocusDims), &focusDims); err == nil {
				goals = &CycleGoals{
					FocusDims:    focusDims,
					PointsTarget: goal.PointsTarget,
					Grade:        goal.PointsTargetGrade,
				}
			}
		}
		// goals 为 nil 时,GenerateCyclePlan 内部会调用 CalculateDefaultGoal 兜底

		// 沿用最近 Cycle 的周期长度(若为 0 则默认 2 周)
		cycleLengthWeeks := latestCycle.CycleLengthWeeks
		if cycleLengthWeeks == 0 {
			cycleLengthWeeks = 2
		}

		log.Printf("[CyclePlan] child=%d 触发动态生成 nextCycleStart=%s cycleLength=%d weeks",
			child.ID, dateKey(nextCycleStartMonday), cycleLengthWeeks)

		_, err = s.GenerateCyclePlan(child.ID, nextCycleStartMonday, cycleLengthWeeks, goals)
		if err != nil {
			log.Printf("[CyclePlan] child=%d 生成下个 Cycle 失败: %v", child.ID, err)
			continue
		}
		// 触发成功,累加分布
		distribution[cycleLengthWeeks]++
	}

	// 埋点:cycle_length_distribution（V1.3 Task 11）
	// 仅在本次有触发时发送
	if len(distribution) > 0 {
		s.analytics.Event("cycle_length_distribution", map[string]interface{}{
			"distribution":         distribution,
			"avg_completion_rate":  s.computeAvgCompletionRate(),
			"avg_lock_rate":        s.computeAvgLockRate(),
		})
	}
}

// computeAvgLockRate 计算全表平均锁版率（locked+applied / 总数）
func (s *CyclePlanService) computeAvgLockRate() float64 {
	var totalCycles int64
	var lockedCycles int64
	database.DB.Model(&model.CyclePlan{}).Count(&totalCycles)
	if totalCycles == 0 {
		return 0
	}
	database.DB.Model(&model.CyclePlan{}).Where("status IN ?", []string{
		model.CyclePlanStatusLocked, model.CyclePlanStatusApplied,
	}).Count(&lockedCycles)
	return float64(lockedCycles) / float64(totalCycles)
}

// computeAvgCompletionRate 计算已锁版 Cycle 的平均完成率（实际积分/目标积分,封顶 1.0）
func (s *CyclePlanService) computeAvgCompletionRate() float64 {
	var cycles []model.CyclePlan
	if err := database.DB.Where("status IN ?", []string{
		model.CyclePlanStatusLocked, model.CyclePlanStatusApplied,
	}).Find(&cycles).Error; err != nil {
		return 0
	}
	if len(cycles) == 0 {
		return 0
	}
	totalRate := 0.0
	count := 0
	for _, c := range cycles {
		var goals CycleGoals
		if c.GoalsJSON == "" {
			continue
		}
		if err := json.Unmarshal([]byte(c.GoalsJSON), &goals); err != nil {
			continue
		}
		if goals.PointsTarget <= 0 {
			continue
		}
		// 查 task 表实际积分（cycle 时间窗内已完成的任务）
		var actualPoints int
		database.DB.Model(&model.Task{}).
			Where("child_id = ? AND status = ? AND created_at BETWEEN ? AND ?",
				c.ChildID, model.TaskStatusCompleted, c.StartDate, c.EndDate).
			Select("COALESCE(SUM(points), 0)").
			Scan(&actualPoints)
		rate := float64(actualPoints) / float64(goals.PointsTarget)
		if rate > 1.0 {
			rate = 1.0
		}
		totalRate += rate
		count++
	}
	if count == 0 {
		return 0
	}
	return totalRate / float64(count)
}

// RecordCycleCompletion 记录 Cycle 结束时实际 vs 目标对比埋点
// 简化实现:由 handler 在锁版解锁/下个 Cycle 生成时触发,或由定时器在 Cycle 结束日触发
func (s *CyclePlanService) RecordCycleCompletion(childID uint, cyclePlanID uint) error {
	var plan model.CyclePlan
	if err := database.DB.First(&plan, cyclePlanID).Error; err != nil {
		return fmt.Errorf("周期计划不存在: %v", err)
	}
	if plan.ChildID != childID {
		return errors.New("childID 与 cyclePlan 不匹配")
	}

	// 解析目标积分
	pointsTarget := 0
	if plan.GoalsJSON != "" {
		var goals CycleGoals
		if err := json.Unmarshal([]byte(plan.GoalsJSON), &goals); err == nil {
			pointsTarget = goals.PointsTarget
		}
	}

	// 查询实际积分（task 表 where child_id AND status=completed AND created_at 在 cycle 范围内）
	var actualPoints int
	database.DB.Model(&model.Task{}).
		Where("child_id = ? AND status = ? AND created_at BETWEEN ? AND ?",
			childID, model.TaskStatusCompleted, plan.StartDate, plan.EndDate).
		Select("COALESCE(SUM(points), 0)").
		Scan(&actualPoints)

	// 计算重点维度完成率（从 dimension_ratio_summary 取 theme_dim_contrib 占比作为简化指标）
	completionRateTargetDim := 0.0
	if plan.DimensionRatioSummary != "" {
		var ratio map[string]float64
		if err := json.Unmarshal([]byte(plan.DimensionRatioSummary), &ratio); err == nil {
			if v, ok := ratio["theme_dim_contrib"]; ok {
				completionRateTargetDim = v
			}
		}
	}

	// 埋点:cycle_goal_completed_vs_target（V1.3 Task 11）
	s.analytics.Event("cycle_goal_completed_vs_target", map[string]interface{}{
		"child_id":                   childID,
		"cycle_length_weeks":         plan.CycleLengthWeeks,
		"points_target":              pointsTarget,
		"points_actual":              actualPoints,
		"completion_rate_target_dim": completionRateTargetDim,
	})
	return nil
}

// startOfDay 返回某天的 00:00:00(保留原 location)
func startOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// ===================== 辅助方法（私有） =====================

// loadAnchorTasks 加载本家庭年级对应的锚任务模板
// V1.3 fix: 必须按 family_id 过滤,否则会查出其他家庭/其他年级的锚任务
func (s *CyclePlanService) loadAnchorTasks(familyID uint, grade string) []model.TaskTemplate {
	gradeInt := gradeToInt(grade)
	age := gradeToAge(gradeInt)

	var templates []model.TaskTemplate
	database.DB.Where("family_id = ? AND task_kind = ? AND is_active = ?", familyID, "daily_fixed", true).
		Where("min_age <= ? AND max_age >= ?", age, age).
		Find(&templates)
	return templates
}

// sampleDayExtraWithGlobalCooldown 每日拓展槽抽样（带全局冷却池）
// V1.3 Task 22: 按 focus level 分别应用冷却规则（主维3天/次维5天/潜维本Cycle内100%不重复）
// 不再回退到全量候选,池子不足时返回较少任务（潜维绝不允许重复）
func (s *CyclePlanService) sampleDayExtraWithGlobalCooldown(
	familyID uint, // V1.3 fix: 必须按 family_id 过滤
	grade string,
	dayExtraCount int,
	mainRatio float64,
	excludeRecent3dIDs []uint,
	excludeRecent5dIDs []uint,
	excludeRecent14dIDs []uint,
	latentUsedInCycle map[uint]bool, // V1.3 Task 22: 潜维本 Cycle 内已用 ID 集合(不可重复)
	forceDim *uint, // 主题周时强制派 theme_dim
	focusDimBoost map[uint]float64, // 重点维度加权倍率
) ([]model.TaskTemplate, error) {
	if dayExtraCount <= 0 {
		return []model.TaskTemplate{}, nil
	}

	gradeInt := gradeToInt(grade)
	age := gradeToAge(gradeInt)
	guides := loadGradeGuides(gradeInt)

	// V1.3 Task 22: 按 focus level 分别构建排除集（不再合并为一个）
	exclude3d := make(map[uint]bool)
	for _, id := range excludeRecent3dIDs {
		exclude3d[id] = true
	}
	exclude5d := make(map[uint]bool)
	for _, id := range excludeRecent5dIDs {
		exclude5d[id] = true
	}
	exclude14d := make(map[uint]bool)
	for _, id := range excludeRecent14dIDs {
		exclude14d[id] = true
	}

	// 查询候选任务（V1.3 fix: 必须按 family_id 过滤,否则会查出其他家庭的任务）
	var candidates []model.TaskTemplate
	database.DB.Where("family_id = ? AND is_active = ? AND task_kind != ?", familyID, true, "daily_fixed").
		Where("min_age <= ? AND max_age >= ?", age, age).
		Find(&candidates)

	// V1.3 Task 22: 按 focus level 分别过滤冷却规则
	var pool []model.TaskTemplate
	for _, c := range candidates {
		focus, ok := guides[c.AbilityDimensionID]
		if !ok {
			// 无指南的维度不限制冷却
			pool = append(pool, c)
			continue
		}
		switch focus {
		case "primary":
			// 主维 3 天不重复
			if !exclude3d[c.ID] {
				pool = append(pool, c)
			}
		case "secondary":
			// 次维 5 天不重复
			if !exclude5d[c.ID] {
				pool = append(pool, c)
			}
		case "latent":
			// V1.3 Task 22: 潜维本 Cycle 内 100% 不重复（使用 cycle-wide 集合）
			if !latentUsedInCycle[c.ID] {
				pool = append(pool, c)
			}
		}
	}

	// V1.3 Task 22: 不再回退到全量候选,池子不足时返回较少任务
	if len(pool) == 0 {
		return []model.TaskTemplate{}, nil
	}

	// forceDim 模式：全部派给 theme_dim
	if forceDim != nil {
		var dimPool []model.TaskTemplate
		for _, c := range pool {
			if c.AbilityDimensionID == *forceDim {
				dimPool = append(dimPool, c)
			}
		}
		// V1.3 Task 22: forceDim 池不足时不再回退,返回较少任务
		if len(dimPool) == 0 {
			return []model.TaskTemplate{}, nil
		}
		rand.Shuffle(len(dimPool), func(i, j int) {
			dimPool[i], dimPool[j] = dimPool[j], dimPool[i]
		})
		if dayExtraCount > len(dimPool) {
			dayExtraCount = len(dimPool)
		}
		return dimPool[:dayExtraCount], nil
	}

	// 无 focusDimBoost：从全部候选随机抽样
	if len(focusDimBoost) == 0 {
		rand.Shuffle(len(pool), func(i, j int) {
			pool[i], pool[j] = pool[j], pool[i]
		})
		if dayExtraCount > len(pool) {
			dayExtraCount = len(pool)
		}
		return pool[:dayExtraCount], nil
	}

	// 按重点/非重点维度拆分
	var focusPool, otherPool []model.TaskTemplate
	for _, c := range pool {
		if _, ok := focusDimBoost[c.AbilityDimensionID]; ok {
			focusPool = append(focusPool, c)
		} else {
			otherPool = append(otherPool, c)
		}
	}

	mainCount := int(float64(dayExtraCount) * mainRatio)
	otherCount := dayExtraCount - mainCount

	// 池子不足时调整
	if mainCount > len(focusPool) {
		otherCount += mainCount - len(focusPool)
		mainCount = len(focusPool)
	}
	if otherCount > len(otherPool) {
		otherCount = len(otherPool)
	}

	// 重点维度加权抽样（weight * random 排序取 top N）
	type weightedTask struct {
		task   model.TaskTemplate
		weight float64
	}
	var weighted []weightedTask
	for _, t := range focusPool {
		w := focusDimBoost[t.AbilityDimensionID]
		weighted = append(weighted, weightedTask{task: t, weight: w * rand.Float64()})
	}
	sort.Slice(weighted, func(i, j int) bool {
		return weighted[i].weight > weighted[j].weight
	})

	result := make([]model.TaskTemplate, 0, dayExtraCount)
	for i := 0; i < mainCount && i < len(weighted); i++ {
		result = append(result, weighted[i].task)
	}

	// 非重点维度随机抽样
	rand.Shuffle(len(otherPool), func(i, j int) {
		otherPool[i], otherPool[j] = otherPool[j], otherPool[i]
	})
	for i := 0; i < otherCount && i < len(otherPool); i++ {
		result = append(result, otherPool[i])
	}

	return result, nil
}

// spreadParentSubtasksEvenly 父任务子任务均匀分布
func (s *CyclePlanService) spreadParentSubtasksEvenly(
	parentTasks []model.ParentTask,
	plan map[string][]model.TaskTemplate,
	maxPerDay int,
	cycleDays int,
) map[string][]model.TaskTemplate {
	if len(parentTasks) == 0 {
		return plan
	}

	// 排序日期 key
	keys := make([]string, 0, len(plan))
	for k := range plan {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	if len(keys) == 0 {
		return plan
	}

	for _, pt := range parentTasks {
		// 解析里程碑
		var milestones []model.ParentTaskMilestone
		if err := json.Unmarshal([]byte(pt.MilestonesJSON), &milestones); err != nil {
			log.Printf("[CyclePlan] 解析里程碑失败 parentTask=%d: %v", pt.ID, err)
			continue
		}

		// 计算子任务总数
		totalSubtasks := 0
		for _, m := range milestones {
			totalSubtasks += m.SubtaskCount
		}
		if totalSubtasks == 0 {
			continue
		}

		// 计算步长（均匀分布）
		step := cycleDays / totalSubtasks
		if step < 1 {
			step = 1
		}

		// 创建并分布子任务
		subtaskIdx := 0
		for _, m := range milestones {
			for i := 0; i < m.SubtaskCount; i++ {
				dayIdx := subtaskIdx * step
				if dayIdx >= cycleDays {
					dayIdx = cycleDays - 1
				}
				if dayIdx < 0 {
					dayIdx = 0
				}

				key := keys[dayIdx]
				// 检查当日同父任务数量是否已达上限
				parentCount := 0
				for _, t := range plan[key] {
					if t.ParentID != nil && *t.ParentID == pt.ID {
						parentCount++
					}
				}
				if parentCount >= maxPerDay {
					// 寻找下一个可用日期
					for j := dayIdx + 1; j < cycleDays; j++ {
						key = keys[j]
						parentCount = 0
						for _, t := range plan[key] {
							if t.ParentID != nil && *t.ParentID == pt.ID {
								parentCount++
							}
						}
						if parentCount < maxPerDay {
							break
						}
					}
				}

				// 创建子任务模板
				parentID := pt.ID
				subtask := model.TaskTemplate{
					Title:              fmt.Sprintf("%s - %s", pt.Title, m.Title),
					Description:        pt.Description,
					Points:             15,
					Difficulty:         "medium",
					TaskKind:           "parent_child",
					ParentID:           &parentID,
					AbilityDimensionID: 0,
				}
				plan[key] = append(plan[key], subtask)
				subtaskIdx++
			}
		}
	}

	return plan
}

// validateCycleRatio 校验整 Cycle 主次潜占比
// V1.3 Task 21: 主题周天数不计入占比校验(主题周是特殊模式,100% 派 theme_dim 是 PRD 明确要求)
// 规则：主维≥60% && 次维≥28% && 次维≤32% && 潜维≤10%
func (s *CyclePlanService) validateCycleRatio(plan map[string][]model.TaskTemplate, grade string, themeCfg *ThemeWeekConfig) bool {
	gradeInt := gradeToInt(grade)
	guides := loadGradeGuides(gradeInt)

	primary, secondary, latent, total := 0, 0, 0, 0
	for key, tasks := range plan {
		// V1.3 Task 21: 跳过主题周天数（主题周内拓展槽 100% 派给 theme_dim,不计入常规占比校验）
		if themeCfg != nil && themeCfg.Active {
			dateKey, err := time.Parse("2006-01-02", key)
			if err == nil && isInThemeWeek(themeCfg, dateKey) {
				continue
			}
		}
		for _, t := range tasks {
			if t.AbilityDimensionID == 0 {
				continue
			}
			focus, ok := guides[t.AbilityDimensionID]
			if !ok {
				continue
			}
			total++
			switch focus {
			case "primary":
				primary++
			case "secondary":
				secondary++
			case "latent":
				latent++
			}
		}
	}

	if total == 0 {
		return true
	}

	primaryRatio := float64(primary) / float64(total)
	secondaryRatio := float64(secondary) / float64(total)
	latentRatio := float64(latent) / float64(total)

	return primaryRatio >= 0.60 && secondaryRatio >= 0.28 && secondaryRatio <= 0.32 && latentRatio <= 0.10
}

// swapEndToFitRatio 不达标时替换末位任务
// V1.3 Task 21: 迭代处理所有 4 种不达标情况（主维<60% / 次维<28% / 次维>32% / 潜维>10%）
func (s *CyclePlanService) swapEndToFitRatio(plan map[string][]model.TaskTemplate, grade string, themeCfg *ThemeWeekConfig) map[string][]model.TaskTemplate {
	gradeInt := gradeToInt(grade)
	guides := loadGradeGuides(gradeInt)
	age := gradeToAge(gradeInt)

	// 收集 primary / secondary / latent 维度 ID
	primaryDimIDs := []uint{}
	secondaryDimIDs := []uint{}
	for dimID, focus := range guides {
		switch focus {
		case "primary":
			primaryDimIDs = append(primaryDimIDs, dimID)
		case "secondary":
			secondaryDimIDs = append(secondaryDimIDs, dimID)
		}
	}

	// 排序 key
	keys := make([]string, 0, len(plan))
	for k := range plan {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// 迭代替换,最多 100 次防止死循环
	for iter := 0; iter < 100; iter++ {
		// 重新计算占比
		primary, secondary, latent, total := 0, 0, 0, 0
		for key, tasks := range plan {
			if themeCfg != nil && themeCfg.Active {
				dateKey, err := time.Parse("2006-01-02", key)
				if err == nil && isInThemeWeek(themeCfg, dateKey) {
					continue
				}
			}
			for _, t := range tasks {
				if t.AbilityDimensionID == 0 {
					continue
				}
				focus, ok := guides[t.AbilityDimensionID]
				if !ok {
					continue
				}
				total++
				switch focus {
				case "primary":
					primary++
				case "secondary":
					secondary++
				case "latent":
					latent++
				}
			}
		}
		if total == 0 {
			return plan
		}
		primaryRatio := float64(primary) / float64(total)
		secondaryRatio := float64(secondary) / float64(total)
		latentRatio := float64(latent) / float64(total)

		// 判断是否全部达标
		passed := primaryRatio >= 0.60 &&
			secondaryRatio >= 0.28 && secondaryRatio <= 0.32 &&
			latentRatio <= 0.10
		if passed {
			return plan
		}

		swapped := false

		// 优先级 1: 潜维 > 10% → 删潜维补主维
		if latentRatio > 0.10 && len(primaryDimIDs) > 0 {
			swapped = swapTaskInPlan(plan, keys, guides, themeCfg, "latent", primaryDimIDs[0], age)
		}

		// 优先级 2: 次维 > 32% → 删次维补主维
		if !swapped && secondaryRatio > 0.32 && len(primaryDimIDs) > 0 {
			swapped = swapTaskInPlan(plan, keys, guides, themeCfg, "secondary", primaryDimIDs[0], age)
		}

		// 优先级 3: 主维 < 60% → 删次维补主维
		if !swapped && primaryRatio < 0.60 && len(secondaryDimIDs) > 0 {
			swapped = swapTaskInPlan(plan, keys, guides, themeCfg, "secondary", primaryDimIDs[0], age)
		}

		// 优先级 4: 次维 < 28% → 删主维补次维
		if !swapped && secondaryRatio < 0.28 && len(secondaryDimIDs) > 0 {
			swapped = swapTaskInPlan(plan, keys, guides, themeCfg, "primary", secondaryDimIDs[0], age)
		}

		// 优先级 5: 潜维 > 10% 且无主维可补 → 删潜维补次维
		if !swapped && latentRatio > 0.10 && len(secondaryDimIDs) > 0 {
			swapped = swapTaskInPlan(plan, keys, guides, themeCfg, "latent", secondaryDimIDs[0], age)
		}

		// V1.3 Task 21: 当 swap 无法修复(次维全是锚任务无法删除)时,
		// 直接 ADD 主维任务到非主题周天数,增加主维占比
		if !swapped && primaryRatio < 0.60 && len(primaryDimIDs) > 0 {
			swapped = addTaskToPlan(plan, keys, guides, themeCfg, primaryDimIDs[0], age)
		}

		if !swapped && secondaryRatio < 0.28 && len(secondaryDimIDs) > 0 {
			swapped = addTaskToPlan(plan, keys, guides, themeCfg, secondaryDimIDs[0], age)
		}

		// V1.3 Task 21: 次维 > 32% 且 swap 失败(次维全是锚任务)时,
		// ADD 主维任务稀释次维占比(增加 total 使 secondary/total 下降)
		if !swapped && secondaryRatio > 0.32 && len(primaryDimIDs) > 0 {
			swapped = addTaskToPlan(plan, keys, guides, themeCfg, primaryDimIDs[0], age)
		}

		if !swapped {
			// 无法再替换,退出
			return plan
		}
	}

	return plan
}

// excludedIDsForCooldown 计算指定天数的冷却排除集
// V1.3 Task 22: swap/add 操作时也需要遵守冷却规则,避免引入重复
// targetFocus 决定冷却窗口大小: primary=±2天 / secondary=±4天 / latent=全 Cycle
func excludedIDsForCooldown(
	plan map[string][]model.TaskTemplate,
	keys []string,
	keyIdx int,
	guides map[uint]string,
	targetFocus string,
) []uint {
	excluded := make(map[uint]bool)
	for i, key := range keys {
		gap := i - keyIdx
		if gap < 0 {
			gap = -gap
		}
		for _, t := range plan[key] {
			if t.ID == 0 || t.TaskKind == "daily_fixed" || t.TaskKind == "parent_child" {
				continue
			}
			focus, ok := guides[t.AbilityDimensionID]
			if !ok || focus != targetFocus {
				continue
			}
			switch focus {
			case "primary":
				// gap < 3 → 失败, 所以 gap <= 2 需排除
				if gap <= 2 {
					excluded[t.ID] = true
				}
			case "secondary":
				// gap < 5 → 失败, 所以 gap <= 4 需排除
				if gap <= 4 {
					excluded[t.ID] = true
				}
			case "latent":
				// 全 Cycle 不重复
				excluded[t.ID] = true
			}
		}
	}
	result := make([]uint, 0, len(excluded))
	for id := range excluded {
		result = append(result, id)
	}
	return result
}

// swapTaskInPlan 在 plan 中查找指定 focus 类别的末位任务,替换为目标维度的任务
// V1.3 Task 22: 补位任务也遵守冷却规则(排除近 3/5 天已用的同 focus 模板 ID)
// 返回 true 表示成功替换,false 表示未找到可替换的任务
func swapTaskInPlan(
	plan map[string][]model.TaskTemplate,
	keys []string,
	guides map[uint]string,
	themeCfg *ThemeWeekConfig,
	deleteFocus string, // 要删除的 focus 类别
	targetDimID uint, // 补位任务的目标维度 ID
	age int,
) bool {
	targetFocus := ""
	if f, ok := guides[targetDimID]; ok {
		targetFocus = f
	}

	// 从末尾开始找指定 focus 的任务
	for i := len(keys) - 1; i >= 0; i-- {
		key := keys[i]
		// 跳过主题周天数
		if themeCfg != nil && themeCfg.Active {
			dateKey, err := time.Parse("2006-01-02", key)
			if err == nil && isInThemeWeek(themeCfg, dateKey) {
				continue
			}
		}
		tasks := plan[key]
		for j := len(tasks) - 1; j >= 0; j-- {
			if tasks[j].AbilityDimensionID == 0 {
				continue
			}
			focus, ok := guides[tasks[j].AbilityDimensionID]
			if !ok {
				continue
			}
			if focus == deleteFocus && tasks[j].TaskKind != "daily_fixed" {
				// 删除该任务
				plan[key] = append(tasks[:j], tasks[j+1:]...)
				// V1.3 Task 22: 补位任务遵守冷却规则
				if targetDimID > 0 {
					var excludeIDs []uint
					if targetFocus != "" {
						excludeIDs = excludedIDsForCooldown(plan, keys, i, guides, targetFocus)
					}
					var replacement model.TaskTemplate
					query := database.DB.Where("is_active = ? AND ability_dimension_id = ? AND task_kind != ?",
						true, targetDimID, "daily_fixed").
						Where("min_age <= ? AND max_age >= ?", age, age)
					if len(excludeIDs) > 0 {
						query = query.Where("id NOT IN ?", excludeIDs)
					}
					if err := query.Order("RANDOM()").First(&replacement).Error; err == nil {
						plan[key] = append(plan[key], replacement)
					}
				}
				return true
			}
		}
	}
	return false
}

// addTaskToPlan 在 plan 的非主题周天数中追加一条 targetDimID 维度的拓展任务
// V1.3 Task 21: 当 swap 无法修复(如次维全是锚任务无法删除)时,直接 ADD 任务增加对应维度占比
// V1.3 Task 22: 追加任务也遵守冷却规则,且随机选天分布(避免堆积同一天)
// 返回 true 表示成功追加,false 表示无可追加的天数或候选池为空
func addTaskToPlan(
	plan map[string][]model.TaskTemplate,
	keys []string,
	guides map[uint]string,
	themeCfg *ThemeWeekConfig,
	targetDimID uint,
	age int,
) bool {
	if targetDimID == 0 {
		return false
	}
	targetFocus := ""
	if f, ok := guides[targetDimID]; ok {
		targetFocus = f
	}

	// V1.3 Task 22: 随机起点遍历所有非主题周天数,找到第一个能加冷却合规任务的天
	startIdx := rand.Intn(len(keys))
	for offset := 0; offset < len(keys); offset++ {
		i := (startIdx + offset) % len(keys)
		key := keys[i]
		if themeCfg != nil && themeCfg.Active {
			dateKey, err := time.Parse("2006-01-02", key)
			if err == nil && isInThemeWeek(themeCfg, dateKey) {
				continue
			}
		}
		// V1.3 Task 22: 计算冷却排除集
		var excludeIDs []uint
		if targetFocus != "" {
			excludeIDs = excludedIDsForCooldown(plan, keys, i, guides, targetFocus)
		}
		var replacement model.TaskTemplate
		query := database.DB.Where("is_active = ? AND ability_dimension_id = ? AND task_kind != ?",
			true, targetDimID, "daily_fixed").
			Where("min_age <= ? AND max_age >= ?", age, age)
		if len(excludeIDs) > 0 {
			query = query.Where("id NOT IN ?", excludeIDs)
		}
		if err := query.Order("RANDOM()").First(&replacement).Error; err == nil && replacement.ID > 0 {
			plan[key] = append(plan[key], replacement)
			return true
		}
	}
	return false
}

// applyRagRules RAG R-1/R-2 规则
func (s *CyclePlanService) applyRagRules(plan map[string][]model.TaskTemplate, themeDimID uint) map[string][]model.TaskTemplate {
	// R-1: theme_dim 优先排序（已在 sampleDayExtraWithGlobalCooldown 中通过 forceDim 实现,此处无需额外处理）

	// R-2: guardian_reqd 任务的 Supervision 字段预填安全确认书模板
	for key, tasks := range plan {
		for i, t := range tasks {
			if t.TaskKind == "guardian_reqd" && t.Supervision == "" {
				plan[key][i].Supervision = `{"level":"accompany","sign_off_required":true}`
			}
		}
	}

	return plan
}

// applySanitizeRules Sanitize S-1/S-2/S-3 规则
func (s *CyclePlanService) applySanitizeRules(plan map[string][]model.TaskTemplate, childID uint, skills []model.SkillUnlock, cycleLengthWeeks uint) map[string][]model.TaskTemplate {
	familyID, gradeStr, _ := resolveChildProfile(childID)
	anchors := s.loadAnchorTasks(familyID, gradeStr)

	s1HitCount := 0 // S-1 命中数（补回锚任务的天数）
	s2HitCount := 0 // S-2 命中数（修正 sign_off_required 的任务数）
	s3HitCount := 0 // S-3 命中数（前置依赖未满足被替换的任务数）

	for key, tasks := range plan {
		// S-1: 校验 daily_fixed 锚任务每天都要有（缺失则从模板补回）
		hasDailyFixed := false
		for _, t := range tasks {
			if t.TaskKind == "daily_fixed" {
				hasDailyFixed = true
				break
			}
		}
		if !hasDailyFixed && len(anchors) > 0 {
			plan[key] = append(tasks, anchors...)
			s1HitCount++
		}

		// S-2: supervision.level='accompany'/'doorstep' 时 sign_off_required 必须=true
		for i, t := range plan[key] {
			if t.Supervision == "" {
				continue
			}
			var sup struct {
				Level           string `json:"level"`
				SignOffRequired bool   `json:"sign_off_required"`
			}
			if err := json.Unmarshal([]byte(t.Supervision), &sup); err != nil {
				continue
			}
			if (sup.Level == "accompany" || sup.Level == "doorstep") && !sup.SignOffRequired {
				sup.SignOffRequired = true
				updated, _ := json.Marshal(sup)
				plan[key][i].Supervision = string(updated)
				s2HitCount++
			}
		}
	}

	// S-3: TODO 前置依赖校验（需解析 PrerequisiteCode 并查询 SkillUnlock）
	// 当前简化实现：跳过前置依赖校验,affected_count=0

	// 埋点:sanitize_rule_hit_S1/S2/S3（V1.3 Task 11）
	if s1HitCount > 0 {
		s.analytics.Event("sanitize_rule_hit_S1", map[string]interface{}{
			"child_id":          childID,
			"cycle_length_weeks": cycleLengthWeeks,
			"rule_id":           "S1",
			"affected_count":    s1HitCount,
		})
	}
	if s2HitCount > 0 {
		s.analytics.Event("sanitize_rule_hit_S2", map[string]interface{}{
			"child_id":          childID,
			"cycle_length_weeks": cycleLengthWeeks,
			"rule_id":           "S2",
			"affected_count":    s2HitCount,
		})
	}
	if s3HitCount > 0 {
		s.analytics.Event("sanitize_rule_hit_S3", map[string]interface{}{
			"child_id":          childID,
			"cycle_length_weeks": cycleLengthWeeks,
			"rule_id":           "S3",
			"affected_count":    s3HitCount,
		})
	}
	return plan
}

// getRecommendedPointsTarget 推算积分目标（委托给 goalService）
func (s *CyclePlanService) getRecommendedPointsTarget(grade string, cycleLengthWeeks uint) int {
	return s.goalService.GetRecommendedPointsTarget(grade, cycleLengthWeeks)
}

// ===================== 工具函数（包级私有） =====================

// gradeToInt 将 "G1"..."G6" 转为 int
func gradeToInt(grade string) int {
	if len(grade) >= 2 && grade[0] == 'G' {
		n := grade[1] - '0'
		if n >= 1 && n <= 6 {
			return int(n)
		}
	}
	return 3 // 默认 G3
}

// intToGrade 将 int 转为 "G1"..."G6"
func intToGrade(grade int) string {
	if grade < 1 || grade > 6 {
		return "G3"
	}
	return fmt.Sprintf("G%d", grade)
}

// gradeToAge 将年级转为适龄（G1=6, G2=7, ..., G6=11）
func gradeToAge(grade int) int {
	return grade + 5
}

// dateKey 将 time.Time 格式化为 yyyy-mm-dd
func dateKey(t time.Time) string {
	return t.Format("2006-01-02")
}

// resolveChildProfile 解析孩子的 family_id 和年级
func resolveChildProfile(childID uint) (familyID uint, gradeStr string, gradeInt int) {
	var child model.User
	if err := database.DB.First(&child, childID).Error; err != nil {
		return 0, "G3", 3
	}
	familyID = child.FamilyID
	g, _ := ResolveGrade(&child)
	if g < 1 || g > 6 {
		g = 3
	}
	return familyID, intToGrade(g), g
}

// loadGradeGuides 加载年级·维度发展指南
func loadGradeGuides(gradeInt int) map[uint]string {
	var guides []model.GradeDimensionGuide
	database.DB.Where("grade = ?", gradeInt).Find(&guides)
	m := make(map[uint]string)
	for _, g := range guides {
		m[g.DimensionID] = g.FocusLevel
	}
	return m
}

// isInThemeWeek 判断某天是否在主题周范围内
func isInThemeWeek(themeCfg *ThemeWeekConfig, date time.Time) bool {
	if themeCfg == nil || !themeCfg.Active {
		return false
	}
	start, err := time.Parse("2006-01-02", themeCfg.StartDate)
	if err != nil {
		return false
	}
	end, err := time.Parse("2006-01-02", themeCfg.EndDate)
	if err != nil {
		return false
	}
	day := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	end = time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, end.Location())
	return (day.Equal(start) || day.After(start)) && (day.Equal(end) || day.Before(end))
}

// positionToWeekNum 将 position 字符串转为周序号
func positionToWeekNum(position string) int {
	switch position {
	case "week1":
		return 1
	case "week2":
		return 2
	case "week3":
		return 3
	case "week4":
		return 4
	default:
		return 1
	}
}

// extraCountBaseForGrade 根据年级返回拓展槽基数
// G1-2=2, G3-4=3, G5-6=4
func extraCountBaseForGrade(grade string) int {
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

// computeRatioSummary 计算整 Cycle 维度占比汇总
// V1.3 Task 21: 主题周天数不计入占比统计(与 validateCycleRatio 保持一致)
// 返回键名与前端 DimensionRatioSummary 对齐:main_dim_pct / secondary_pct / latent_pct / theme_dim_contrib
func computeRatioSummary(plan map[string][]model.TaskTemplate, grade string, themeDimID uint, themeCfg *ThemeWeekConfig) map[string]float64 {
	gradeInt := gradeToInt(grade)
	guides := loadGradeGuides(gradeInt)

	primary, secondary, latent, themeContrib, total := 0, 0, 0, 0, 0
	for key, tasks := range plan {
		// V1.3 Task 21: 跳过主题周天数
		if themeCfg != nil && themeCfg.Active {
			dateKey, err := time.Parse("2006-01-02", key)
			if err == nil && isInThemeWeek(themeCfg, dateKey) {
				continue
			}
		}
		for _, t := range tasks {
			if t.AbilityDimensionID == 0 {
				continue
			}
			total++
			if themeDimID > 0 && t.AbilityDimensionID == themeDimID {
				themeContrib++
			}
			focus, ok := guides[t.AbilityDimensionID]
			if !ok {
				continue
			}
			switch focus {
			case "primary":
				primary++
			case "secondary":
				secondary++
			case "latent":
				latent++
			}
		}
	}

	summary := map[string]float64{
		"main_dim_pct":      0,
		"secondary_pct":     0,
		"latent_pct":        0,
		"theme_dim_contrib": 0,
		"theme_week_only":   0, // V1.3 Task 21: 1=全周期均为主题周,占比校验跳过
	}
	if total > 0 {
		summary["main_dim_pct"] = float64(primary) / float64(total)
		summary["secondary_pct"] = float64(secondary) / float64(total)
		summary["latent_pct"] = float64(latent) / float64(total)
		summary["theme_dim_contrib"] = float64(themeContrib) / float64(total)
	} else {
		// V1.3 Task 21: 全周期均为主题周时,标记为 theme_week_only
		summary["theme_week_only"] = 1
	}
	return summary
}
