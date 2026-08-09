package model

import "time"

// GrowthStory 成长故事
type GrowthStory struct {
	ID                       uint      `gorm:"primaryKey" json:"id"`
	CycleID                  uint      `gorm:"index;not null;default:0" json:"cycle_id"`
	FamilyID                 uint      `gorm:"index;not null" json:"family_id"`
	ChildID                  uint      `gorm:"index;not null" json:"child_id"`
	Title                    string    `gorm:"size:200" json:"title"`
	Content                  string    `gorm:"type:text" json:"content"`                  // 故事正文
	AbilitySummary           string    `gorm:"type:text" json:"ability_summary"`          // 能力提升摘要 JSON
	PhotoUrls                string    `gorm:"type:text" json:"photo_urls,omitempty"`     // 精选相册 JSON
	YearbookCopy             string    `gorm:"type:text" json:"yearbook_copy,omitempty"`  // 年报 6 卡短文案 JSON
	Type                     string    `gorm:"size:20;default:'cycle'" json:"type"`       // cycle / project
	MasterChallengeInstanceID *uint     `gorm:"index" json:"master_challenge_instance_id,omitempty"`
	CreatedAt                time.Time `json:"created_at"`
}
