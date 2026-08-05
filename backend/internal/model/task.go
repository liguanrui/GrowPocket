package model

import "time"

// Task 任务表（V2 精简版）
// task_kind: daily_fixed=每日保底锚任务, parent_child=跨周期父/子任务
// status: 1=进行中, 2=待验收, 3=已完成, 4=已拒绝
// points: 可正可负（对于奖惩任务），默认正数
// 父子任务同表：parent_id=NULL 为父任务，parent_id≠NULL 为子任务
// guardian_required 是任务属性（非类型），任何 task_kind 都可标记需家长陪同
type Task struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	FamilyID    uint       `gorm:"index;not null" json:"family_id"`
	ChildID     uint       `gorm:"index;not null" json:"child_id"`
	ChildName   string     `gorm:"size:50;not null" json:"child_name"`
	CreatedBy   uint       `gorm:"not null" json:"created_by"` // 创建者 UserID（家长）

	// 任务内容
	Title       string     `gorm:"size:200;not null" json:"title"`
	Description string     `gorm:"type:text" json:"description,omitempty"`
	Category    string     `gorm:"size:50" json:"category"`           // 任务分类：学习/家务/行为习惯/运动/其他
	Difficulty  string     `gorm:"size:20" json:"difficulty"`         // 难度：easy/medium/hard
	Points      int        `gorm:"not null" json:"points"`
	Status      int        `gorm:"not null;default:1;index" json:"status"`

	// 任务类型与层级关系
	TaskKind string `gorm:"size:30;default:'daily_fixed';index" json:"task_kind"` // daily_fixed / parent_child
	ParentID *uint  `gorm:"index" json:"parent_id,omitempty"`                     // 父任务ID（子任务用，父任务为NULL）

	// 陪同属性（属性而非类型，任何 task_kind 都可标记）
	GuardianRequired bool   `gorm:"default:false;index" json:"guardian_required"` // 是否需要家长强制陪同
	Supervision      string `gorm:"size:200" json:"supervision,omitempty"`        // 陪同配置JSON {level, sign_off_required}

	// 能力维度
	AbilityDimensionID  uint   `gorm:"index" json:"ability