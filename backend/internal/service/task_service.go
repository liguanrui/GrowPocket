package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"time"
)

type TaskService struct{}

func NewTaskService() *TaskService {
	return &TaskService{}
}

type CreateTaskInput struct {
	FamilyID  uint
	Title     string
	Description string
	Points    int
	ChildID   uint
	ChildName string
	CreatedBy uint
	Photo     string     // 可选（创建时直接上传成果照片/奖惩凭证）
	Deadline  *time.Time
	Status    int        // 1=进行中（默认）, 3=直接已完成（奖惩任务）
}

func (s *TaskService) CreateTask(input CreateTaskInput) (*model.Task, error) {
	if input.Title == "" {
		return nil, errors.New("任务标题不能为空")
	}
	if input.Points == 0 {
		return nil, errors.New("积分值不能为 0")
	}

	if input.Status != model.TaskStatusCompleted && input.Status != model.TaskStatusInProgress {
		input.Status = model.TaskStatusInProgress
	}

	task := &model.Task{
		FamilyID:    input.FamilyID,
		Title:       input.Title,
		Description: input.Description,
		Points:      input.Points,
		Status:      input.Status,
		ChildID:     input.ChildID,
		ChildName:   input.ChildName,
		CreatedBy:   input.CreatedBy,
		Photo:       input.Photo,
		Deadline:    input.Deadline,
	}

	// 如果 status = 3，创建即视为「已完成」，要立即结算积分（事务中）
	if input.Status == model.TaskStatusCompleted {
		tx := database.DB.Begin()

		if err := tx.Create(task).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("创建任务失败")
		}

		// 更新 child balance
		var child model.User
		if err := tx.Set("gorm:query_option", "").
			Where("id = ? AND role = ?", input.ChildID, "child").
			First(&child).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("孩子档案不存在")
		}

		newBalance := child.Balance + input.Points
		if newBalance < 0 {
			tx.Rollback()
			return nil, errors.New("余额不足")
		}
		if err := tx.Model(&child).Update("balance", newBalance).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("更新余额失败")
		}

		// 生成 transaction
		tType := model.TransactionTypeIncome
		reason := "完成任务：" + input.Title
		if input.Points < 0 {
			tType = model.TransactionTypeExpense
			reason = input.Title
		}
		taskID := task.ID
		relatedType := "task"
		txRec := &model.Transaction{
			ChildID:     input.ChildID,
			Type:        tType,
			Amount:      absInt(input.Points),
			Reason:      reason,
			RelatedID:   &taskID,
			RelatedType: &relatedType,
			BalanceAfter: newBalance,
		}
		if err := tx.Create(txRec).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("创建积分记录失败")
		}

		if err := tx.Commit().Error; err != nil {
			return nil, errors.New("提交事务失败")
		}

		achievementService := &AchievementService{}
		updateTaskAchievementCounters(achievementService, input.ChildID, input.FamilyID, task.TemplateID, input.Points)

		return task, nil
	}

	// 默认 status=1，普通创建
	if err := database.DB.Create(task).Error; err != nil {
		return nil, errors.New("创建任务失败")
	}
	return task, nil
}

func (s *TaskService) ListTasks(familyID uint, childID uint, status int, page, pageSize int) ([]model.Task, int64, error) {
	var tasks []model.Task
	var total int64

	db := database.DB.Model(&model.Task{}).Where("family_id = ?", familyID)
	if childID > 0 {
		db = db.Where("child_id = ?", childID)
	}
	if status > 0 {
		db = db.Where("status = ?", status)
	}

	db.Count(&total)

	offset := (page - 1) * pageSize
	err := db.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&tasks).Error
	return tasks, total, err
}

func (s *TaskService) GetTask(id, familyID uint) (*model.Task, error) {
	var task model.Task
	err := database.DB.Where("id = ? AND family_id = ?", id, familyID).First(&task).Error
	if err != nil {
		return nil, errors.New("任务不存在")
	}
	return &task, nil
}

type UpdateTaskInput struct {
	Title       *string
	Description *string
	Points      *int
	Deadline    *time.Time
}

func (s *TaskService) UpdateTask(id, familyID uint, input UpdateTaskInput) (*model.Task, error) {
	task, err := s.GetTask(id, familyID)
	if err != nil {
		return nil, err
	}
	if task.Status != model.TaskStatusInProgress {
		return nil, errors.New("仅进行中的任务可编辑")
	}

	if input.Title != nil {
		task.Title = *input.Title
	}
	if input.Description != nil {
		task.Description = *input.Description
	}
	if input.Points != nil {
		if *input.Points == 0 {
			return nil, errors.New("积分值不能为 0")
		}
		task.Points = *input.Points
	}
	if input.Deadline != nil {
		task.Deadline = input.Deadline
	}

	if err := database.DB.Save(task).Error; err != nil {
		return nil, errors.New("更新失败")
	}
	return task, nil
}

func (s *TaskService) DeleteTask(id, familyID uint) error {
	task, err := s.GetTask(id, familyID)
	if err != nil {
		return err
	}
	if task.Status != model.TaskStatusInProgress && task.Status != model.TaskStatusRejected {
		return errors.New("仅进行中/已拒绝状态的任务可删除")
	}
	if err := database.DB.Delete(task).Error; err != nil {
		return errors.New("删除失败")
	}
	return nil
}

func (s *TaskService) SubmitTask(id, familyID uint, photo string) (*model.Task, error) {
	task, err := s.GetTask(id, familyID)
	if err != nil {
		return nil, err
	}
	if task.Status != model.TaskStatusInProgress && task.Status != model.TaskStatusRejected {
		return nil, errors.New("该状态的任务无法提交验收")
	}

	task.Status = model.TaskStatusSubmitted
	task.Photo = photo
	if err := database.DB.Save(task).Error; err != nil {
		return nil, errors.New("提交失败")
	}
	return task, nil
}

type ReviewTaskInput struct {
	Approved bool
	Points   int // 可选：实际评分（不填则使用任务 points）
}

func (s *TaskService) ReviewTask(id, familyID uint, input ReviewTaskInput) (*model.Task, error) {
	task, err := s.GetTask(id, familyID)
	if err != nil {
		return nil, err
	}
	if task.Status != model.TaskStatusSubmitted {
		return nil, errors.New("仅待验收状态的任务可审核")
	}

	if !input.Approved {
		// 拒绝：不改变积分，状态变为 4
		task.Status = model.TaskStatusRejected
		if err := database.DB.Save(task).Error; err != nil {
			return nil, errors.New("审核失败")
		}
		return task, nil
	}

	// 通过：原子更新 balance + 插入 transaction + 状态变为 3
	actualPoints := input.Points
	if actualPoints == 0 {
		actualPoints = task.Points
	}
	if actualPoints < 0 {
		actualPoints = task.Points
	}

	tx := database.DB.Begin()

	// 1. 查 child 余额
	var child model.User
	if err := tx.Where("id = ? AND role = ?", task.ChildID, "child").First(&child).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("孩子档案不存在")
	}

	// 2. 更新 balance
	newBalance := child.Balance + actualPoints
	if err := tx.Model(&child).Update("balance", newBalance).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("更新余额失败")
	}

	// 3. 生成 transaction
	tType := model.TransactionTypeIncome
	reason := "完成任务：" + task.Title
	if actualPoints < 0 {
		tType = model.TransactionTypeExpense
		reason = task.Title
	}
	taskID := task.ID
	relatedType := "task"
	txRec := &model.Transaction{
		ChildID:      task.ChildID,
		Type:         tType,
		Amount:       absInt(actualPoints),
		Reason:       reason,
		RelatedID:    &taskID,
		RelatedType:  &relatedType,
		BalanceAfter: newBalance,
	}
	if err := tx.Create(txRec).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("创建积分记录失败")
	}

	// 4. 更新任务状态 & points
	task.Status = model.TaskStatusCompleted
	task.Points = actualPoints
	if err := tx.Save(task).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("更新任务状态失败")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, errors.New("提交事务失败")
	}

	achievementService := &AchievementService{}
	updateTaskAchievementCounters(achievementService, task.ChildID, familyID, task.TemplateID, actualPoints)

	return task, nil
}

func absInt(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

func updateTaskAchievementCounters(achievementService *AchievementService, childID, familyID, templateID uint, points int) {
	if _, err := achievementService.IncrementCounter(childID, model.CounterTypeTaskCount, 0, 1); err != nil {
		log.Printf("[Achievement] IncrementCounter(TaskCount) child=%d failed: %v", childID, err)
	} else {
		achievementService.CheckAchievementsForFamily(childID, familyID, model.CounterTypeTaskCount, 0)
	}

	if templateID > 0 {
		if _, err := achievementService.IncrementCounter(childID, model.CounterTypeTemplateTaskCount, templateID, 1); err != nil {
			log.Printf("[Achievement] IncrementCounter(TemplateTaskCount) child=%d template=%d failed: %v", childID, templateID, err)
		} else {
			achievementService.CheckAchievementsForFamily(childID, familyID, model.CounterTypeTemplateTaskCount, templateID)
		}
	}

	if _, err := achievementService.IncrementCounter(childID, model.CounterTypeConsecutiveDays, 0, 1); err != nil {
		log.Printf("[Achievement] IncrementCounter(ConsecutiveDays) child=%d failed: %v", childID, err)
	} else {
		achievementService.CheckAchievementsForFamily(childID, familyID, model.CounterTypeConsecutiveDays, 0)
	}

	if points > 0 {
		if _, err := achievementService.IncrementCounter(childID, model.CounterTypeTotalPoints, 0, points); err != nil {
			log.Printf("[Achievement] IncrementCounter(TotalPoints) child=%d points=%d failed: %v", childID, points, err)
		} else {
			achievementService.CheckAchievementsForFamily(childID, familyID, model.CounterTypeTotalPoints, 0)
		}
	}
}
