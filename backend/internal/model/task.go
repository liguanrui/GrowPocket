package model

import "time"

// Task 任务表
// status: 1=进行中, 2=待验收, 3=已完成, 4=已拒绝
// points: 可正可负（对于奖惩任务），默认正数
type Task struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	FamilyID    uint      `gorm:"index;not null" json:"family_id"`
	Title       string    `gorm:"size:200;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	Points      int       `gorm:"not null" json:"points"`
	Status      int       `gorm:"not null;default:1;index" json:"status"`
	ChildID     uint      `gorm:"index;not null" json:"child_id"`
	ChildName   string    `gorm:"size:50;not null" json:"child_name"`
	CreatedBy   uint      `gorm:"not null" json:"created_by"` // 创建者 UserID（家长）
	TemplateID  uint      `gorm:"index" json:"template_id"`    // 模板任务ID（从模板创建时记录）
	Photo       string    `gorm:"size:500" json:"photo,omitempty"` // 成果照片 / 奖惩凭证照片
	Deadline    *time.Time `json:"deadline,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Category    string    `gorm:"size:50" json:"category"`           // 任务分类：学习/家务/行为习惯/运动/其他
	Difficulty  string    `gorm:"size:20" json:"difficulty"`         // 难度：easy/medium/hard
	Frequency   string    `gorm:"size:20" json:"frequency"`          // 频次：daily/weekly/monthly/once
	RecurringID *uint     `gorm:"index" json:"recurring_id"`         // 关联循环任务配置ID
	AbilityDimensionID  uint   `gorm:"index" json:"ability_dimension_id,omitempty"`           // 主能力维度ID
	SecondaryDimensions string `gorm:"size:100" json:"secondary_dimensions,omitempty"`        // 次维度ID JSON数组，如 "[2,5]"
	AIGenerated         bool   `gorm:"default:false" json:"ai_generated"`                     // 是否AI生成
}

const (
	TaskStatusInProgress = 1 // 进行中
	TaskStatusSubmitted  = 2 // 待验收
	TaskStatusCompleted  = 3 // 已完成
	TaskStatusRejected   = 4 // 已拒绝
)
