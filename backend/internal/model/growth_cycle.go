package model

import "time"

// GrowthCycle 成长周期
type GrowthCycle struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	FamilyID  uint      `gorm:"index;not null" json:"family_id"`
	ChildID   uint      `gorm:"index;not null" json:"child_id"`
	Name      string    `gorm:"size:100" json:"name"` // 周期名称
	StartDate time.Time `gorm:"not null" json:"start_date"`
	EndDate   time.Time `gorm:"not null" json:"end_date"`
	Status    string    `gorm:"size:20;default:active" json:"status"` // active/completed
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
