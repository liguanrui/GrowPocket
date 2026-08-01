package model

import "time"

// ChatSession 对话会话
type ChatSession struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	FamilyID      uint      `gorm:"index;not null" json:"family_id"`
	ChildID       uint      `gorm:"index;not null" json:"child_id"`
	UserID        uint      `gorm:"not null" json:"user_id"`
	Role          string    `gorm:"size:20" json:"role"` // parent/child
	Title         string    `gorm:"size:100" json:"title"`
	LastMessage   string    `gorm:"type:text" json:"last_message"`
	LastMessageAt time.Time `json:"last_message_at"`
	MessageCount  int       `json:"message_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
