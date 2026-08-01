package model

import "time"

// ChildAbilityScore 儿童能力维度得分
type ChildAbilityScore struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	FamilyID    uint      `gorm:"index;not null" json:"family_id"`
	ChildID     uint      `gorm:"index;not null" json:"child_id"`
	DimensionID uint      `gorm:"index;not null" json:"dimension_id"`
	Score       int       `gorm:"not null;default:0" json:"score"` // 0-100
	UpdatedAt   time.Time `json:"updated_at"`
}
