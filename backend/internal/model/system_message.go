package model

import "time"

// 系统消息类型
const (
	MsgTypeActivityJoinSuccess = "activity_join_success" // 报名成功（报名方）
	MsgTypeActivityNewSignup   = "activity_new_signup"   // 有人报名（发起方）
	MsgTypeActivityFull        = "activity_full"         // 活动已满员（发起方）
	MsgTypeActivityCompleted   = "activity_completed"    // 有人完成活动（发起方）
	MsgTypeActivityPublished   = "activity_published"    // 活动发布成功（发起方）
	MsgTypeActivityTip         = "activity_tip"          // 活动后续提示
	MsgTypeDonationSubmitted   = "donation_submitted"    // 捐赠申请已提交
	MsgTypeDonationReceived    = "donation_received"     // 机构已收件
	MsgTypeDonationCompleted   = "donation_completed"    // 捐赠完成积分到账
)

// 关联业务类型
const (
	MsgRelatedActivity = "activity"
	MsgRelatedDonation = "donation"
)

// SystemMessage 家庭级系统消息（站内信）
type SystemMessage struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	FamilyID     uint       `gorm:"index;not null" json:"family_id"`           // 接收家庭
	UserID       uint       `gorm:"index;default:0" json:"user_id"`           // 0=家庭共享；指定用户时仅该用户
	Type         string     `gorm:"size:50;index;not null" json:"type"`       // 消息类型
	Title        string     `gorm:"size:100;not null" json:"title"`
	Content      string     `gorm:"type:text;not null" json:"content"`
	RelatedType  string     `gorm:"size:30" json:"related_type,omitempty"`   // activity 等
	RelatedID    uint       `gorm:"index;default:0" json:"related_id,omitempty"`
	IsRead       bool       `gorm:"default:false;index" json:"is_read"`
	CreatedAt    time.Time  `json:"created_at"`
	ReadAt       *time.Time `json:"read_at,omitempty"`
}
