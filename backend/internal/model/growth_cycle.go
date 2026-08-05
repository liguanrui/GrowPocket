package model

import "time"

// GrowthCycle 成长周期（V1.3 统一目标入口：合并原 CycleGoalSetting 能力）
type GrowthCycle struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	FamilyID         uint      `gorm:"index;not null" json:"family_id"`
	ChildID          uint      `gorm:"index;not null" json:"child_id"`
	Name             string    `gorm:"size:100" json:"name"` // 周期名称
	StartDate        time.Time `gorm:"not null" json:"start_date"`
	EndDate          time.Time `gorm:"not null" json:"end_date"`
	Status           string    `gorm:"size:20;default:active" json:"status"` // active/completed
	// V1.3 统一目标字段（原 CycleGoalSetting 的核心字段迁入）
	CycleLengthWeeks uint      `gorm:"not null;default:2" json:"cycle_length_weeks"` // 1/2/3/4
	FocusDims        string    `gorm:"type:text" json:"focus_dims"`                 // JSON 数组如 "[1,2]"，用于课程表生成加权
	// V1.3.1: 改为每维度独立目标提升分（JSON map: {"dimID": deltaScore}），替代原单一 PointsTarget
	// 家长为每个重点维度设提升分（如 self_care +15），雷达图进度按维度精确展示
	DimTargets       string    `gorm:"type:text" json:"dim_targets"`                 // JSON map 如 {"1":15,"3":10}
	PointsTarget     int       `gorm:"default:0" json:"points_target"`              // V1.3.1 派生字段 = sum(DimTargets)，保留用于向后兼容旧接口
	PointsTargetGrade string   `gorm:"size:4" json:"points_target_grade"`           // G1-G6
	IsDefault        bool      `gorm:"default:false" json:"is_default"`              // 是否系统默认推算
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
