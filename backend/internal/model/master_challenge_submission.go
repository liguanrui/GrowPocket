package model

import "time"

// MasterChallengeSubmission 大师挑战验收提交
type MasterChallengeSubmission struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	InstanceID         uint      `gorm:"index;not null" json:"instance_id"`
	ChildSummary       string    `gorm:"size:500" json:"child_summary"`             // 孩子一句话总结
	Attachments        string    `gorm:"size:2000" json:"attachments"`              // 成果图片/视频封面 JSON数组（最多9张）
	ParticipationScore int       `gorm:"not null;default:3" json:"participation_score"` // 参与度 1-5
	ApplicationScore   int       `gorm:"not null;default:3" json:"application_score"`   // 能力应用度 1-5
	QualityScore       int       `gorm:"not null;default:3" json:"quality_score"`       // 成果满意度 1-5
	Passed             bool      `gorm:"not null;default:false" json:"passed"`          // ≥2 星即通过
	PointsAwarded      int       `gorm:"not null;default:0" json:"points_awarded"`
	ReviewedAt         time.Time `gorm:"not null" json:"reviewed_at"`
	CreatedAt          time.Time `json:"created_at"`
}
