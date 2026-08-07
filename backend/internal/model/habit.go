package model

import "time"

type Habit struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	FamilyID    uint      `json:"family_id"`
	ChildID     uint      `json:"child_id"`           // 0=预设通用
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"`           // life/chore/cooking/study/sports/craft/social/safety/other
	AgeMin      int       `json:"age_min"`
	AgeMax      int       `json:"age_max"`
	IsCustom    bool      `json:"is_custom" gorm:"default:false"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
}
