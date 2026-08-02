package model

import "time"

// AcademicMilestone 学业奖励池记录（Layer 3）
// 用于记录可发积分的学业里程碑事件（作业习惯 / 进步 / 荣誉 / 里程碑）
type AcademicMilestone struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	FamilyID      uint      `gorm:"index;not null" json:"family_id"`
	ChildID       uint      `gorm:"index;not null" json:"child_id"`
	Type          string    `gorm:"size:30;not null" json:"type"`               // homework_habit / progress / honor / milestone
	SubType       string    `gorm:"size:50" json:"sub_type"`                    // 具体子类型，如 "continuous_homework_7days"
	Title         string    `gorm:"size:100;not null" json:"title"`             // 事件标题
	Description   string    `gorm:"size:500" json:"description"`                // 描述
	OccurredAt    time.Time `gorm:"not null" json:"occurred_at"`                // 发生日期
	PointsAwarded int       `gorm:"not null;default:0" json:"points_awarded"`   // 实发积分
	ParentNote    string    `gorm:"size:500" json:"parent_note"`                // 家长备注
	Attachments   string    `gorm:"size:500" json:"attachments"`                // 附件图片URL JSON数组
	StarLevel     int       `gorm:"not null;default:1" json:"star_level"`       // 星级 1-4
	CreatedAt     time.Time `json:"created_at"`
}

// 学业里程碑类型常量
const (
	MilestoneTypeHomeworkHabit = "homework_habit" // 作业习惯（连续 N 天完成作业等）
	MilestoneTypeHomeworkPerfect = "homework_perfect" // 单元练习全对（2 年级起）
	MilestoneTypeProgress      = "progress"        // 学业进步（3 年级起）
	MilestoneTypeErrorBook     = "error_book"      // 错题本整理（3 年级起）
	MilestoneTypeHonor         = "honor"           // 荣誉（小组项目 / 范文 / 三好学生等，4 年级起）
	MilestoneTypeMilestone     = "milestone"       // 里程碑（弱项突破 / 韧性，6 年级起）
)
