package model

import (
	"time"
)

// Achievement 勋章表
// counter_type: 计数器类型
// counter_target: 计数器目标值
// template_id: 模板任务ID（CounterTypeTemplateTaskCount时使用）
// points: 解锁后奖励积分
// is_custom: 是否为家庭自定义勋章（false 为系统预置）
// family_id: 所属家庭（自定义勋章必填）
type Achievement struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	FamilyID      uint      `gorm:"index" json:"family_id"`            // 所属家庭（0 为系统预置）
	Name          string    `gorm:"size:50;not null" json:"name"`
	Description   string    `gorm:"size:200" json:"description"`
	Icon          string    `gorm:"size:100" json:"icon"`               // emoji 或图片URL
	IconColor     string    `gorm:"size:20;default:'#FF9500'" json:"icon_color"` // 图标颜色
	CounterType   int       `gorm:"not null;default:1" json:"counter_type"`       // 计数器类型
	CounterTarget int       `gorm:"not null;default:0" json:"counter_target"` // 计数器目标值
	TemplateID    uint      `gorm:"index" json:"template_id"`           // 模板任务ID
	Points        int       `gorm:"not null;default:0" json:"points"`   // 解锁后奖励积分
	IsCustom      bool      `gorm:"not null;default:false" json:"is_custom"` // 是否为自定义勋章
	CreatedBy     uint      `json:"created_by"`                         // 创建者（家长ID）
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// CounterType 计数器类型
const (
	CounterTypeTaskCount         = 1 // 完成任务的数量
	CounterTypeTemplateTaskCount = 2 // 完成某个模板任务的数量
	CounterTypeConsecutiveDays   = 3 // 连续完成任务的天数
	CounterTypeTotalPoints       = 4 // 累计获取积分数量
	// CounterTypeActivityCount     = 5 // 累计参与活动的数量（暂时去掉）
	CounterTypeRedeemCount       = 6 // 兑换次数
	// CounterTypeCharity           = 7 // 公益参与次数（暂时去掉）
)

// UserAchievement 用户成就进度表
type UserAchievement struct {
	ID            uint        `gorm:"primaryKey" json:"id"`
	ChildID       uint        `gorm:"index;not null" json:"child_id"`
	AchievementID uint        `gorm:"not null" json:"achievement_id"`
	AwardCount    int         `gorm:"not null;default:0" json:"award_count"` // 获得次数
	CurrentValue  int         `gorm:"not null;default:0" json:"current_value"`
	Unlocked      bool        `gorm:"-" json:"unlocked"`                    // 是否已解锁（非持久化字段）
	Achievement   Achievement `gorm:"foreignKey:AchievementID" json:"Achievement"`
}

// UserCounter 用户计数器表
type UserCounter struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ChildID      uint      `gorm:"not null;uniqueIndex:idx_child_counter_template" json:"child_id"`
	CounterType  int       `gorm:"not null;uniqueIndex:idx_child_counter_template" json:"counter_type"`
	TemplateID   uint      `gorm:"uniqueIndex:idx_child_counter_template" json:"template_id"` // 模板任务ID（CounterTypeTemplateTaskCount时使用）
	CurrentValue int       `gorm:"not null;default:0" json:"current_value"`
	LastDate     string    `gorm:"size:10" json:"last_date"` // 最后更新日期（用于连续天数判断）
	UpdatedAt    time.Time `json:"updated_at"`
}

// AchievementAward 成就获得记录表（支持重复获得）
type AchievementAward struct {
	ID            uint        `gorm:"primaryKey" json:"id"`
	ChildID       uint        `gorm:"index;not null" json:"child_id"`
	AchievementID uint        `gorm:"not null;index" json:"achievement_id"`
	AwardedAt     time.Time   `gorm:"not null" json:"awarded_at"`
	Points        int         `gorm:"not null;default:0" json:"points"`
	Achievement   Achievement `gorm:"foreignKey:AchievementID" json:"Achievement"`
}

// TaskTemplate 常见任务模板表
// 用户可以自定义任务模板，方便快速创建同类任务
type TaskTemplate struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	FamilyID      uint      `gorm:"index;not null" json:"family_id"`
	Title         string    `gorm:"size:200;not null" json:"title"`
	Description   string    `gorm:"type:text" json:"description"`
	Points        int       `gorm:"not null;default:10" json:"points"` // 默认奖励分数
	Icon          string    `gorm:"size:50;default:'⭐'" json:"icon"`  // 图标 emoji
	Category      string    `gorm:"size:50;default:'学习'" json:"category"` // 分类：学习/家务/行为习惯/运动/其他
	SortOrder     int       `gorm:"not null;default:0" json:"sort_order"`  // 排序
	IsActive      bool      `gorm:"not null;default:true" json:"is_active"` // 是否启用
	CreatedBy     uint      `gorm:"not null" json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	MinAge        int       `gorm:"default:3" json:"min_age"`           // 最小适龄
	MaxAge        int       `gorm:"default:12" json:"max_age"`          // 最大适龄
	Difficulty    string    `gorm:"size:20;default:'medium'" json:"difficulty"` // 难度：easy/medium/hard
	Frequency     string    `gorm:"size:20;default:'once'" json:"frequency"`    // 频次：daily/weekly/monthly/once
	EstimatedTime int       `gorm:"default:15" json:"estimated_time"`   // 预计完成时间（分钟）
	Tags          string    `gorm:"size:200" json:"tags,omitempty"`     // 标签，逗号分隔
	IsSystem      bool      `gorm:"default:false" json:"is_system"`     // 是否系统内置模板
	AbilityDimensionID uint `gorm:"index" json:"ability_dimension_id,omitempty"`
}

// TaskRecurringConfig 循环任务配置表
// 用于定义每日/每周/每月重复的任务
type TaskRecurringConfig struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	FamilyID        uint      `gorm:"index;not null" json:"family_id"`
	TemplateID      uint      `gorm:"index" json:"template_id"`
	ChildID         uint      `gorm:"index;not null" json:"child_id"`
	ChildName       string    `gorm:"size:50;not null" json:"child_name"`
	Title           string    `gorm:"size:200;not null" json:"title"`
	Description     string    `gorm:"type:text" json:"description"`
	Points          int       `gorm:"not null;default:10" json:"points"`
	Frequency       string    `gorm:"size:20;not null" json:"frequency"` // daily/weekly/monthly
	WeekDays        string    `gorm:"size:20" json:"week_days"`          // 每周哪几天，如 "1,3,5" 表示周一三五（周日=0）
	IsActive        bool      `gorm:"not null;default:true" json:"is_active"`
	NextGenerateAt  time.Time `json:"next_generate_at"`
	CreatedBy       uint      `gorm:"not null" json:"created_by"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
