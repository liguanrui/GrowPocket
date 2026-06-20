package service

import (
	"growpocket/internal/model"
	"testing"
)

func TestCreateItem(t *testing.T) {
	_, family, _, _ := setupTestDB(t)
	service := NewRedeemService()

	item, err := service.CreateItem(CreateItemInput{
		FamilyID: family.ID,
		Name:     "冰淇淋",
		Points:   100,
		Category: model.RedeemItemCategoryMaterial,
		Stock:    10,
	})
	if err != nil {
		t.Fatalf("CreateItem 失败: %v", err)
	}
	if item == nil {
		t.Fatal("返回的 item 为空")
	}
	if item.Name != "冰淇淋" {
		t.Errorf("Name got %s want 冰淇淋", item.Name)
	}
	if item.Points != 100 {
		t.Errorf("Points got %d want 100", item.Points)
	}
	if item.Stock != 10 {
		t.Errorf("Stock got %d want 10", item.Stock)
	}
	if item.Category != model.RedeemItemCategoryMaterial {
		t.Errorf("Category got %d want %d", item.Category, model.RedeemItemCategoryMaterial)
	}
}

func TestCreateItem_EmptyName(t *testing.T) {
	_, family, _, _ := setupTestDB(t)
	service := NewRedeemService()

	_, err := service.CreateItem(CreateItemInput{
		FamilyID: family.ID,
		Name:     "",
		Points:   50,
	})
	if err == nil {
		t.Fatal("空名称应该返回错误")
	}
}

func TestCreateItem_ZeroPoints(t *testing.T) {
	_, family, _, _ := setupTestDB(t)
	service := NewRedeemService()

	_, err := service.CreateItem(CreateItemInput{
		FamilyID: family.ID,
		Name:     "测试",
		Points:   0,
	})
	if err == nil {
		t.Fatal("points=0 应该返回错误")
	}

	_, err = service.CreateItem(CreateItemInput{
		FamilyID: family.ID,
		Name:     "测试",
		Points:   -10,
	})
	if err == nil {
		t.Fatal("points<0 应该返回错误")
	}
}

func TestListItems_CategoryFilter(t *testing.T) {
	_, family, _, _ := setupTestDB(t)
	service := NewRedeemService()

	items := []struct {
		name     string
		points   int
		category int
	}{
		{"物质1", 10, model.RedeemItemCategoryMaterial},
		{"物质2", 20, model.RedeemItemCategoryMaterial},
		{"体验1", 30, model.RedeemItemCategoryExperience},
		{"体验2", 40, model.RedeemItemCategoryExperience},
		{"其他1", 50, model.RedeemItemCategoryOther},
	}

	for _, it := range items {
		_, err := service.CreateItem(CreateItemInput{
			FamilyID: family.ID,
			Name:     it.name,
			Points:   it.points,
			Category: it.category,
		})
		if err != nil {
			t.Fatalf("创建商品 %s 失败: %v", it.name, err)
		}
	}

	// 按体验类别过滤（注意：ListItems 仅对 category > 0 应用过滤，
	// 因为 material 类别为 0，与"不过滤"冲突。所以使用 Experience 测试）
	list, total, err := service.ListItems(family.ID, model.RedeemItemCategoryExperience, 1, 20)
	if err != nil {
		t.Fatalf("ListItems 失败: %v", err)
	}
	if total != 2 {
		t.Errorf("experience total got %d want 2", total)
	}
	if len(list) != 2 {
		t.Errorf("experience list 长度 got %d want 2", len(list))
	}

	// 按其他类别过滤
	list, total, err = service.ListItems(family.ID, model.RedeemItemCategoryOther, 1, 20)
	if err != nil {
		t.Fatalf("ListItems 失败: %v", err)
	}
	if total != 1 {
		t.Errorf("other total got %d want 1", total)
	}
	if len(list) != 1 {
		t.Errorf("other list 长度 got %d want 1", len(list))
	}

	// 不过滤（category=0 表示返回全部）
	list, total, err = service.ListItems(family.ID, 0, 1, 20)
	if err != nil {
		t.Fatalf("ListItems 失败: %v", err)
	}
	if total != 5 {
		t.Errorf("all total got %d want 5", total)
	}
	if len(list) != 5 {
		t.Errorf("all list 长度 got %d want 5", len(list))
	}
}

func TestRedeem_Success(t *testing.T) {
	db, family, parent, child := setupTestDB(t)
	redeemService := NewRedeemService()
	scoreService := NewScoreService()

	// 先给孩子加 200 积分
	_, err := scoreService.Adjust(child.ID, family.ID, parent.ID, 200, "初始积分", "", "")
	if err != nil {
		t.Fatalf("Adjust 失败: %v", err)
	}

	// 创建一个商品
	item, err := redeemService.CreateItem(CreateItemInput{
		FamilyID: family.ID,
		Name:     "玩具",
		Points:   100,
		Stock:    5,
	})
	if err != nil {
		t.Fatalf("CreateItem 失败: %v", err)
	}

	// 兑换
	redeem, newBalance, err := redeemService.Redeem(item.ID, child.ID, family.ID)
	if err != nil {
		t.Fatalf("Redeem 失败: %v", err)
	}
	if newBalance != 100 {
		t.Errorf("newBalance got %d want 100", newBalance)
	}
	if redeem == nil {
		t.Fatal("返回的 redeem 为空")
	}
	if redeem.ItemName != "玩具" {
		t.Errorf("ItemName got %s want 玩具", redeem.ItemName)
	}
	if redeem.Points != 100 {
		t.Errorf("Points got %d want 100", redeem.Points)
	}

	// 验证余额
	var u model.User
	db.First(&u, child.ID)
	if u.Balance != 100 {
		t.Errorf("child.Balance got %d want 100", u.Balance)
	}

	// 验证库存减 1
	var it model.RedeemItem
	db.First(&it, item.ID)
	if it.Stock != 4 {
		t.Errorf("item.Stock got %d want 4", it.Stock)
	}

	// 验证 transaction 记录
	var txs []model.Transaction
	db.Where("child_id = ? AND type = ?", child.ID, model.TransactionTypeExpense).Find(&txs)
	if len(txs) != 1 {
		t.Errorf("expense transaction 数量 got %d want 1", len(txs))
	}
	tx := txs[0]
	if tx.Amount != 100 {
		t.Errorf("tx.Amount got %d want 100", tx.Amount)
	}
	if tx.BalanceAfter != 100 {
		t.Errorf("tx.BalanceAfter got %d want 100", tx.BalanceAfter)
	}
	if tx.RelatedType == nil || *tx.RelatedType != "redeem" {
		t.Errorf("tx.RelatedType got %v want redeem", tx.RelatedType)
	}
}

func TestRedeem_InsufficientPoints(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	redeemService := NewRedeemService()
	scoreService := NewScoreService()

	// 只有 50 积分
	_, err := scoreService.Adjust(child.ID, family.ID, parent.ID, 50, "小奖励", "", "")
	if err != nil {
		t.Fatalf("Adjust 失败: %v", err)
	}

	// 创建一个 100 积分的商品
	item, err := redeemService.CreateItem(CreateItemInput{
		FamilyID: family.ID,
		Name:     "昂贵玩具",
		Points:   100,
		Stock:    5,
	})
	if err != nil {
		t.Fatalf("CreateItem 失败: %v", err)
	}

	_, _, err = redeemService.Redeem(item.ID, child.ID, family.ID)
	if err == nil {
		t.Fatal("积分不足应该返回错误")
	}
}

func TestGetRedeems(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	redeemService := NewRedeemService()
	scoreService := NewScoreService()

	_, err := scoreService.Adjust(child.ID, family.ID, parent.ID, 1000, "大奖励", "", "")
	if err != nil {
		t.Fatalf("Adjust 失败: %v", err)
	}

	// 创建 2 个商品并兑换
	for i, name := range []string{"商品A", "商品B"} {
		item, err := redeemService.CreateItem(CreateItemInput{
			FamilyID: family.ID,
			Name:     name,
			Points:   100 + i*50,
			Stock:    5,
		})
		if err != nil {
			t.Fatalf("CreateItem 失败: %v", err)
		}
		_, _, err = redeemService.Redeem(item.ID, child.ID, family.ID)
		if err != nil {
			t.Fatalf("Redeem 失败: %v", err)
		}
	}

	records, total, err := redeemService.GetRedeems(child.ID, family.ID, 1, 20)
	if err != nil {
		t.Fatalf("GetRedeems 失败: %v", err)
	}
	if total != 2 {
		t.Errorf("total got %d want 2", total)
	}
	if len(records) != 2 {
		t.Errorf("records 长度 got %d want 2", len(records))
	}
}

func TestDeleteItem(t *testing.T) {
	db, family, _, _ := setupTestDB(t)
	service := NewRedeemService()

	item, err := service.CreateItem(CreateItemInput{
		FamilyID: family.ID,
		Name:     "要删除的商品",
		Points:   30,
		Stock:    5,
	})
	if err != nil {
		t.Fatalf("CreateItem 失败: %v", err)
	}

	err = service.DeleteItem(item.ID, family.ID)
	if err != nil {
		t.Fatalf("DeleteItem 失败: %v", err)
	}

	// 验证 stock 被设置为 0
	var it model.RedeemItem
	db.First(&it, item.ID)
	if it.Stock != 0 {
		t.Errorf("Stock got %d want 0", it.Stock)
	}
}
