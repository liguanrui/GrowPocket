package model

import "time"

// GradeDimensionGuide 年级·维度发展指南矩阵（6 年级 × 6 维 = 36 行）
// 用于能力加分的软约束（Prompt）+ 硬约束（Cap clamp）。
type GradeDimensionGuide struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Grade       int       `gorm:"index;not null;check:grade>=1 AND grade<=6" json:"grade"` // 小学 1~6 年级
	DimensionID uint      `gorm:"index;not null" json:"dimension_id"`
	Weight      float64   `gorm:"not null;default:1.0;check:weight>0 AND weight<=2.5" json:"weight"` // 发展权重
	Cap         int       `gorm:"not null;default:100;check:cap>=10 AND cap<=100" json:"cap"`         // 本年级能力硬上限
	FocusLevel  string    `gorm:"size:20;not null;default:secondary" json:"focus_level"`             // primary / secondary / latent
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
