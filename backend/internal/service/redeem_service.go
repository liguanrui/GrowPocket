package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"time"
)

type RedeemService struct{}

func NewRedeemService() *RedeemService {
	return &RedeemService{}
}

type CreateItemInput struct {
	FamilyID    uint
	Name        string
	Description string
	Points      int
	Image       string
	Category    int
	Stock       int
}

func (s *RedeemService) CreateItem(input CreateItemInput) (*model.RedeemItem, error) {
	if input.Name == "" {
		return nil, errors.New("商品名称不能为空")
	}
	if input.Points <= 0 {
		return nil, errors.New("积分必须为正数")
	}

	stock := input.Stock
	if stock == 0 {
		stock = -1 // 默认无限库存
	}

	item := &model.RedeemItem{
		FamilyID:    input.FamilyID,
		Name:        input.Name,
		Description: input.Description,
		Points:      input.Points,
		Image:       input.Image,
		Category:    input.Category,
		Stock:       stock,
	}
	if err := database.DB.Create(item).Error; err != nil {
		return nil, errors.New("创建商品失败")
	}
	return item, nil
}

func (s *RedeemService) ListItems(familyID uint, category int, page, pageSize int) ([]model.RedeemItem, int64, error) {
	var items []model.RedeemItem
	var total int64
	db := database.DB.Model(&model.RedeemItem{}).Where("family_id = ?", familyID)
	if category > 0 {
		db = db.Where("category = ?", category)
	}
	db.Count(&total)

	offset := (page - 1) * pageSize
	err := db.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&items).Error
	return items, total, err
}

func (s *RedeemService) GetItem(id, familyID uint) (*model.RedeemItem, error) {
	var item model.RedeemItem
	err := database.DB.Where("id = ? AND family_id = ?", id, familyID).First(&item).Error
	if err != nil {
		return nil, errors.New("商品不存在")
	}
	return &item, nil
}

type UpdateItemInput struct {
	Name        *string
	Description *string
	Points      *int
	Image       *string
	Category    *int
	Stock       *int
}

func (s *RedeemService) UpdateItem(id, familyID uint, input UpdateItemInput) (*model.RedeemItem, error) {
	item, err := s.GetItem(id, familyID)
	if err != nil {
		return nil, err
	}
	if input.Name != nil {
		item.Name = *input.Name
	}
	if input.Description != nil {
		item.Description = *input.Description
	}
	if input.Points != nil {
		if *input.Points <= 0 {
			return nil, errors.New("积分必须为正数")
		}
		item.Points = *input.Points
	}
	if input.Image != nil {
		item.Image = *input.Image
	}
	if input.Category != nil {
		item.Category = *input.Category
	}
	if input.Stock != nil {
		item.Stock = *input.Stock
	}
	if err := database.DB.Save(item).Error; err != nil {
		return nil, errors.New("更新失败")
	}
	return item, nil
}

func (s *RedeemService) DeleteItem(id, familyID uint) error {
	item, err := s.GetItem(id, familyID)
	if err != nil {
		return err
	}
	// 逻辑删除：设置 stock = 0
	item.Stock = 0
	if err := database.DB.Save(item).Error; err != nil {
		return errors.New("删除失败")
	}
	return nil
}

// Redeem 兑换：原子扣余额 + 扣库存 + 创建兑换记录 + 生成 transaction
func (s *RedeemService) Redeem(itemID, childID, familyID uint) (*model.Redeem, int, error) {
	// 先验证孩子
	child, err := NewChildService().GetChild(childID, familyID)
	if err != nil {
		return nil, 0, err
	}

	// 验证商品
	item, err := s.GetItem(itemID, familyID)
	if err != nil {
		return nil, 0, err
	}

	// 验证积分余额
	if child.Balance < item.Points {
		return nil, 0, errors.New("积分不足")
	}

	// 事务
	tx := database.DB.Begin()

	// 1. 再次查询 child + balance（事务内）
	var u model.User
	if err := tx.Where("id = ? AND role = ?", childID, "child").First(&u).Error; err != nil {
		tx.Rollback()
		return nil, 0, errors.New("孩子档案不存在")
	}
	if u.Balance < item.Points {
		tx.Rollback()
		return nil, 0, errors.New("积分不足")
	}

	// 2. 扣余额
	newBalance := u.Balance - item.Points
	if err := tx.Model(&u).Update("balance", newBalance).Error; err != nil {
		tx.Rollback()
		return nil, 0, errors.New("更新余额失败")
	}

	// 3. 扣库存（有限库存时）
	if item.Stock > 0 {
		var i model.RedeemItem
		if err := tx.Where("id = ?", itemID).First(&i).Error; err != nil {
			tx.Rollback()
			return nil, 0, errors.New("商品不存在")
		}
		if i.Stock <= 0 {
			tx.Rollback()
			return nil, 0, errors.New("库存不足")
		}
		if err := tx.Model(&i).Update("stock", i.Stock-1).Error; err != nil {
			tx.Rollback()
			return nil, 0, errors.New("扣减库存失败")
		}
	}

	// 4. 创建兑换记录
	redeem := &model.Redeem{
		ChildID:   childID,
		ChildName: u.Nickname,
		ItemID:    itemID,
		ItemName:  item.Name,
		ItemImage: item.Image,
		Points:    item.Points,
		CreatedAt: time.Now(),
	}
	if err := tx.Create(redeem).Error; err != nil {
		tx.Rollback()
		return nil, 0, errors.New("创建兑换记录失败")
	}

	// 5. 生成 transaction
	relatedID := redeem.ID
	relatedType := "redeem"
	txRec := &model.Transaction{
		ChildID:      childID,
		Type:         model.TransactionTypeExpense,
		Amount:       item.Points,
		Reason:       "兑换：" + item.Name,
		RelatedID:    &relatedID,
		RelatedType:  &relatedType,
		BalanceAfter: newBalance,
	}
	if err := tx.Create(txRec).Error; err != nil {
		tx.Rollback()
		return nil, 0, errors.New("创建积分记录失败")
	}

	tx.Commit()
	return redeem, newBalance, nil
}

func (s *RedeemService) GetRedeems(childID, familyID uint, page, pageSize int) ([]model.Redeem, int64, error) {
	// 验证 child
	if _, err := NewChildService().GetChild(childID, familyID); err != nil {
		return nil, 0, err
	}

	var records []model.Redeem
	var total int64
	db := database.DB.Model(&model.Redeem{}).Where("child_id = ?", childID)
	db.Count(&total)
	offset := (page - 1) * pageSize
	err := db.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&records).Error
	return records, total, err
}
