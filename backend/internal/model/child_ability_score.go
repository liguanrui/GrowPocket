package model

import "time"

// ChildAbilityScore 儿童能力维度得分
type ChildAbilityScore struct {
	ID                      uint      `gorm:"primaryKey" json:"id"`
	FamilyID                uint      `gorm:"index;not null" json:"family_id"`
	ChildID                 uint      `gorm:"index;not null" json:"child_id"`
	DimensionID             uint      `gorm:"index;not null" json:"dimension_id"`
	Score                   int       `gorm:"not null;default:0" json:"score"` // 0-100
	ConsecutiveCyclesOnTrack int      `gorm:"not null;default:0" json:"consecutive_cycles_on_track"` // 精通 5 星：连续 N 个阶段达标
	HardTasksCompleted      int       `gorm:"not null;default:0" json:"hard_tasks_completed"`         // 精通 5 星：累计 hard 难度任务数
	MasteryStars            int       `gorm:"not null;default:0;check:mastery_stars>=0 AND mastery_stars<=5" json:"mastery_stars"` // 精通 5 星（模块 B 用，A 阶段先保留字段）
	UpdatedAt               time.Time `json:"updated_at"`
}
