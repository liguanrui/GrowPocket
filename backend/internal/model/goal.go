package model

import "time"

// Goal 阶段目标
type Goal struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	CycleID     uint      `gorm:"index;not null" json:"cycle_id"`
	FamilyID    uint      `gorm:"index;not null" json:"family_id"`
	ChildID     uint      `gorm:"index;not null" json:"child_id"`
	DimensionID uint      `gorm:"index;not null" json:"dimension_id"`
	TargetScore int       `gorm:"not null" json:"target_score"` // 目标提升分值
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	GoalType      string `json:"goal_type" gorm:"default:dimension"` // 目标类型：dimension/habit/parent_task
	HabitID       *uint  `json:"habit_id"`                            // 关联习惯（GoalType=habit 时）
	ParentTaskID  *uint  `json:"parent_task_id"`                      // 关联父任务（GoalType=parent_task 时）
}
