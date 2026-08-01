package model

import "time"

// Questionnaire 问卷
type Questionnaire struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Stage     string    `gorm:"size:20;not null;index" json:"stage"` // register/weekly/review
	Level     string    `gorm:"size:5;index" json:"level"` // L1-L6，分龄档位（空表示通用）
	Title     string    `gorm:"size:100" json:"title"`
	Questions string    `gorm:"type:text" json:"questions"` // JSON: 题目数组
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
