package model

import (
	"time"
)

// Achievement 勋章表
// type: 达成条件类型
// target_value: 达成目标值
// points: 解锁后奖励积分
// is_custom: 是否为家庭自定义勋章（false 为系统预置）
// family_id: 所属家庭（自定义勋章必填）
// icon_color: 图标背景色（自定义勋章可选）
// custom_type: 自定义条件类型 1=任务完成次数, 2=累计积分, 3=连续天数, 4=兑换次数, 5=公益参与次数
type Achievement struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	FamilyID    uint      `gorm:"index" json:"family_id"`            // 所属家庭（0 为系统预置）
	Name        string    `gorm:"size:50;not null" json:"name"`
	Description string    `gorm:"size:200" json:"description"`
	Icon        string    `gorm:"size:100" json:"icon"`               // emoji 或图片URL
	IconColor   string    `gorm:"size:20;default:'#FF9500'" json:"icon_color"` // 图标颜色
	Type        int       `gorm:"not null" json:"type"`               // 达成条件类型
	TargetValue int       `gorm:"not null;default:0" json:"target_value"` // 达成目标值
	Points      int       `gorm:"not null;default:0" json:"points"`   // 解锁后奖励积分
	IsCustom    bool      `gorm:"not null;default:false" json:"is_custom"` // 是否为自定义勋章
	CreatedBy   uint      `json:"created_by"`                         // 创建者（家长ID）
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

const (
	AchievementTypeFirstTask       = 1 // 完成第一个任务
	AchievementTypeConsecutiveDays = 2 // 连续天数完成任务
	AchievementTypeTotalPoints     = 3 // 累计积分达到
	AchievementTypeTaskCount       = 4 // 任务完成次数
	AchievementTypeRedeemCount     = 5 // 兑换次数
	AchievementTypeCharity         = 6 // 公益参与次数
)

type UserAchievement struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ChildID       uint      `gorm:"index;not null" json:"child_id"`
	AchievementID uint      `gorm:"not null" json:"achievement_id"`
	Unlocked      bool      `gorm:"not null;default:false" json:"unlocked"`
	UnlockedAt    time.Time `json:"unlocked_at,omitempty"`
	CurrentValue  int       `gorm:"not null;default:0" json:"current_value"`
	Achievement   Achievement `gorm:"foreignKey:AchievementID" json:"Achievement"`
}

// TaskTemplate 常见任务模板表
// 用户可以自定义任务模板，方便快速创建同类任务
type TaskTemplate struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	FamilyID    uint      `gorm:"index;not null" json:"family_id"`
	Title       string    `gorm:"size:200;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	Points      int       `gorm:"not null;default:10" json:"points"` // 默认奖励分数
	Icon        string    `gorm:"size:50;default:'⭐'" json:"icon"`  // 图标 emoji
	Category    string    `gorm:"size:50;default:'学习'" json:"category"` // 分类：学习/家务/行为习惯/运动/其他
	SortOrder   int       `gorm:"not null;default:0" json:"sort_order"`  // 排序
	IsActive    bool      `gorm:"not null;default:true" json:"is_active"` // 是否启用
	CreatedBy   uint      `gorm:"not null" json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
