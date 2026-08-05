package model

import "time"

// SkillTreeTemplate 技能树模板
type SkillTreeTemplate struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Code        string    `gorm:"size:50;uniqueIndex;not null" json:"code"` // 如 "S1-G3-cooking"
	Grade       string    `gorm:"size:5;not null" json:"grade"`             // G1-G6
	Category    string    `gorm:"size:50;not null" json:"category"`         // 厨艺/收纳/清洁/手工
	Title       string    `gorm:"size:200;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	LevelsJSON  string    `gorm:"type:text;not null" json:"levels"`         // 各等级配置 JSON
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// SkillUnlock 孩子技能树解锁进度
type SkillUnlock struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	FamilyID      uint       `gorm:"index" json:"family_id"`
	ChildID       uint       `gorm:"index;not null" json:"child_id"`
	SkillTreeID   uint       `gorm:"not null;index" json:"skill_tree_id"`
	SkillTreeCode string     `gorm:"size:50" json:"skill_tree_code,omitempty"`
	CurrentLevel  int        `gorm:"default:0" json:"current_level"`
	Frozen        bool       `gorm:"default:false" json:"frozen"`                 // 事故熔断状态
	FrozenReason  string     `gorm:"size:200" json:"frozen_reason,omitempty"`
	FrozenAt      *time.Time `json:"frozen_at,omitempty"`
	UnlockedAt    *time.Time `json:"unlocked_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}
