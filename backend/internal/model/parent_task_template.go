package model

import "time"

type ParentTaskTemplate struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	FamilyID       uint      `json:"family_id"`        // 0=预设通用
	ChildID        uint      `json:"child_id"`         // 0=预设通用
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Category       string    `json:"category"`         // family_creation/creative/community/financial/nature/craft
	AgeMin         int       `json:"age_min"`
	AgeMax         int       `json:"age_max"`
	EstimatedDays  int       `json:"estimated_days"`   // 7-28
	KeyMilestones  string    `json:"key_milestones" gorm:"type:text"` // JSON 大纲
	IsCustom       bool      `json:"is_custom" gorm:"default:false"`
	CreatedAt      time.Time `json:"created_at"`
}
