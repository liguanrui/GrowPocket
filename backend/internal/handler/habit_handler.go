package handler

import (
	"growpocket/internal/database"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/internal/util/timeutil"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetPresetHabits GET /api/habits/preset?age=8
// 按年龄过滤预设习惯（template_type='habit' AND is_system=true AND is_active=true AND 年龄范围内）
// 预设习惯现在为每家庭副本，按当前家庭过滤
func GetPresetHabits(c *gin.Context) {
	ageStr := c.Query("age")
	age, err := strconv.Atoi(ageStr)
	if err != nil || age <= 0 {
		util.FailBadRequest(c, "age 参数错误")
		return
	}

	familyID := middleware.GetFamilyID(c)
	var habits []model.TaskTemplate
	if err := database.DB.
		Where("family_id = ? AND template_type = ? AND is_system = ? AND is_active = ? AND min_age <= ? AND max_age >= ?",
			familyID, "habit", true, true, age, age).
		Find(&habits).Error; err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if habits == nil {
		habits = []model.TaskTemplate{}
	}
	util.OK(c, habits)
}

type createCustomHabitReq struct {
	ChildID     uint   `json:"child_id" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

// CreateCustomHabit POST /api/habits/custom
// 创建自定义习惯（改用 TaskTemplate，TemplateType="habit", IsSystem=false 表示自定义, IsActive=true）
// 注意：TaskTemplate 无 ChildID 字段，req.ChildID 保留以兼容前端但不再使用
func CreateCustomHabit(c *gin.Context) {
	var req createCustomHabitReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	familyID := middleware.GetFamilyID(c)
	createdBy := middleware.GetUserID(c)
	tplSvc := service.NewTaskTemplateService()
	// 习惯 Category 值（life/chore/cooking 等）保持原值不做映射，前端会适配
	habit, err := tplSvc.CreateTemplate(
		familyID, createdBy,
		req.Title, req.Description, "", req.Category,
		0, 0, 0, 0, 0,
		"", "daily", "", 0,
		"habit", 0, "",
	)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, habit)
}

// GetActiveHabits GET /api/habits/active?child_id=2
// 获取当前周期绑定的习惯：查当前 active 周期的 GoalType=habit 目标关联的 HabitID，返回 TaskTemplate 列表
// Goal.HabitID 原指向 Habit.ID，现指向 TaskTemplate.ID，字段名不变
func GetActiveHabits(c *gin.Context) {
	childIDStr := c.Query("child_id")
	childID64, err := strconv.ParseUint(childIDStr, 10, 64)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "child_id 参数错误")
		return
	}
	childID := uint(childID64)
	familyID := middleware.GetFamilyID(c)

	// 查当前 active 周期（取最新一条）
	var cycle model.GrowthCycle
	if err := database.DB.
		Where("child_id = ? AND family_id = ? AND status = ?", childID, familyID, "active").
		Order("created_at DESC").
		First(&cycle).Error; err != nil {
		// 无活跃周期，返回空列表
		util.OK(c, []model.TaskTemplate{})
		return
	}

	// 查该周期下 GoalType=habit 的目标
	var goals []model.Goal
	if err := database.DB.
		Where("cycle_id = ? AND family_id = ? AND child_id = ? AND goal_type = ?", cycle.ID, familyID, childID, "habit").
		Find(&goals).Error; err != nil {
		util.FailInternal(c, err.Error())
		return
	}

	habitIDs := make([]uint, 0, len(goals))
	for _, g := range goals {
		if g.HabitID != nil {
			habitIDs = append(habitIDs, *g.HabitID)
		}
	}
	if len(habitIDs) == 0 {
		util.OK(c, []model.TaskTemplate{})
		return
	}

	var habits []model.TaskTemplate
	if err := database.DB.Where("id IN ? AND template_type = ?", habitIDs, "habit").Find(&habits).Error; err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if habits == nil {
		habits = []model.TaskTemplate{}
	}
	util.OK(c, habits)
}

type habitCheckinItem struct {
	Date      string `json:"date"`
	Completed bool   `json:"completed"`
}

// GetHabitStats GET /api/habits/:id/stats
// 返回习惯统计：查 habit_master 任务（task_kind=habit_master AND habit_id=:id）
// 返回 { streak_count, total_count, habit_goal, last_checkin_date, checkin_calendar: [{date, completed}] }
// checkin_calendar 查最近 21 天的 habit_daily 任务（按 created_at 降序）
func GetHabitStats(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil || id == 0 {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	// 查 habit_master 任务（按 child_id 过滤，避免不同孩子共享同一习惯时混淆）
	childIDStr := c.Query("child_id")
	var master model.Task
	masterQuery := database.DB.Where("task_kind = ? AND habit_id = ?", "habit_master", id)
	if childIDStr != "" {
		if cid, err := strconv.ParseUint(childIDStr, 10, 32); err == nil && cid > 0 {
			masterQuery = masterQuery.Where("child_id = ?", cid)
		}
	}
	if err := masterQuery.First(&master).Error; err != nil {
		util.FailNotFound(c, "习惯未找到或未生成任务")
		return
	}

	// 查最近 21 天的 habit_daily 任务（按虚拟时钟，与 CreatedAt 写入一致）
	since := timeutil.Now().AddDate(0, 0, -21)
	var dailyTasks []model.Task
	dailyQuery := database.DB.Where("task_kind = ? AND habit_id = ? AND child_id = ? AND created_at >= ?", "habit_daily", id, master.ChildID, since)
	if err := dailyQuery.Order("created_at DESC").Find(&dailyTasks).Error; err != nil {
		util.FailInternal(c, err.Error())
		return
	}

	checkinCalendar := make([]habitCheckinItem, 0, len(dailyTasks))
	for _, t := range dailyTasks {
		checkinCalendar = append(checkinCalendar, habitCheckinItem{
			Date:      t.CreatedAt.Format("2006-01-02"),
			Completed: t.Status == model.TaskStatusCompleted,
		})
	}

	util.OK(c, gin.H{
		"streak_count":     master.StreakCount,
		"total_count":      master.TotalCount,
		"habit_goal":       master.HabitGoal,
		"last_checkin_date": master.LastCheckinDate,
		"checkin_calendar": checkinCalendar,
	})
}
