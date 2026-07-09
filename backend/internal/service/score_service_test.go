package service

import (
	"growpocket/internal/database"
	"growpocket/internal/model"
	"testing"
	"time"
)

func TestGetBalance(t *testing.T) {
	_, family, _, child := setupTestDB(t)
	service := NewScoreService()

	balance, nickname, err := service.GetBalance(child.ID, family.ID)
	if err != nil {
		t.Fatalf("GetBalance 失败: %v", err)
	}
	if balance != 0 {
		t.Errorf("Balance got %d want 0", balance)
	}
	if nickname != "小明" {
		t.Errorf("Nickname got %s want 小明", nickname)
	}
}

func TestAdjust_AddPoints_CountersAccumulate(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewScoreService()
	achSvc := &AchievementService{}

	// 第一次加 100 分
	_, err := service.Adjust(child.ID, family.ID, parent.ID, 100, "认真学习", "完成作业", "")
	if err != nil {
		t.Fatalf("第一次 Adjust 失败: %v", err)
	}

	// 验证 TaskCount 计数器 = 1
	taskCount, err := achSvc.GetCounterValue(child.ID, model.CounterTypeTaskCount, 0)
	if err != nil {
		t.Fatalf("GetCounterValue(TaskCount) 失败: %v", err)
	}
	if taskCount != 1 {
		t.Errorf("TaskCount got %d want 1", taskCount)
	}

	// 验证 TotalPoints 计数器 = 100
	totalPoints, err := achSvc.GetCounterValue(child.ID, model.CounterTypeTotalPoints, 0)
	if err != nil {
		t.Fatalf("GetCounterValue(TotalPoints) 失败: %v", err)
	}
	if totalPoints != 100 {
		t.Errorf("TotalPoints got %d want 100", totalPoints)
	}

	// 第二次加 200 分
	_, err = service.Adjust(child.ID, family.ID, parent.ID, 200, "做家务", "", "")
	if err != nil {
		t.Fatalf("第二次 Adjust 失败: %v", err)
	}

	// 验证 TaskCount 计数器 = 2（累加）
	taskCount, err = achSvc.GetCounterValue(child.ID, model.CounterTypeTaskCount, 0)
	if err != nil {
		t.Fatalf("GetCounterValue(TaskCount) 失败: %v", err)
	}
	if taskCount != 2 {
		t.Errorf("TaskCount after 2nd got %d want 2", taskCount)
	}

	// 验证 TotalPoints 计数器 = 300（累加：100+200）
	totalPoints, err = achSvc.GetCounterValue(child.ID, model.CounterTypeTotalPoints, 0)
	if err != nil {
		t.Fatalf("GetCounterValue(TotalPoints) 失败: %v", err)
	}
	if totalPoints != 300 {
		t.Errorf("TotalPoints after 2nd got %d want 300", totalPoints)
	}

	// 第三次加 250 分，TotalPoints 达到 550
	_, err = service.Adjust(child.ID, family.ID, parent.ID, 250, "考试满分", "", "")
	if err != nil {
		t.Fatalf("第三次 Adjust 失败: %v", err)
	}

	totalPoints, err = achSvc.GetCounterValue(child.ID, model.CounterTypeTotalPoints, 0)
	if err != nil {
		t.Fatalf("GetCounterValue(TotalPoints) 失败: %v", err)
	}
	if totalPoints != 550 {
		t.Errorf("TotalPoints after 3rd got %d want 550", totalPoints)
	}

	taskCount, err = achSvc.GetCounterValue(child.ID, model.CounterTypeTaskCount, 0)
	if err != nil {
		t.Fatalf("GetCounterValue(TaskCount) 失败: %v", err)
	}
	if taskCount != 3 {
		t.Errorf("TaskCount after 3rd got %d want 3", taskCount)
	}
}

func TestAdjust_AddPoints(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewScoreService()

	newBalance, err := service.Adjust(child.ID, family.ID, parent.ID, 100, "认真学习", "完成作业", "")
	if err != nil {
		t.Fatalf("Adjust 失败: %v", err)
	}
	if newBalance != 100 {
		t.Errorf("newBalance got %d want 100", newBalance)
	}

	// 检查余额
	balance, _, err := service.GetBalance(child.ID, family.ID)
	if err != nil {
		t.Fatalf("GetBalance 失败: %v", err)
	}
	if balance != 100 {
		t.Errorf("Balance got %d want 100", balance)
	}

	// 应该有一条 transaction
	history, total, err := service.GetHistory(child.ID, family.ID, 1, 20, "", "")
	if err != nil {
		t.Fatalf("GetHistory 失败: %v", err)
	}
	if total != 1 {
		t.Errorf("total got %d want 1", total)
	}
	if len(history) != 1 {
		t.Errorf("history 长度 got %d want 1", len(history))
	}
	if history[0].Type != model.TransactionTypeIncome {
		t.Errorf("Type got %d want %d", history[0].Type, model.TransactionTypeIncome)
	}
	if history[0].Amount != 100 {
		t.Errorf("Amount got %d want 100", history[0].Amount)
	}
	if history[0].BalanceAfter != 100 {
		t.Errorf("BalanceAfter got %d want 100", history[0].BalanceAfter)
	}
}

func TestAdjust_DeductWithInsufficient(t *testing.T) {
	db, family, parent, child := setupTestDB(t)
	service := NewScoreService()

	// 余额为 0 时扣 50 分应该失败
	_, err := service.Adjust(child.ID, family.ID, parent.ID, -50, "罚款", "违反规则", "")
	if err == nil {
		t.Fatal("余额不足时 Adjust 应该返回错误")
	}

	// 余额仍为 0
	var u model.User
	db.First(&u, child.ID)
	if u.Balance != 0 {
		t.Errorf("Balance got %d want 0", u.Balance)
	}
}

func TestAdjust_EmptyTitle(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewScoreService()

	_, err := service.Adjust(child.ID, family.ID, parent.ID, 10, "", "描述", "")
	if err == nil {
		t.Fatal("空标题应该返回错误")
	}
}

func TestAdjust_ZeroDelta(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewScoreService()

	_, err := service.Adjust(child.ID, family.ID, parent.ID, 0, "测试", "描述", "")
	if err == nil {
		t.Fatal("delta=0 应该返回错误")
	}
}

func TestGetHistory(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewScoreService()

	// 创建 3 条变动
	_, err := service.Adjust(child.ID, family.ID, parent.ID, 10, "第一条", "", "")
	if err != nil {
		t.Fatalf("Adjust 失败: %v", err)
	}
	_, err = service.Adjust(child.ID, family.ID, parent.ID, 20, "第二条", "", "")
	if err != nil {
		t.Fatalf("Adjust 失败: %v", err)
	}
	_, err = service.Adjust(child.ID, family.ID, parent.ID, 30, "第三条", "", "")
	if err != nil {
		t.Fatalf("Adjust 失败: %v", err)
	}

	history, total, err := service.GetHistory(child.ID, family.ID, 1, 20, "", "")
	if err != nil {
		t.Fatalf("GetHistory 失败: %v", err)
	}
	if total != 3 {
		t.Errorf("total got %d want 3", total)
	}
	if len(history) != 3 {
		t.Errorf("history 长度 got %d want 3", len(history))
	}
	// 按时间倒序：最新一条 BalanceAfter=60
	if history[0].BalanceAfter != 60 {
		t.Errorf("history[0].BalanceAfter got %d want 60", history[0].BalanceAfter)
	}
	if history[2].BalanceAfter != 10 {
		t.Errorf("history[2].BalanceAfter got %d want 10", history[2].BalanceAfter)
	}
}

func TestGetTrend(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewScoreService()

	// 先加一点积分让数据有变化
	_, err := service.Adjust(child.ID, family.ID, parent.ID, 50, "测试趋势", "", "")
	if err != nil {
		t.Fatalf("Adjust 失败: %v", err)
	}

	now := time.Now()
	endDate := now.Format("2006-01-02")
	startDate := now.AddDate(0, 0, -6).Format("2006-01-02")
	trend, err := service.GetTrend(child.ID, family.ID, startDate, endDate)
	if err != nil {
		t.Fatalf("GetTrend 失败: %v", err)
	}
	if len(trend) != 7 {
		t.Errorf("trend 长度 got %d want 7", len(trend))
	}

	// 今天（最后一条）收入应为 50
	lastDay := trend[len(trend)-1]
	income, ok := lastDay["income"].(int)
	if !ok {
		t.Fatalf("income 不是 int 类型")
	}
	if income != 50 {
		t.Errorf("今天 income got %d want 50", income)
	}

	// 每天 date 字段应该存在
	for i, d := range trend {
		if _, ok := d["date"]; !ok {
			t.Errorf("trend[%d] 缺少 date 字段", i)
		}
	}
}

// 确保 tests 引用 database 包以避免 unused import 错误
var _ = database.DB
