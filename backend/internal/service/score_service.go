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

func (s *ScoreService) GetHistory(childID, familyID uint, page, pageSize int) ([]model.Transaction, int64, error) {
	if _, err := NewChildService().GetChild(childID, familyID); err != nil {
		return nil, 0, err
	}

	var records []model.Transaction
	var total int64
	db := database.DB.Model(&model.Transaction{}).Where("child_id = ?", childID)
	db.Count(&total)
	offset := (page - 1) * pageSize
	err := db.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&records).Error
	return records, total, err
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

func (s *ScoreService) GetTrend(childID, familyID uint, days int) ([]map[string]interface{}, error) {
	if _, err := NewChildService().GetChild(childID, familyID); err != nil {
		return nil, err
	}

	if days <= 0 {
		days = 7
	}

	var transactions []model.Transaction
	err := database.DB.Where("child_id = ?", childID).Order("created_at ASC").Find(&transactions).Error
	if err != nil {
		return nil, err
	}

	// 按日期记录每最后一笔的 balance_after
	daily := make(map[string]int)
	for _, t := range transactions {
		day := t.CreatedAt.Format("2006-01-02")
		daily[day] = t.BalanceAfter
	}

	result := make([]map[string]interface{}, 0, days)
	now := time.Now()
	var lastKnown int

	// 从最早（days-1 天前）到今天，依次填充
	for i := days - 1; i >= 0; i-- {
		day := now.AddDate(0, 0, -i).Format("2006-01-02")
		if v, ok := daily[day]; ok {
			lastKnown = v
		}
		result = append(result, map[string]interface{}{
			"date":    day,
			"balance": lastKnown,
		})
	}

	return result, nil
}
