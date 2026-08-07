package service

import (
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) (*gorm.DB, *model.Family, *model.User, *model.User) {
	t.Helper()
	// 使用唯一的 DSN 确保每个测试的内存数据库完全隔离
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}

	// 迁移模型
	err = db.AutoMigrate(
		&model.Family{},
		&model.User{},
		&model.Task{},
		&model.Transaction{},
		&model.RedeemItem{},
		&model.Redeem{},
		&model.Achievement{},
		&model.UserAchievement{},
		&model.UserCounter{},
		&model.AchievementAward{},
		&model.TaskTemplate{},
		&model.CommunityShare{},
		&model.CommunityLike{},
		&model.CommunityComment{},
		&model.CharityProject{},
		&model.CharityDonation{},
		&model.CharityActivity{},
		&model.ActivityParticipant{},
	)
	if err != nil {
		t.Fatalf("数据库迁移失败: %v", err)
	}

	// 保存旧的全局 DB，测试结束时恢复
	oldDB := database.DB
	t.Cleanup(func() {
		database.DB = oldDB
	})
	database.DB = db

	// 初始化测试数据：家庭 + 家长 + 孩子
	family := &model.Family{Name: "测试家庭"}
	if err := db.Create(family).Error; err != nil {
		t.Fatalf("创建家庭失败: %v", err)
	}

	parent := &model.User{FamilyID: family.ID, Role: "parent", Nickname: "爸爸", Password: ""}
	if err := db.Create(parent).Error; err != nil {
		t.Fatalf("创建家长失败: %v", err)
	}

	child := &model.User{FamilyID: family.ID, Role: "child", Nickname: "小明", Balance: 0}
	if err := db.Create(child).Error; err != nil {
		t.Fatalf("创建孩子失败: %v", err)
	}

	return db, family, parent, child
}

// --- CreateTask 测试 ---

func TestCreateTask_EmptyTitle(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	_, err := service.CreateTask(CreateTaskInput{
		FamilyID:  family.ID,
		Title:     "",
		Points:    10,
		ChildID:   child.ID,
		ChildName: child.Nickname,
		CreatedBy: parent.ID,
	})
	if err == nil {
		t.Fatal("空标题应该返回错误")
	}
}

func TestCreateTask_ZeroPoints(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	_, err := service.CreateTask(CreateTaskInput{
		FamilyID:  family.ID,
		Title:     "测试任务",
		Points:    0,
		ChildID:   child.ID,
		ChildName: child.Nickname,
		CreatedBy: parent.ID,
	})
	if err == nil {
		t.Fatal("points=0 应该返回错误")
	}
}

func TestCreateTask_Normal(t *testing.T) {
	db, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	task, err := service.CreateTask(CreateTaskInput{
		FamilyID:    family.ID,
		Title:       "写作业",
		Description: "完成数学作业",
		Points:      10,
		ChildID:     child.ID,
		ChildName:   child.Nickname,
		CreatedBy:   parent.ID,
	})
	if err != nil {
		t.Fatalf("创建任务失败: %v", err)
	}
	if task == nil {
		t.Fatal("返回的任务为空")
	}
	if task.Status != model.TaskStatusInProgress {
		t.Errorf("status got %d want %d", task.Status, model.TaskStatusInProgress)
	}

	// 验证能从数据库读回来
	got, err := service.GetTask(task.ID, family.ID)
	if err != nil {
		t.Fatalf("GetTask 失败: %v", err)
	}
	if got.Title != "写作业" {
		t.Errorf("Title got %s want 写作业", got.Title)
	}

	// 孩子余额不应变化（因为 status=1 是进行中）
	var u model.User
	db.First(&u, child.ID)
	if u.Balance != 0 {
		t.Errorf("Balance got %d want 0", u.Balance)
	}
}

func TestCreateTask_Completed(t *testing.T) {
	db, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	task, err := service.CreateTask(CreateTaskInput{
		FamilyID:  family.ID,
		Title:     "做家务奖励",
		Points:    50,
		ChildID:   child.ID,
		ChildName: child.Nickname,
		CreatedBy: parent.ID,
		Status:    model.TaskStatusCompleted,
	})
	if err != nil {
		t.Fatalf("创建已完成任务失败: %v", err)
	}
	if task.Status != model.TaskStatusCompleted {
		t.Errorf("status got %d want %d", task.Status, model.TaskStatusCompleted)
	}

	// 孩子余额 +50
	var u model.User
	db.First(&u, child.ID)
	if u.Balance != 50 {
		t.Errorf("Balance got %d want 50", u.Balance)
	}

	// 有一条 transaction 记录
	var txs []model.Transaction
	db.Where("child_id = ?", child.ID).Find(&txs)
	if len(txs) != 1 {
		t.Errorf("transaction 数量 got %d want 1", len(txs))
	}
	tx := txs[0]
	if tx.Type != model.TransactionTypeIncome {
		t.Errorf("tx.Type got %d want %d", tx.Type, model.TransactionTypeIncome)
	}
	if tx.Amount != 50 {
		t.Errorf("tx.Amount got %d want 50", tx.Amount)
	}
	if tx.BalanceAfter != 50 {
		t.Errorf("tx.BalanceAfter got %d want 50", tx.BalanceAfter)
	}
	if tx.RelatedID == nil || *tx.RelatedID != task.ID {
		t.Errorf("tx.RelatedID got %v want %d", tx.RelatedID, task.ID)
	}
	if tx.RelatedType == nil || *tx.RelatedType != "task" {
		t.Errorf("tx.RelatedType got %v want task", tx.RelatedType)
	}
}

func TestListTasks(t *testing.T) {
	db, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	// 创建多条不同状态的任务
	// 注意：CreateTask 仅支持 status=1 (进行中) 和 status=3 (已完成)
	// 其他 status 会被强制设置为 1。这里通过直接 DB 写入模拟 status=2,4
	cases := []struct {
		title  string
		points int
		status int
	}{
		{"进行中任务1", 10, model.TaskStatusInProgress},
		{"进行中任务2", 20, model.TaskStatusInProgress},
		{"已完成任务3", 30, model.TaskStatusCompleted},
		{"待验收任务4", 40, model.TaskStatusSubmitted},
	}
	for _, c := range cases {
		if c.status == model.TaskStatusCompleted {
			_, err := service.CreateTask(CreateTaskInput{
				FamilyID:  family.ID,
				Title:     c.title,
				Points:    c.points,
				ChildID:   child.ID,
				ChildName: child.Nickname,
				CreatedBy: parent.ID,
				Status:    c.status,
			})
			if err != nil {
				t.Fatalf("创建已完成任务失败: %v", err)
			}
		} else {
			task := &model.Task{
				FamilyID:  family.ID,
				Title:     c.title,
				Points:    c.points,
				Status:    c.status,
				ChildID:   child.ID,
				ChildName: child.Nickname,
				CreatedBy: parent.ID,
			}
			if err := db.Create(task).Error; err != nil {
				t.Fatalf("直接写入任务失败: %v", err)
			}
		}
	}

	// 按 status=InProgress 过滤，应该只有 2 个
	tasks, total, err := service.ListTasks(family.ID, child.ID, model.TaskStatusInProgress, nil, 1, 10)
	if err != nil {
		t.Fatalf("ListTasks 失败: %v", err)
	}
	if total != 2 {
		t.Errorf("total got %d want 2", total)
	}
	if len(tasks) != 2 {
		t.Errorf("tasks 长度 got %d want 2", len(tasks))
	}

	// 按 status=Completed 过滤，应该只有 1 个
	tasks, total, err = service.ListTasks(family.ID, child.ID, model.TaskStatusCompleted, nil, 1, 10)
	if err != nil {
		t.Fatalf("ListTasks 失败: %v", err)
	}
	if total != 1 {
		t.Errorf("completed total got %d want 1", total)
	}
	if len(tasks) != 1 {
		t.Errorf("completed tasks 长度 got %d want 1", len(tasks))
	}

	// 不过滤 status（status=0 返回全部）
	tasks, total, err = service.ListTasks(family.ID, child.ID, 0, nil, 1, 10)
	if err != nil {
		t.Fatalf("ListTasks 失败: %v", err)
	}
	if total != 4 {
		t.Errorf("total got %d want 4", total)
	}
	if len(tasks) != 4 {
		t.Errorf("tasks 长度 got %d want 4", len(tasks))
	}
}

// --- UpdateTask 测试 ---

func TestUpdateTask(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	task, err := service.CreateTask(CreateTaskInput{
		FamilyID:  family.ID,
		Title:     "原始标题",
		Points:    10,
		ChildID:   child.ID,
		ChildName: child.Nickname,
		CreatedBy: parent.ID,
	})
	if err != nil {
		t.Fatalf("创建任务失败: %v", err)
	}

	newTitle := "新标题"
	newPoints := 99
	updated, err := service.UpdateTask(task.ID, family.ID, UpdateTaskInput{
		Title:  &newTitle,
		Points: &newPoints,
	})
	if err != nil {
		t.Fatalf("UpdateTask 失败: %v", err)
	}
	if updated.Title != "新标题" {
		t.Errorf("Title got %s want 新标题", updated.Title)
	}
	if updated.Points != 99 {
		t.Errorf("Points got %d want 99", updated.Points)
	}
}

func TestUpdateTask_WrongStatus(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	// 创建一个 status=3（已完成）的任务
	task, err := service.CreateTask(CreateTaskInput{
		FamilyID:  family.ID,
		Title:     "已完成任务",
		Points:    50,
		ChildID:   child.ID,
		ChildName: child.Nickname,
		CreatedBy: parent.ID,
		Status:    model.TaskStatusCompleted,
	})
	if err != nil {
		t.Fatalf("创建任务失败: %v", err)
	}

	newTitle := "尝试更新"
	_, err = service.UpdateTask(task.ID, family.ID, UpdateTaskInput{Title: &newTitle})
	if err == nil {
		t.Fatal("对 status=3 任务更新应该返回错误")
	}
}

// --- DeleteTask 测试 ---

func TestDeleteTask_WrongStatus(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	task, err := service.CreateTask(CreateTaskInput{
		FamilyID:  family.ID,
		Title:     "已完成任务",
		Points:    50,
		ChildID:   child.ID,
		ChildName: child.Nickname,
		CreatedBy: parent.ID,
		Status:    model.TaskStatusCompleted,
	})
	if err != nil {
		t.Fatalf("创建任务失败: %v", err)
	}

	err = service.DeleteTask(task.ID, family.ID)
	if err == nil {
		t.Fatal("对 status=3 任务删除应该返回错误")
	}
}

// --- SubmitTask 测试 ---

func TestSubmitTask(t *testing.T) {
	_, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	task, err := service.CreateTask(CreateTaskInput{
		FamilyID:  family.ID,
		Title:     "待提交任务",
		Points:    10,
		ChildID:   child.ID,
		ChildName: child.Nickname,
		CreatedBy: parent.ID,
	})
	if err != nil {
		t.Fatalf("创建任务失败: %v", err)
	}

	updated, err := service.SubmitTask(task.ID, family.ID, "photo.jpg")
	if err != nil {
		t.Fatalf("SubmitTask 失败: %v", err)
	}
	if updated.Status != model.TaskStatusSubmitted {
		t.Errorf("status got %d want %d", updated.Status, model.TaskStatusSubmitted)
	}
	if updated.Photo != "photo.jpg" {
		t.Errorf("Photo got %s want photo.jpg", updated.Photo)
	}
}

// --- ReviewTask 测试 ---

func TestReviewTask_Approved(t *testing.T) {
	db, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	// 创建进行中任务 -> 提交 -> 审核通过
	task, err := service.CreateTask(CreateTaskInput{
		FamilyID:  family.ID,
		Title:     "审核任务",
		Points:    25,
		ChildID:   child.ID,
		ChildName: child.Nickname,
		CreatedBy: parent.ID,
	})
	if err != nil {
		t.Fatalf("创建任务失败: %v", err)
	}

	_, err = service.SubmitTask(task.ID, family.ID, "photo.jpg")
	if err != nil {
		t.Fatalf("SubmitTask 失败: %v", err)
	}

	reviewed, err := service.ReviewTask(task.ID, family.ID, ReviewTaskInput{Approved: true})
	if err != nil {
		t.Fatalf("ReviewTask 失败: %v", err)
	}
	if reviewed.Status != model.TaskStatusCompleted {
		t.Errorf("status got %d want %d", reviewed.Status, model.TaskStatusCompleted)
	}

	// 余额检查
	var u model.User
	db.First(&u, child.ID)
	if u.Balance != 25 {
		t.Errorf("Balance got %d want 25", u.Balance)
	}

	// 有一条 transaction 记录
	var txs []model.Transaction
	db.Where("child_id = ?", child.ID).Find(&txs)
	if len(txs) != 1 {
		t.Errorf("transaction 数量 got %d want 1", len(txs))
	}
	tx := txs[0]
	if tx.BalanceAfter != 25 {
		t.Errorf("BalanceAfter got %d want 25", tx.BalanceAfter)
	}
}

func TestReviewTask_Rejected(t *testing.T) {
	db, family, parent, child := setupTestDB(t)
	service := NewTaskService()

	task, err := service.CreateTask(CreateTaskInput{
		FamilyID:  family.ID,
		Title:     "拒绝的任务",
		Points:    10,
		ChildID:   child.ID,
		ChildName: child.Nickname,
		CreatedBy: parent.ID,
	})
	if err != nil {
		t.Fatalf("创建任务失败: %v", err)
	}

	_, err = service.SubmitTask(task.ID, family.ID, "photo.jpg")
	if err != nil {
		t.Fatalf("SubmitTask 失败: %v", err)
	}

	reviewed, err := service.ReviewTask(task.ID, family.ID, ReviewTaskInput{Approved: false})
	if err != nil {
		t.Fatalf("ReviewTask 失败: %v", err)
	}
	if reviewed.Status != model.TaskStatusRejected {
		t.Errorf("status got %d want %d", reviewed.Status, model.TaskStatusRejected)
	}

	// 余额不变
	var u model.User
	db.First(&u, child.ID)
	if u.Balance != 0 {
		t.Errorf("Balance got %d want 0", u.Balance)
	}

	// 没有 transaction 记录
	var count int64
	db.Model(&model.Transaction{}).Where("child_id = ?", child.ID).Count(&count)
	if count != 0 {
		t.Errorf("transaction 数量 got %d want 0", count)
	}
}
