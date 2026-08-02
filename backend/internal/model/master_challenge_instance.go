package model

import "time"

// MasterChallengeInstance 用户立项的大师挑战实例
type MasterChallengeInstance struct {
	ID                    uint       `gorm:"primaryKey" json:"id"`
	FamilyID              uint       `gorm:"index;not null" json:"family_id"`
	ChildID               uint       `gorm:"index;not null" json:"child_id"`
	TemplateID            uint       `gorm:"not null" json:"template_id"`
	Title                 string     `gorm:"size:100;not null" json:"title"`
	Status                string     `gorm:"size:20;not null;default:'in_progress'" json:"status"` // in_progress / submitted / completed / abandoned
	StartedAt             time.Time  `gorm:"not null" json:"started_at"`
	CompletedAt           *time.Time `json:"completed_at"`
	FinalSummary          string     `gorm:"size:500" json:"final_summary"` // 孩子总结
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}
