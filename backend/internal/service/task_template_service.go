package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"time"
)

type TaskTemplateService struct{}

func NewTaskTemplateService() *TaskTemplateService {
	return &TaskTemplateService{}
}

func (s *TaskTemplateService) CreateTemplate(familyID uint, createdBy uint, title, description, icon, category string, points, sortOrder int) (*model.TaskTemplate, error) {
	if title == "" {
		return nil, errors.New("任务模板标题不能为空")
	}
	if points < 0 {
		return nil, errors.New("积分值不能小于 0")
	}

	if category == "" {
		category = "学习"
	}
	if icon == "" {
		icon = "⭐"
	}

	template := &model.TaskTemplate{
		FamilyID:    familyID,
		CreatedBy:   createdBy,
		Title:       title,
		Description: description,
		Icon:        icon,
		Category:    category,
		Points:      points,
		SortOrder:   sortOrder,
		IsActive:    true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := database.DB.Create(template).Error; err != nil {
		return nil, errors.New("创建任务模板失败")
	}
	return template, nil
}

func (s *TaskTemplateService) UpdateTemplate(id uint, familyID uint, title, description, icon, category *string, points, sortOrder *int, isActive *bool) (*model.TaskTemplate, error) {
	template, err := s.GetTemplate(id, familyID)
	if err != nil {
		return nil, err
	}

	if title != nil {
		if *title == "" {
			return nil, errors.New("任务模板标题不能为空")
		}
		template.Title = *title
	}
	if description != nil {
		template.Description = *description
	}
	if icon != nil {
		template.Icon = *icon
	}
	if category != nil {
		template.Category = *category
	}
	if points != nil {
		if *points < 0 {
			return nil, errors.New("积分值不能小于 0")
		}
		template.Points = *points
	}
	if sortOrder != nil {
		template.SortOrder = *sortOrder
	}
	if isActive != nil {
		template.IsActive = *isActive
	}

	template.UpdatedAt = time.Now()
	if err := database.DB.Save(template).Error; err != nil {
		return nil, errors.New("更新任务模板失败")
	}
	return template, nil
}

func (s *TaskTemplateService) DeleteTemplate(id uint, familyID uint) error {
	template, err := s.GetTemplate(id, familyID)
	if err != nil {
		return err
	}
	if err := database.DB.Delete(template).Error; err != nil {
		return errors.New("删除任务模板失败")
	}
	return nil
}

func (s *TaskTemplateService) ListTemplates(familyID uint) ([]model.TaskTemplate, error) {
	var templates []model.TaskTemplate
	err := database.DB.Where("family_id = ?", familyID).
		Order("sort_order ASC, created_at ASC").
		Find(&templates).Error
	if err != nil {
		return nil, errors.New("查询任务模板列表失败")
	}
	return templates, nil
}

func (s *TaskTemplateService) GetTemplate(id uint, familyID uint) (*model.TaskTemplate, error) {
	var template model.TaskTemplate
	err := database.DB.Where("id = ? AND family_id = ?", id, familyID).First(&template).Error
	if err != nil {
		return nil, errors.New("任务模板不存在")
	}
	return &template, nil
}

func (s *TaskTemplateService) CreateTaskFromTemplate(templateID uint, familyID uint, childID uint, childName string, createdBy uint) (*model.Task, error) {
	template, err := s.GetTemplate(templateID, familyID)
	if err != nil {
		return nil, err
	}

	task := &model.Task{
		FamilyID:    familyID,
		Title:       template.Title,
		Description: template.Description,
		Points:      template.Points,
		Status:      model.TaskStatusInProgress,
		ChildID:     childID,
		ChildName:   childName,
		CreatedBy:   createdBy,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := database.DB.Create(task).Error; err != nil {
		return nil, errors.New("从模板创建任务失败")
	}
	return task, nil
}
