package model

import "time"

// Questionnaire 问卷
type Questionnaire struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Stage     string    `gorm:"size:20;not null;index" json:"stage"` // register/weekly/review
	Title     string    `gorm:"size:100" json:"title"`
	Questions string    `gorm:"type:text" json:"questions"` // JSON: 题目数组
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
