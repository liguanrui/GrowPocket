package model

import "time"

// CycleGoalSetting 周期目标设定表（V1.3 阶段目标设定）
type CycleGoalSetting struct {
	ID                    uint      `gorm:"primaryKey" json:"id"`
	ChildID               uint      `gorm:"index;not null;uniqueIndex:uk_child_target_cycle" json:"child_id"`
	ParentUserID          uint      `gorm:"not null;index" json:"parent_user_id"`
	TargetCycleStartDate  time.Time `gorm:"not null;uniqueIndex:uk_child_target_cycle" json:"target_cycle_start_date"`
	CycleLengthWeeks      uint      `gorm:"not null" json:"cycle_length_weeks"`
	FocusDims             string    `gorm:"type:text;not null" json:"focus_dims"`            // JSON 数组如 "[1,2]"
	PointsTarget          int       `gorm:"not null" json:"points_target"`
	PointsTargetGrade     string    `gorm:"size:10" json:"points_target_grade,omitempty"`
	IsDefault             bool      `gorm:"default:false" json:"is_default"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}
