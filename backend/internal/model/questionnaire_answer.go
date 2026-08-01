package model

import "time"

// QuestionnaireAnswer 问卷答案
type QuestionnaireAnswer struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	FamilyID        uint      `gorm:"index;not null" json:"family_id"`
	ChildID         uint      `gorm:"index;not null" json:"child_id"`
	QuestionnaireID uint      `gorm:"index;not null" json:"questionnaire_id"`
	Stage           string    `gorm:"size:20;not null" json:"stage"`
	Answers         string    `gorm:"type:text" json:"answers"` // JSON: 答案数组
	CreatedAt       time.Time `json:"created_at"`
}
