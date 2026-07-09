package model

import "time"

const (
	DonationStatusPending   = 1 // 待取件
	DonationStatusReceived  = 2 // 已收件
	DonationStatusCompleted = 3 // 已完成（积分已发放）
)

// CharityProject 公益项目（系统预置）
type CharityProject struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	Title          string    `gorm:"size:100;not null" json:"title"`
	Icon           string    `gorm:"size:50;not null" json:"icon"`
	Description    string    `gorm:"type:text;not null" json:"description"`
	PointsPerKg    int       `gorm:"not null;default:10" json:"points_per_kg"`
	CreatedAt      time.Time `json:"created_at"`
}

// CharityDonation 公益项目捐赠记录
type CharityDonation struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	FamilyID     uint      `gorm:"index;not null" json:"family_id"`
	ChildID      uint      `gorm:"index;not null" json:"child_id"`
	ChildName    string    `gorm:"size:50;not null" json:"child_name"`
	ProjectID    uint      `gorm:"index;not null" json:"project_id"`
	ProjectTitle string    `gorm:"size:100;not null" json:"project_title"`
	Weight       float64   `gorm:"not null;default:0" json:"weight"`
	Details      string    `gorm:"type:text" json:"details,omitempty"`
	ContactName  string    `gorm:"size:50" json:"contact_name,omitempty"`
	ContactPhone string    `gorm:"size:20" json:"contact_phone,omitempty"`
	Address      string    `gorm:"size:300" json:"address,omitempty"`
	Photo        string    `gorm:"size:500" json:"photo,omitempty"`
	Points       int       `gorm:"not null;default:0" json:"points"`
	Status       int       `gorm:"not null;default:1;index" json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	ReceivedAt   *time.Time `json:"received_at,omitempty"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}
