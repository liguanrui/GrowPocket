package model

import "time"

// ParentTask 跨周期家长任务表
type ParentTask struct {
	ID                       uint        `gorm:"primaryKey" json:"id"`
	FamilyID                 uint        `gorm:"index;not null" json:"family_id"`
	ChildID                  uint        `gorm:"index;not null" json:"child_id"`
	TemplateID               uint        `gorm:"index" json:"template_id"`                       // 关联 task_template
	Title                    string      `gorm:"size:200;not null" json:"title"`
	Description              string      `gorm:"type:text" json:"description,omitempty"`
	TotalCycles              int         `gorm:"not null;default:2" json:"total_cycles"`         // 总跨周期数
	CurrentCycle             int         `gorm:"not null;default:1" json:"current_cycle"`
	MilestonesJSON           string      `gorm:"type:text;not null" json:"milestones"`           // 里程碑配置 JSON 数组
	Status                   string      `gorm:"size:20;default:active" json:"status"`           // active/completed/abandoned
	FinalDeliverableRequired bool        `gorm:"default:false" json:"final_deliverable_required"`
	StartedAt                time.Time   `json:"started_at"`
	CompletedAt              *time.Time  `json:"completed_at,omitempty"`
	CreatedAt                time.Time   `json:"created_at"`
	UpdatedAt                time.Time   `json:"updated_at"`
}

// ParentTaskMilestone 里程碑配置（JSON 字段）
type ParentTaskMilestone struct {
	Index                 int    `json:"index"`
	Title                 string `json:"title"`
	SubtaskCount          int    `json:"subtask_count"`
	RequiredParentSignoff bool   `json:"required_parent_signoff"`
}

// ParentTask 状态常量
const (
	ParentTaskStatusActive    = "active"
	ParentTaskStatusCompleted = "completed"
	ParentTaskStatusAbandoned = "abandoned"
)
