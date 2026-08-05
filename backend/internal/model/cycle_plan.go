package model

import "time"

// CyclePlan 周期计划表（V1.3 阶段目标设定 + Cycle 任务预生成）
type CyclePlan struct {
	ID                     uint       `gorm:"primaryKey" json:"id"`
	ChildID                uint       `gorm:"index;not null;uniqueIndex:uk_child_start_date;index:idx_child_length" json:"child_id"`
	StartDate              time.Time  `gorm:"not null;uniqueIndex:uk_child_start_date" json:"start_date"`                                // 周一日期
	EndDate                time.Time  `gorm:"not null" json:"end_date"`                                                                  // =start_date + cycle_length_weeks*7 - 1
	CycleLengthWeeks       uint       `gorm:"not null;default:2;index:idx_child_length" json:"cycle_length_weeks"`                       // V1.3 新增 1/2/3/4 周
	GoalsJSON              string     `gorm:"type:text" json:"goals,omitempty"`                          // V1.3 新增 阶段目标设定快照 JSON
	Status                 string     `gorm:"size:20;default:draft" json:"status"`                       // draft/locked/applied/expired
	ThemeWeekConfig        string     `gorm:"type:text" json:"theme_week_config,omitempty"`              // 主题周配置 JSON 含 position 字段
	DimensionRatioSummary  string     `gorm:"type:text" json:"dimension_ratio_summary,omitempty"`        // 整 Cycle 维度占比汇总 JSON
	DailyInstancesJSON     string     `gorm:"type:text;not null" json:"daily_instances"`                 // 整个 Cycle 的预生成任务数组 JSON
	LockVersion            int        `gorm:"not null;default:0" json:"lock_version"`                    // 乐观锁
	LockedAt               *time.Time `json:"locked_at,omitempty"`
	LockedByParent         *uint      `gorm:"index" json:"locked_by_parent,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}

// CyclePlan 状态常量
const (
	CyclePlanStatusDraft   = "draft"
	CyclePlanStatusLocked  = "locked"
	CyclePlanStatusApplied = "applied"
	CyclePlanStatusExpired = "expired"
)
