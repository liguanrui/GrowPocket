package model

import "time"

// MasterChallengeTemplate 大师挑战项目模板
type MasterChallengeTemplate struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	Title             string    `gorm:"size:100;not null" json:"title"`
	Description       string    `gorm:"size:500" json:"description"`
	Category          string    `gorm:"size:30;not null" json:"category"`        // family_cocreation / creative_expression / community_service / financial_literacy
	DifficultyLevel   int       `gorm:"not null;default:1" json:"difficulty_level"` // 1-5 (L1~L5)
	MinGrade          int       `gorm:"not null;default:1" json:"min_grade"`
	MaxGrade          int       `gorm:"not null;default:6" json:"max_grade"`
	PrimaryDimIDs     string    `gorm:"size:50;not null" json:"primary_dim_ids"` // JSON数组如 "[1,4,6]"
	RecommendedStages int       `gorm:"not null;default:3" json:"recommended_stages"` // 推荐阶段数
	EstimatedDays     int       `gorm:"not null;default:7" json:"estimated_days"` // 预计完成天数
	PointsReward      int       `gorm:"not null;default:100" json:"points_reward"` // 基础稀有积分
	Icon              string    `gorm:"size:50" json:"icon"`
	IsActive          bool      `gorm:"default:true" json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
}
