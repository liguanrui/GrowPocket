package model

import "time"

// MasterChallengeStage 大师挑战阶段打卡记录
type MasterChallengeStage struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	InstanceID  uint       `gorm:"index;not null" json:"instance_id"`
	StageIndex  int        `gorm:"not null" json:"stage_index"` // 0-based
	Title       string     `gorm:"size:100;not null" json:"title"`
	Description string     `gorm:"size:500" json:"description"`
	Status      string     `gorm:"size:20;not null;default:'pending'" json:"status"` // pending / in_progress / completed
	Notes       string     `gorm:"size:1000" json:"notes"`                           // 孩子文字描述
	Attachments string     `gorm:"size:1000" json:"attachments"`                     // 图片URL JSON数组（最多3张）
	SelfRating  int        `gorm:"default:0" json:"self_rating"`                     // 1-5 自评进度
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
}
