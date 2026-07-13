package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"strconv"
	"strings"
	"time"
)

type TaskRecurringService struct{}

func NewTaskRecurringService() *TaskRecurringService {
	return &TaskRecurringService{}
}

type CreateRecurringConfigInput struct {
	FamilyID      uint
	TemplateID    uint
	ChildID       uint
	ChildName     string
	Title         string
	Description   string
	Points        int
	Frequency     string
	WeekDays      string
	CreatedBy     uint
}

func (s *TaskRecurringService) CreateRecurringConfig(input CreateRecurringConfigInput) (*model.TaskRecurringConfig, error) {
	if input.Title == "" {
		return nil, errors.New("任务标题不能为空")
	}
	if input.Frequency == "" {
		input.Frequency = "daily"
	}
	if input.Points <= 0 {
		return nil, errors.New("积分必须大于0")
	}

	nextGenerateAt := time.Now()
	if input.Frequency == "daily" {
		nextGenerateAt = time.Now().Add(24 * time.Hour)
	} else if input.Frequency == "weekly" {
		nextGenerateAt = time.Now().Add(7 * 24 * time.Hour)
	} else if input.Frequency == "monthly" {
		nextGenerateAt = time.Now().AddDate(0, 1, 0)
	}

	config := &model.TaskRecurringConfig{
		FamilyID:        input.FamilyID,
		TemplateID:      input.TemplateID,
		ChildID:         input.ChildID,
		ChildName:       input.ChildName,
		Title:           input.Title,
		Description:     input.Description,
		Points:          input.Points,
		Frequency:       input.Frequency,
		WeekDays:        input.WeekDays,
		IsActive:        true,
		NextGenerateAt:  nextGenerateAt,
		CreatedBy:       input.CreatedBy,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := database.DB.Create(config).Error; err != nil {
		return nil, errors.New("创建循环任务配置失败")
	}
	return config, nil
}

func (s *TaskRecurringService) ListRecurringConfigs(familyID uint) ([]model.TaskRecurringConfig, error) {
	var configs []model.TaskRecurringConfig
	err := database.DB.Where("family_id = ?", familyID).
		Order("created_at DESC").
		Find(&configs).Error
	return configs, err
}

func (s *TaskRecurringService) GetRecurringConfig(id, familyID uint) (*model.TaskRecurringConfig, error) {
	var config model.TaskRecurringConfig
	err := database.DB.Where("id = ? AND family_id = ?", id, familyID).First(&config).Error
	if err != nil {
		return nil, errors.New("循环任务配置不存在")
	}
	return &config, nil
}

func (s *TaskRecurringService) UpdateRecurringConfig(id, familyID uint, title, description, frequency, weekDays *string, points *int, isActive *bool) (*model.TaskRecurringConfig, error) {
	config, err := s.GetRecurringConfig(id, familyID)
	if err != nil {
		return nil, err
	}

	if title != nil {
		if *title == "" {
			return nil, errors.New("任务标题不能为空")
		}
		config.Title = *title
	}
	if description != nil {
		config.Description = *description
	}
	if frequency != nil {
		config.Frequency = *frequency
	}
	if weekDays != nil {
		config.WeekDays = *weekDays
	}
	if points != nil {
		if *points <= 0 {
			return nil, errors.New("积分必须大于0")
		}
		config.Points = *points
	}
	if isActive != nil {
		config.IsActive = *isActive
	}

	config.UpdatedAt = time.Now()
	if err := database.DB.Save(config).Error; err != nil {
		return nil, errors.New("更新循环任务配置失败")
	}
	return config, nil
}

func (s *TaskRecurringService) DeleteRecurringConfig(id, familyID uint) error {
	config, err := s.GetRecurringConfig(id, familyID)
	if err != nil {
		return err
	}
	if err := database.DB.Delete(config).Error; err != nil {
		return errors.New("删除循环任务配置失败")
	}
	return nil
}

func (s *TaskRecurringService) GenerateRecurringTasks(familyID uint) error {
	var configs []model.TaskRecurringConfig
	err := database.DB.Where("family_id = ? AND is_active = ? AND next_generate_at <= ?", familyID, true, time.Now()).
		Find(&configs).Error
	if err != nil {
		return err
	}

	for _, config := range configs {
		if !s.shouldGenerateToday(&config) {
			continue
		}

		task := &model.Task{
			FamilyID:    config.FamilyID,
			Title:       config.Title,
			Description: config.Description,
			Points:      config.Points,
			Status:      model.TaskStatusInProgress,
			ChildID:     config.ChildID,
			ChildName:   config.ChildName,
			CreatedBy:   config.CreatedBy,
			TemplateID:  config.TemplateID,
			Category:    "其他",
			Frequency:   config.Frequency,
			RecurringID: &config.ID,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		if err := database.DB.Create(task).Error; err != nil {
			return err
		}

		nextTime := s.calculateNextGenerateAt(&config)
		config.NextGenerateAt = nextTime
		config.UpdatedAt = time.Now()
		if err := database.DB.Save(&config).Error; err != nil {
			return err
		}
	}

	return nil
}

func (s *TaskRecurringService) shouldGenerateToday(config *model.TaskRecurringConfig) bool {
	if config.Frequency != "weekly" || config.WeekDays == "" {
		return true
	}

	today := int(time.Now().Weekday())

	parts := strings.Split(config.WeekDays, ",")
	for _, part := range parts {
		day, err := strconv.Atoi(strings.TrimSpace(part))
		if err == nil && day == today {
			return true
		}
	}
	return false
}

func (s *TaskRecurringService) calculateNextGenerateAt(config *model.TaskRecurringConfig) time.Time {
	now := time.Now()
	switch config.Frequency {
	case "daily":
		return now.Add(24 * time.Hour)
	case "weekly":
		return now.Add(7 * 24 * time.Hour)
	case "monthly":
		return now.AddDate(0, 1, 0)
	default:
		return now.Add(24 * time.Hour)
	}
}

func GenerateAllRecurringTasks() error {
	var families []model.Family
	if err := database.DB.Find(&families).Error; err != nil {
		return err
	}

	s := NewTaskRecurringService()
	for _, f := range families {
		if err := s.GenerateRecurringTasks(f.ID); err != nil {
			return err
		}
	}
	return nil
}
