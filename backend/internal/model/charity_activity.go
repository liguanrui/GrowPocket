package model

import "time"

// 活动状态
const (
	ActivityStatusRecruiting = 1 // 招募中
	ActivityStatusCompleted  = 2 // 已结束
)

// 活动类型
const (
	ActivityTypeCleanup   = 1 // 捡垃圾
	ActivityTypeElderly   = 2 // 老人院服务
	ActivityTypePlanting  = 3 // 植树
	ActivityTypeGame      = 4 // 博弈游戏
	ActivityTypeOther     = 5 // 其他
)

// CharityActivity 公益活动（家庭发起+招募）
type CharityActivity struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	FamilyID       uint      `gorm:"index;not null" json:"family_id"`
	UserID         uint      `gorm:"not null" json:"user_id"`
	Nickname       string    `gorm:"size:50;not null" json:"nickname"`
	Title          string    `gorm:"size:200;not null" json:"title"`
	ActivityType   int       `gorm:"not null;default:5;index" json:"activity_type"`
	Description    string    `gorm:"type:text" json:"description,omitempty"`
	Location       string    `gorm:"size:200" json:"location,omitempty"`
	EventTime      time.Time `gorm:"not null" json:"event_time"`
	MaxParticipants int      `gorm:"not null;default:10" json:"max_participants"`
	ParticipantsCount int    `gorm:"default:0" json:"participants_count"`
	Points         int       `gorm:"not null;default:80" json:"points"`          // 参与者积分
	OrganizerPoints int      `gorm:"not null;default:100" json:"organizer_points"` // 组织者积分
	Status         int       `gorm:"not null;default:1;index" json:"status"`       // 1=招募中, 2=已结束
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// ActivityParticipant 活动参与者（孩子）
type ActivityParticipant struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ActivityID   uint      `gorm:"index;not null" json:"activity_id"`
	FamilyID     uint      `gorm:"index;not null" json:"family_id"`
	ChildID      uint      `gorm:"not null" json:"child_id"`      // 参与的孩子ID
	ChildName    string    `gorm:"size:50;not null" json:"child_name"` // 孩子姓名
	PointsEarned int       `gorm:"default:0" json:"points_earned"`
	Completed    bool      `gorm:"default:false" json:"completed"`
	Photo        string    `gorm:"size:500" json:"photo,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}
