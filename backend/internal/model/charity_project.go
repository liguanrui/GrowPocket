package model

import "time"

// CharityProject 公益项目（系统预置）
type CharityProject struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Title       string    `gorm:"size:100;not null" json:"title"`
	Icon        string    `gorm:"size:50;not null" json:"icon"`
	Description string    `gorm:"type:text;not null" json:"description"`
	Points      int       `gorm:"not null" json:"points"`
	CreatedAt   time.Time `json:"created_at"`
}

// CharityDonation 公益项目参与记录
type CharityDonation struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	FamilyID     uint      `gorm:"index;not null" json:"family_id"`
	ChildID      uint      `gorm:"index;not null" json:"child_id"`
	ChildName    string    `gorm:"size:50;not null" json:"child_name"`
	ProjectID    uint      `gorm:"index;not null" json:"project_id"`
	ProjectTitle string    `gorm:"size:100;not null" json:"project_title"`
	Details      string    `gorm:"type:text" json:"details,omitempty"`
	Photo        string    `gorm:"size:500" json:"photo,omitempty"`
	Points       int       `gorm:"not null" json:"points"`
	CreatedAt    time.Time `json:"created_at"`
}
