package handler

import (
	"growpocket/internal/database"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/util/timeutil"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetPresetHabits GET /api/habits/preset?age=8
// 按年龄过滤预设习惯（age >= AgeMin AND age <= AgeMax AND is_custom=false AND is_active=true）
func GetPresetHabits(c *gin.Context) {
	ageStr := c.Query("age")
	age, err := strconv.Atoi(ageStr)
	if err != nil || age <= 0 {
		util.FailBadRequest(c, "age 参数错误")
		return
	}

	var habits []model.Habit
	if err := database.DB.
		Where("age_min <= ? AND age_max >= ? AND is_custom = ? AND is_active = ?", age, age, false, true).
		Find(&habits).Error; err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if habits == nil {
		habits = []model.Habit{}
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
// 创建自定义习惯（IsCustom=true, FamilyID=从JWT获取, ChildID=请求体, IsActive=true）
func CreateCustomHabit(c *gin.Context) {
	var req createCustomHabitReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	habit := model.Habit{
		FamilyID:    middleware.GetFamilyID(c),
		ChildID:     req.ChildID,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		IsCustom:    true,
		IsActive:    true,
	}
	if err := database.DB.Create(&habit).Error; err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, habit)
}

// GetActiveHabits GET /api/habits/active?child_id=2
// 获取当前周期绑定的习惯：查当前 active 周期的 GoalType=habit 目标关联的 HabitID，返回 Habit 列表
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
		util.OK(c, []model.Habit{})
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
		util.OK(c, []model.Habit{})
		return
	}

	var habits []model.Habit
	if err := database.DB.Where("id IN ?", habitIDs).Find(&habits).Error; err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if habits == nil {
		habits = []model.Habit{}
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
