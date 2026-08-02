package model

import "time"

// AcademicTrendEntry 学业趋势档位记录（Layer 2，只存档位不存分数）
// 用于阶段回顾时作 AI 软参考，不直接转换为能力得分
type AcademicTrendEntry struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	FamilyID     uint      `gorm:"index;not null" json:"family_id"`
	ChildID      uint      `gorm:"index;not null" json:"child_id"`
	Subject      string    `gorm:"size:20;not null" json:"subject"`        // chinese / math / english / other
	MetricType   string    `gorm:"size:20;not null" json:"metric_type"`    // homework / quiz / midterm_final / self_study_duration
	ValueABC     string    `gorm:"size:5;not null" json:"value_abc"`       // A+ / A / B / C
	OccurredWeek string    `gorm:"size:10;index" json:"occurred_week"`     // 如 "2026-W31"
	Note         string    `gorm:"size:200" json:"note"`
	CreatedAt    time.Time `json:"created_at"`
}

// 学业趋势学科常量
const (
	TrendSubjectChinese = "chinese"
	TrendSubjectMath    = "math"
	TrendSubjectEnglish = "english"
	TrendSubjectOther   = "other"
)

// 学业趋势指标类型常量
const (
	TrendMetricHomework         = "homework"         // 作业档
	TrendMetricQuiz             = "quiz"             // 单元测验档
	TrendMetricMidtermFinal     = "midterm_final"    // 期中期末档
	TrendMetricSelfStudyDuration = "self_study_duration" // 自习时长档
)
