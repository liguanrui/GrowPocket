package model

import "time"

// AbilityDimension 能力维度
type AbilityDimension struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Code        string    `gorm:"size:30;uniqueIndex;not null" json:"code"` // self_care/independence/hands_on/learning/social_emotional/health
	Name        string    `gorm:"size:50;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	Icon        string    `gorm:"size:50" json:"icon"`
	Color       string    `gorm:"size:20" json:"color"` // 维度颜色（用于雷达图）
	ResearchSrc string    `gorm:"size:200" json:"research_src"` // 研究来源
	SortOrder   int       `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
