package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"time"
)

type GrowthService struct{}

func NewGrowthService() *GrowthService {
	return &GrowthService{}
}

// Album 成果相册：从 tasks 表中取出 photo 非空且（status=2/3 或 status=3 且 points!=0）的记录
// 即：任务成果照片 + 奖惩任务凭证照片
func (s *GrowthService) Album(childID, familyID uint, page, pageSize int) ([]model.Task, int64, error) {
	if _, err := NewChildService().GetChild(childID, familyID); err != nil {
		return nil, 0, err
	}

	var tasks []model.Task
	var total int64

	db := database.DB.Model(&model.Task{}).
		Where("child_id = ? AND photo IS NOT NULL AND photo != ''", childID)

	db.Count(&total)

	offset := (page - 1) * pageSize
	err := db.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&tasks).Error
	return tasks, total, err
}

// Timeline 成长时间线：从 tasks（status=3）+ redeems + transactions（related_type='task'）聚合
func (s *GrowthService) Timeline(childID, familyID uint, days int) ([]map[string]interface{}, error) {
	if _, err := NewChildService().GetChild(childID, familyID); err != nil {
		return nil, err
	}

	if days <= 0 {
		days = 30
	}

	type event struct {
		Time   time.Time
		Title  string
		Points int
		Kind   string // task / reward / redeem / manual
	}

	var events []event

	// 1. tasks (status=3)
	var tasks []model.Task
	database.DB.Where("child_id = ? AND status = 3", childID).Order("created_at DESC").Find(&tasks)
	for _, t := range tasks {
		kind := "task"
		if t.Points < 0 || (t.Photo != "" && t.Points > 0 && t.Title != "") {
			// 奖惩任务（points < 0 或 带照片）
			kind = "reward"
		}
		events = append(events, event{
			Time:   t.CreatedAt,
			Title:  t.Title,
			Points: t.Points,
			Kind:   kind,
		})
	}

	// 2. redeems
	var redeems []model.Redeem
	database.DB.Where("child_id = ?", childID).Order("created_at DESC").Find(&redeems)
	for _, r := range redeems {
		events = append(events, event{
			Time:   r.CreatedAt,
			Title:  "兑换：" + r.ItemName,
			Points: -r.Points,
			Kind:   "redeem",
		})
	}

	// 3. 手动加减积分（transactions where related_type != 'task' && related_type != 'redeem'）
	var txs []model.Transaction
	database.DB.Where("child_id = ? AND (related_type IS NULL OR (related_type != 'task' AND related_type != 'redeem'))", childID).
		Order("created_at DESC").Find(&txs)
	for _, t := range txs {
		p := t.Amount
		if t.Type == model.TransactionTypeExpense {
			p = -p
		}
		events = append(events, event{
			Time:   t.CreatedAt,
			Title:  t.Reason,
			Points: p,
			Kind:   "manual",
		})
	}

	// 按日期分组
	dayMap := make(map[string][]map[string]interface{})
	// 先按时间排序
	// 简单：用一个 events 数组做日期索引
	for _, e := range events {
		day := e.Time.Format("2006-01-02")
		dayMap[day] = append(dayMap[day], map[string]interface{}{
			"type":   e.Kind,
			"title":  e.Title,
			"points": e.Points,
			"time":   e.Time.Format("15:04"),
		})
	}

	// 按日期倒序输出
	now := time.Now()
	result := make([]map[string]interface{}, 0)
	for i := 0; i < days; i++ {
		day := now.AddDate(0, 0, -i).Format("2006-01-02")
		if evts, ok := dayMap[day]; ok {
			result = append(result, map[string]interface{}{
				"date":   day,
				"events": evts,
			})
		}
	}

	return result, nil
}

// Unused placeholder to satisfy import requirements if any
var _ = errors.New
