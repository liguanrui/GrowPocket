package service

import (
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"growpocket/internal/util/timeutil"
	"log"
	"time"
)

// HabitService 负责习惯每日子任务生成与打卡统计维护
type HabitService struct {
	aiService *AIService
}

// NewHabitService 创建习惯服务（aiService 用于生成鼓励语，可为 nil 时走降级文案）
func NewHabitService(aiService *AIService) *HabitService {
	return &HabitService{aiService: aiService}
}

// EnsureHabitDailyReady 确保孩子当日习惯子任务就绪
// 流程：
//  1. 查询当前 active 周期下 GoalType=habit 的目标（关联 HabitID）
//  2. 对每个习惯目标：查/建 habit_master；做中断检测；幂等检查当日 habit_daily；创建当日 habit_daily
func (s *HabitService) EnsureHabitDailyReady(childID uint) error {
	// 1. 查当前 active 周期
	var cycle model.GrowthCycle
	if err := database.DB.Where("child_id = ? AND status = ?", childID, "active").First(&cycle).Error; err != nil {
		return nil // 无 active 周期，直接返回（不视为错误）
	}

	// 2. 查 GoalType=habit 的目标
	var habitGoals []model.Goal
	database.DB.Where("cycle_id = ? AND goal_type = ?", cycle.ID, "habit").Find(&habitGoals)
	if len(habitGoals) == 0 {
		return nil
	}

	// 时间窗口
	today := timeutil.Today()
	tomorrow := timeutil.Tomorrow()
	yesterday := today.AddDate(0, 0, -1)

	// 查孩子档案（取昵称用于鼓励语）
	var child model.User
	database.DB.Where("id = ?", childID).First(&child)
	childName := child.Nickname

	for _, g := range habitGoals {
		if g.HabitID == nil || *g.HabitID == 0 {
			continue
		}
		habitID := *g.HabitID

		// 查 Habit 配置
		var habit model.Habit
		if err := database.DB.Where("id = ?", habitID).First(&habit).Error; err != nil {
			log.Printf("[Habit] 习惯 %d 不存在: %v", habitID, err)
			continue
		}

		// 查/创建 habit_master（task_kind=habit_master AND habit_id=HabitID AND child_id AND status=1）
		var master model.Task
		if err := database.DB.Where("task_kind = ? AND habit_id = ? AND child_id = ? AND status = ?",
			"habit_master", habitID, childID, model.TaskStatusInProgress).First(&master).Error; err != nil {
			master = model.Task{
				FamilyID:    cycle.FamilyID,
				Title:       habit.Title,
				Points:      0,
				Status:      model.TaskStatusInProgress,
				ChildID:     childID,
				ChildName:   childName,
				TaskKind:    "habit_master",
				HabitID:     habitID,
				StreakCount: 0,
				TotalCount:  0,
				HabitGoal:   21,
			}
			if err := database.DB.Create(&master).Error; err != nil {
				log.Printf("[Habit] 创建 habit_master 失败 habit_id=%d: %v", habitID, err)
				continue
			}
		}

		// 中断检测：若 LastCheckinDate 既不是昨天也不是今天（或为空时不视为中断），StreakCount 重置为 0
		if master.LastCheckinDate != nil {
			lcd := *master.LastCheckinDate
			lcdDay := time.Date(lcd.Year(), lcd.Month(), lcd.Day(), 0, 0, 0, 0, lcd.Location())
			if !lcdDay.Equal(yesterday) && !lcdDay.Equal(today) {
				if master.StreakCount != 0 {
					master.StreakCount = 0
					if err := database.DB.Model(&master).Update("streak_count", 0).Error; err != nil {
						log.Printf("[Habit] 重置 StreakCount 失败 master=%d: %v", master.ID, err)
					}
				}
			}
		}

		// 幂等检查：当日是否已存在 habit_daily（child_id + habit_id + created_at 为今天）
		var count int64
		database.DB.Model(&model.Task{}).
			Where("task_kind = ? AND habit_id = ? AND child_id = ? AND created_at >= ? AND created_at < ?",
				"habit_daily", habitID, childID, today, tomorrow).
			Count(&count)
		if count > 0 {
			continue
		}

		// 创建当日 habit_daily
		encouragement := s.generateHabitEncouragement(master.StreakCount, master.TotalCount, master.HabitGoal, childName, habit.Title)
		daily := &model.Task{
			FamilyID:    cycle.FamilyID,
			Title:       habit.Title,
			Description: encouragement,
			Points:      5,
			Status:      model.TaskStatusInProgress,
			ChildID:     childID,
			ChildName:   childName,
			TaskKind:    "habit_daily",
			ParentID:    master.ID,
			HabitID:     habitID,
		}
		if err := database.DB.Create(daily).Error; err != nil {
			log.Printf("[Habit] 创建 habit_daily 失败 habit_id=%d: %v", habitID, err)
			continue
		}
	}
	return nil
}

// generateHabitEncouragement 调用 AI 生成 10-20 字鼓励语
// AI 调用失败或未配置时降级返回固定鼓励语
func (s *HabitService) generateHabitEncouragement(streak, total, goal int, childName, habitTitle string) string {
	const fallback = "坚持就是胜利，加油！"

	if s.aiService == nil {
		return fallback
	}

	prompt := fmt.Sprintf(`孩子「%s」正在坚持习惯「%s」
当前连续坚持 %d 天，累计 %d 天，目标 %d 天
请生成一句简短的鼓励语（10-20 字），结合坚持天数，语气温暖有童趣，只返回鼓励语本身`,
		childName, habitTitle, streak, total, goal)

	reply, err := s.aiService.Chat("你是儿童成长鼓励助手，只输出鼓励语本身。", nil, prompt)
	if err != nil || reply == "" {
		log.Printf("[Habit] AI 鼓励语生成失败，使用降级文案: %v", err)
		return fallback
	}
	return reply
}

// ReviewHabitDaily 完成习惯打卡：更新 habit_master 的 StreakCount / TotalCount / LastCheckinDate
// 用事务保证原子性
func (s *HabitService) ReviewHabitDaily(taskID uint) error {
	// 1. 查 habit_daily 任务
	var daily model.Task
	if err := database.DB.Where("id = ? AND task_kind = ?", taskID, "habit_daily").First(&daily).Error; err != nil {
		return errors.New("习惯子任务不存在")
	}
	if daily.ParentID == 0 {
		return errors.New("习惯子任务缺少父任务")
	}

	// 2. 事务更新 habit_master
	tx := database.DB.Begin()

	var master model.Task
	if err := tx.Where("id = ?", daily.ParentID).First(&master).Error; err != nil {
		tx.Rollback()
		return errors.New("习惯主任务不存在")
	}

	now := timeutil.Now()
	master.StreakCount++
	master.TotalCount++
	master.LastCheckinDate = &now

	if err := tx.Save(&master).Error; err != nil {
		tx.Rollback()
		return errors.New("更新习惯统计失败")
	}

	if err := tx.Commit().Error; err != nil {
		return errors.New("提交事务失败")
	}
	return nil
}
