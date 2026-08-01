package model

import "time"

// ChatMessage 对话消息
type ChatMessage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	SessionID uint      `gorm:"index;not null" json:"session_id"`
	Role      string    `gorm:"size:20;not null" json:"role"` // user/assistant
	Content   string    `gorm:"type:text;not null" json:"content"`
	Intent    string    `gorm:"size:30" json:"intent,omitempty"` // 识别出的意图
	CreatedAt time.Time `json:"created_at"`
}
