package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"time"
)

type ScoreService struct{}

func NewScoreService() *ScoreService {
	return &ScoreService{}
}

func (s *ScoreService) GetBalance(childID, familyID uint) (int, string, error) {
	child, err := NewChildService().GetChild(childID, familyID)
	if err != nil {
		return 0, "", err
	}
	return child.Balance, child.Nickname, nil
}

func (s *ScoreService) GetHistory(childID, familyID uint, page, pageSize int, startDate, endDate string) ([]model.Transaction, int64, error) {
	if _, err := NewChildService().GetChild(childID, familyID); err != nil {
		return nil, 0, err
	}

	var records []model.Transaction
	var total int64
	db := database.DB.Model(&model.Transaction{}).Where("child_id = ?", childID)
	if startDate != "" {
		db = db.Where("created_at >= ?", startDate+" 00:00:00")
	}
	if endDate != "" {
		db = db.Where("created_at <= ?", endDate+" 23:59:59")
	}
	db.Count(&total)
	offset := (page - 1) * pageSize
	err := db.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&records).Error
	return records, total, err
}

type MonthlyStats struct {
	Month      string `json:"month"`
	Income     int    `json:"income"`
	Expense    int    `json:"expense"`
	Balance    int    `json:"balance"`
}

func (s *ScoreService) GetMonthlyStats(childID, familyID uint) ([]MonthlyStats, error) {
	if _, err := NewChildService().GetChild(childID, familyID); err != nil {
		return nil, err
	}

	var stats []MonthlyStats
	err := database.DB.Model(&model.Transaction{}).
		Select(`
			strftime('%Y-%m', created_at) as month,
			SUM(CASE WHEN type = 0 THEN amount ELSE 0 END) as income,
			SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as expense,
			MAX(balance_after) as balance
		`).
		Where("child_id = ?", childID).
		Group("month").
		Order("month DESC").
		Scan(&stats).Error
	return stats, err
}

// Adjust 调整积分：delta 正数为加，负数为减。创建一条 status=3 的任务记录 + 一条 transaction。
func (s *ScoreService) Adjust(childID, familyID, createdBy uint, delta int, title, description, photo string) (int, error) {
	if title == "" {
		return 0, errors.New("标题不能为空")
	}
	if delta == 0 {
		return 0, errors.New("积分值不能为 0")
	}

	child, err := NewChildService().GetChild(childID, familyID)
	if err != nil {
		return 0, err
	}

	// 事务：创建任务 + 更新余额 + 生成 transaction
	tx := database.DB.Begin()

	task := &model.Task{
		FamilyID:    familyID,
		Title:       title,
		Description: description,
		Points:      delta,
		Status:      model.TaskStatusCompleted,
		ChildID:     childID,
		ChildName:   child.Nickname,
		CreatedBy:   createdBy,
		Photo:       photo,
	}
	if err := tx.Create(task).Error; err != nil {
		tx.Rollback()
		return 0, errors.New("创建任务失败")
	}

	// 更新 child balance
	var u model.User
	if err := tx.Where("id = ? AND role = ?", childID, "child").First(&u).Error; err != nil {
		tx.Rollback()
		return 0, errors.New("孩子档案不存在")
	}

	newBalance := u.Balance + delta
	if newBalance < 0 {
		tx.Rollback()
		return 0, errors.New("余额不足")
	}
	if err := tx.Model(&u).Update("balance", newBalance).Error; err != nil {
		tx.Rollback()
		return 0, errors.New("更新余额失败")
	}

	// 生成 transaction
	tType := model.TransactionTypeIncome
	reason := "奖励：" + title
	if delta < 0 {
		tType = model.TransactionTypeExpense
		reason = "扣除：" + title
	}
	absDelta := delta
	if absDelta < 0 {
		absDelta = -absDelta
	}
	relatedID := task.ID
	relatedType := "task"
	txRec := &model.Transaction{
		ChildID:      childID,
		Type:         tType,
		Amount:       absDelta,
		Reason:       reason,
		RelatedID:    &relatedID,
		RelatedType:  &relatedType,
		BalanceAfter: newBalance,
	}
	if err := tx.Create(txRec).Error; err != nil {
		tx.Rollback()
		return 0, errors.New("创建积分记录失败")
	}

	tx.Commit()
	return newBalance, nil
}

// GetTrend 按日期区间统计每天的收入与消耗。
// startDate/endDate 格式为 YYYY-MM-DD，区间为闭区间。
func (s *ScoreService) GetTrend(childID, familyID uint, startDate, endDate string) ([]map[string]interface{}, error) {
	if _, err := NewChildService().GetChild(childID, familyID); err != nil {
		return nil, err
	}

	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, errors.New("start_date 格式应为 YYYY-MM-DD")
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, errors.New("end_date 格式应为 YYYY-MM-DD")
	}

	var transactions []model.Transaction
	err = database.DB.Where("child_id = ? AND created_at >= ? AND created_at < ?", childID, start, end.AddDate(0, 0, 1)).
		Order("created_at ASC").Find(&transactions).Error
	if err != nil {
		return nil, err
	}

	dailyIncome := make(map[string]int)
	dailyExpense := make(map[string]int)
	for _, t := range transactions {
		day := t.CreatedAt.Format("2006-01-02")
		if t.Type == model.TransactionTypeIncome {
			dailyIncome[day] += t.Amount
		} else {
			dailyExpense[day] += t.Amount
		}
	}

	result := make([]map[string]interface{}, 0)
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		day := d.Format("2006-01-02")
		result = append(result, map[string]interface{}{
			"date":    day,
			"income":  dailyIncome[day],
			"expense": dailyExpense[day],
		})
	}

	return result, nil
}
