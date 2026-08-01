package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"time"
)

type ChildService struct{}

func NewChildService() *ChildService {
	return &ChildService{}
}

type AddChildInput struct {
	FamilyID uint
	Nickname string
	Gender   *int
	Birthday *time.Time
	Grade    *int
	Age      *int
	Hobbies  string
}

func (s *ChildService) AddChild(input AddChildInput) (*model.User, error) {
	if input.Nickname == "" {
		return nil, errors.New("姓名不能为空")
	}

	child := &model.User{
		FamilyID: input.FamilyID,
		Role:     "child",
		Nickname: input.Nickname,
		Gender:   input.Gender,
		Birthday: input.Birthday,
		Grade:    input.Grade,
		Age:      input.Age,
		Hobbies:  input.Hobbies,
		Balance:  0,
	}

	if err := database.DB.Create(child).Error; err != nil {
		return nil, errors.New("创建孩子档案失败")
	}

	return child, nil
}

func (s *ChildService) ListChildren(familyID uint) ([]model.User, error) {
	var children []model.User
	err := database.DB.Where("family_id = ? AND role = ?", familyID, "child").
		Order("created_at ASC").Find(&children).Error
	return children, err
}

func (s *ChildService) GetChild(id, familyID uint) (*model.User, error) {
	var child model.User
	err := database.DB.Where("id = ? AND family_id = ? AND role = ?", id, familyID, "child").First(&child).Error
	if err != nil {
		return nil, errors.New("孩子档案不存在")
	}
	return &child, nil
}

type UpdateChildInput struct {
	Nickname *string
	Gender   *int
	Birthday *time.Time
	Avatar   *string
	Grade    *int
	Age      *int
	Hobbies  *string
}

func (s *ChildService) UpdateChild(id, familyID uint, input UpdateChildInput) (*model.User, error) {
	child, err := s.GetChild(id, familyID)
	if err != nil {
		return nil, err
	}

	if input.Nickname != nil {
		child.Nickname = *input.Nickname
	}
	if input.Gender != nil {
		child.Gender = input.Gender
	}
	if input.Birthday != nil {
		child.Birthday = input.Birthday
	}
	if input.Avatar != nil {
		child.Avatar = *input.Avatar
	}
	if input.Grade != nil {
		child.Grade = input.Grade
	}
	if input.Age != nil {
		child.Age = input.Age
	}
	if input.Hobbies != nil {
		child.Hobbies = *input.Hobbies
	}

	if err := database.DB.Save(child).Error; err != nil {
		return nil, errors.New("更新失败")
	}
	return child, nil
}

func (s *ChildService) DeleteChild(id, familyID uint) error {
	result := database.DB.Where("id = ? AND family_id = ? AND role = ?", id, familyID, "child").Delete(&model.User{})
	if result.Error != nil {
		return errors.New("删除失败")
	}
	if result.RowsAffected == 0 {
		return errors.New("记录不存在")
	}
	return nil
}

func (s *ChildService) UpdateFamilyName(familyID uint, name string) (*model.Family, error) {
	if name == "" {
		return nil, errors.New("家庭名称不能为空")
	}

	var family model.Family
	if err := database.DB.First(&family, familyID).Error; err != nil {
		return nil, errors.New("家庭不存在")
	}

	family.Name = name
	if err := database.DB.Save(&family).Error; err != nil {
		return nil, errors.New("更新失败")
	}

	return &family, nil
}
