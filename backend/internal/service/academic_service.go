package service

import (
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"time"
)

// AcademicService 学业双层结构服务（V3.1 模块 D）
// - Layer 2：AcademicTrendEntry 学业趋势档位（只存档位不存分数，AI 软参考）
// - Layer 3：AcademicMilestone 学业奖励池（独立积分白名单 + 月度限额）
type AcademicService struct{}

// NewAcademicService 创建学业服务
func NewAcademicService() *AcademicService {
	return &AcademicService{}
}

// MilestoneTypeOption 里程碑类型可选项（前端展示与录入引导）
type MilestoneTypeOption struct {
	Type            string `json:"type"`
	SubType         string `json:"sub_type"`
	Title           string `json:"title"`
	SuggestedPoints int    `json:"suggested_points"` // 建议积分（实际录入仍受 200 上限 clamp）
	StarLevel       int    `json:"star_level"`       // 建议星级 1-4
}

// 学业奖励池积分守卫常量
const (
	maxMilestonePoints        = 200 // 单次积分上限
	maxMonthlyMilestones      = 3   // 每月每个孩子里程碑次数上限
	maxMonthlyHomeworkPerfect = 1   // homework_perfect 子类型每月上限
)

// RecordMilestone 记录学业里程碑并发放积分
// 守卫1：每月每个孩子最多 3 次
// 守卫2：单次积分上限 200
// 守卫3：按年级解锁类型（1 年级仅 homework_habit）
// 积分发放：直接写 Transaction 记录，RelatedType='academic'，与 ScoreService.Adjust 保持一致的事务模式
func (s *AcademicService) RecordMilestone(childID, familyID uint, milestoneType, subType, title, description string, occurredAt time.Time, points int, parentNote, attachments string, starLevel int) (*model.AcademicMilestone, error) {
	if childID == 0 || familyID == 0 {
		return nil, errors.New("child_id 与 family_id 不能为空")
	}
	if title == "" {
		return nil, errors.New("title 不能为空")
	}
	if milestoneType == "" {
		return nil, errors.New("milestone_type 不能为空")
	}
	if occurredAt.IsZero() {
		occurredAt = time.Now()
	}

	// 校验孩子归属当前家庭
	var child model.User
	if err := database.DB.Where("id = ? AND family_id = ? AND role = ?", childID, familyID, model.RoleChild).First(&child).Error; err != nil {
		return nil, errors.New("孩子档案不存在或不属于当前家庭")
	}
	grade, _ := ResolveGrade(&child)
	if grade < 1 {
		grade = 1 // 默认按最严格的 1 年级处理
	}

	// 守卫3：年级类型解锁
	if !isMilestoneTypeAllowed(milestoneType, grade) {
		return nil, fmt.Errorf("当前年级 %d 不允许的里程碑类型：%s", grade, milestoneType)
	}

	// 守卫1：本月次数（按 occurredAt 所在月份统计，防止家长通过回填日期绕过限额）
	monthStart := time.Date(occurredAt.Year(), occurredAt.Month(), 1, 0, 0, 0, 0, occurredAt.Location())
	monthEnd := monthStart.AddDate(0, 1, 0)
	var monthCount int64
	if err := database.DB.Model(&model.AcademicMilestone{}).
		Where("child_id = ? AND family_id = ? AND occurred_at >= ? AND occurred_at < ?",
			childID, familyID, monthStart, monthEnd).
		Count(&monthCount).Error; err != nil {
		return nil, err
	}
	if monthCount >= maxMonthlyMilestones {
		return nil, fmt.Errorf("本月已记录 %d 次学业里程碑，超过每月 %d 次上限", monthCount, maxMonthlyMilestones)
	}

	// homework_perfect 子类型额外月度配额（2 年级起每月最多 1 次）
	if milestoneType == model.MilestoneTypeHomeworkPerfect {
		var perfectCount int64
		if err := database.DB.Model(&model.AcademicMilestone{}).
			Where("child_id = ? AND family_id = ? AND type = ? AND occurred_at >= ? AND occurred_at < ?",
				childID, familyID, model.MilestoneTypeHomeworkPerfect, monthStart, monthEnd).
			Count(&perfectCount).Error; err != nil {
			return nil, err
		}
		if perfectCount >= maxMonthlyHomeworkPerfect {
			return nil, fmt.Errorf("本月已记录 %d 次单元练习全对，超过每月 %d 次上限", perfectCount, maxMonthlyHomeworkPerfect)
		}
	}

	// 守卫2：积分 clamp 到 200
	if points > maxMilestonePoints {
		log.Printf("[Academic] 积分 clamp child=%d raw=%d clamped=%d", childID, points, maxMilestonePoints)
		points = maxMilestonePoints
	}
	if points < 0 {
		points = 0
	}

	// 星级 clamp 1-4
	if starLevel < 1 {
		starLevel = 1
	}
	if starLevel > 4 {
		starLevel = 4
	}

	// 事务：写里程碑 + 更新余额 + 写积分流水（与 ScoreService.Adjust 保持一致）
	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	milestone := &model.AcademicMilestone{
		FamilyID:      familyID,
		ChildID:       childID,
		Type:          milestoneType,
		SubType:       subType,
		Title:         title,
		Description:   description,
		OccurredAt:    occurredAt,
		PointsAwarded: points,
		ParentNote:    parentNote,
		Attachments:   attachments,
		StarLevel:     starLevel,
	}
	if err := tx.Create(milestone).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("创建里程碑记录失败")
	}

	// 发放积分（写 Transaction，RelatedType='academic'，触发 BeforeCreate 白名单校验）
	if points > 0 {
		var u model.User
		if err := tx.Where("id = ? AND role = ?", childID, model.RoleChild).First(&u).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("孩子档案不存在")
		}
		newBalance := u.Balance + points
		if err := tx.Model(&u).Update("balance", newBalance).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("更新余额失败")
		}
		relatedType := "academic"
		reason := "学业奖励：" + title
		txRec := &model.Transaction{
			ChildID:      childID,
			Type:         model.TransactionTypeIncome,
			Amount:       points,
			Reason:       reason,
			RelatedID:    &milestone.ID,
			RelatedType:  &relatedType,
			BalanceAfter: newBalance,
		}
		if err := tx.Create(txRec).Error; err != nil {
			tx.Rollback()
			// BeforeCreate hook 拦截到的禁止关键词等情况在此返回
			return nil, errors.New("创建积分流水失败：" + err.Error())
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, errors.New("提交事务失败")
	}
	return milestone, nil
}

// GetMilestones 查询孩子的学业里程碑历史（按发生日期倒序）
func (s *AcademicService) GetMilestones(childID, familyID uint, limit int) ([]model.AcademicMilestone, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var milestones []model.AcademicMilestone
	err := database.DB.Where("child_id = ? AND family_id = ?", childID, familyID).
		Order("occurred_at DESC, id DESC").
		Limit(limit).
		Find(&milestones).Error
	return milestones, err
}

// RecordTrend 记录学业趋势档位（Layer 2，只存档位不发分）
func (s *AcademicService) RecordTrend(childID, familyID uint, subject, metricType, valueABC, occurredWeek, note string) (*model.AcademicTrendEntry, error) {
	if childID == 0 || familyID == 0 {
		return nil, errors.New("child_id 与 family_id 不能为空")
	}
	if subject == "" || metricType == "" || valueABC == "" {
		return nil, errors.New("subject / metric_type / value_abc 不能为空")
	}
	if !isValidABC(valueABC) {
		return nil, errors.New("value_abc 仅允许 A+ / A / B / C")
	}
	// 校验孩子归属当前家庭
	var child model.User
	if err := database.DB.Where("id = ? AND family_id = ? AND role = ?", childID, familyID, model.RoleChild).First(&child).Error; err != nil {
		return nil, errors.New("孩子档案不存在或不属于当前家庭")
	}
	entry := &model.AcademicTrendEntry{
		FamilyID:     familyID,
		ChildID:      childID,
		Subject:      subject,
		MetricType:   metricType,
		ValueABC:     valueABC,
		OccurredWeek: occurredWeek,
		Note:         note,
	}
	if err := database.DB.Create(entry).Error; err != nil {
		return nil, errors.New("创建学业趋势记录失败")
	}
	return entry, nil
}

// GetTrends 查询学业趋势（最近 N 条，可按 metric_type 过滤）
func (s *AcademicService) GetTrends(childID, familyID uint, metricType string, limit int) ([]model.AcademicTrendEntry, error) {
	if limit <= 0 || limit > 200 {
		limit = 30
	}
	db := database.DB.Where("child_id = ? AND family_id = ?", childID, familyID)
	if metricType != "" {
		db = db.Where("metric_type = ?", metricType)
	}
	var entries []model.AcademicTrendEntry
	err := db.Order("occurred_week DESC, id DESC").Limit(limit).Find(&entries).Error
	return entries, err
}

// GetAllowedMilestoneTypes 根据年级返回允许的里程碑类型列表
// 累计解锁：1 年级 homework_habit → 2 年级 +homework_perfect → 3 年级 +progress/error_book
//
//	→ 4 年级 +honor（小组项目/范文）→ 5 年级 +honor（三好学生/自主计划）→ 6 年级 +milestone（弱项突破/韧性）
func (s *AcademicService) GetAllowedMilestoneTypes(grade int) []MilestoneTypeOption {
	if grade < 1 {
		grade = 1
	}
	if grade > 6 {
		grade = 6
	}
	// 1 年级：仅 homework_habit
	options := []MilestoneTypeOption{
		{
			Type:            model.MilestoneTypeHomeworkHabit,
			SubType:         "continuous_homework_7days",
			Title:           "连续 7 天按时完成作业",
			SuggestedPoints: 30,
			StarLevel:       1,
		},
		{
			Type:            model.MilestoneTypeHomeworkHabit,
			SubType:         "continuous_homework_21days",
			Title:           "连续 21 天自主完成作业",
			SuggestedPoints: 80,
			StarLevel:       2,
		},
	}
	// 2 年级：+ homework_perfect（单元练习全对，每月最多 1 次）
	if grade >= 2 {
		options = append(options, MilestoneTypeOption{
			Type:            model.MilestoneTypeHomeworkPerfect,
			SubType:         "unit_practice_full_mark",
			Title:           "单元练习全对",
			SuggestedPoints: 50,
			StarLevel:       2,
		})
	}
	// 3 年级：+ progress + error_book
	if grade >= 3 {
		options = append(options,
			MilestoneTypeOption{
				Type:            model.MilestoneTypeProgress,
				SubType:         "subject_improvement",
				Title:           "学科进步（弱项提升一档）",
				SuggestedPoints: 100,
				StarLevel:       3,
			},
			MilestoneTypeOption{
				Type:            model.MilestoneTypeErrorBook,
				SubType:         "error_book_organized",
				Title:           "错题本整理完成",
				SuggestedPoints: 60,
				StarLevel:       2,
			},
		)
	}
	// 4 年级：+ honor（小组项目 / 范文）
	if grade >= 4 {
		options = append(options, MilestoneTypeOption{
			Type:            model.MilestoneTypeHonor,
			SubType:         "group_project_or_model_essay",
			Title:           "小组项目 / 范文展示",
			SuggestedPoints: 120,
			StarLevel:       3,
		})
	}
	// 5 年级：+ honor（三好学生 / 自主计划）
	if grade >= 5 {
		options = append(options, MilestoneTypeOption{
			Type:            model.MilestoneTypeHonor,
			SubType:         "merit_student_or_self_plan",
			Title:           "三好学生 / 自主学习计划",
			SuggestedPoints: 150,
			StarLevel:       4,
		})
	}
	// 6 年级：+ milestone（弱项突破 / 韧性）
	if grade >= 6 {
		options = append(options, MilestoneTypeOption{
			Type:            model.MilestoneTypeMilestone,
			SubType:         "weak_subject_breakthrough",
			Title:           "弱项突破 / 韧性体现",
			SuggestedPoints: 200,
			StarLevel:       4,
		})
	}
	return options
}

// isMilestoneTypeAllowed 校验某类型在指定年级是否解锁
// 1 年级：仅 homework_habit
// 2 年级：+ homework_perfect
// 3 年级：+ progress + error_book
// 4 年级：+ honor
// 5 年级：累计（无新顶层类型，仅 honor 子类型扩展）
// 6 年级：+ milestone
func isMilestoneTypeAllowed(milestoneType string, grade int) bool {
	if grade < 1 {
		grade = 1
	}
	switch milestoneType {
	case model.MilestoneTypeHomeworkHabit:
		return true // 全年级允许
	case model.MilestoneTypeHomeworkPerfect:
		return grade >= 2
	case model.MilestoneTypeProgress, model.MilestoneTypeErrorBook:
		return grade >= 3
	case model.MilestoneTypeHonor:
		return grade >= 4
	case model.MilestoneTypeMilestone:
		return grade >= 6
	}
	return false
}

// isValidABC 校验档位合法性（A+ / A / B / C）
func isValidABC(s string) bool {
	switch s {
	case "A+", "A", "B", "C":
		return true
	}
	return false
}
