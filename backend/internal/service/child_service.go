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

// ComputeAge 按生日计算周岁（闰年后生日安全）
func ComputeAge(birthday time.Time) int {
	now := time.Now()
	age := now.Year() - birthday.Year()
	if now.Month() < birthday.Month() || (now.Month() == birthday.Month() && now.Day() < birthday.Day()) {
		age--
	}
	if age < 0 {
		return 0
	}
	return age
}

// ComputeGrade 按生日 + 中国 9/1 入学规则推算年级（0=幼儿园/未入学, 1-6 小学）
func ComputeGrade(birthday time.Time) int {
	now := time.Now()
	enrollAge := 6
	// 基准年：当年 9 月之后视为"新学年"用当年，否则按上一学年计算
	baseYear := now.Year()
	if now.Month() < 9 {
		baseYear--
	}
	enrollYear := birthday.Year() + enrollAge
	// 下半年出生（9 月及以后）按规则下一年才入学，向后偏移 1 年
	if birthday.Month() >= 9 {
		enrollYear++
	}
	grade := (baseYear - enrollYear) + 1
	if grade < 0 {
		grade = 0
	}
	if grade > 6 {
		grade = 6
	}
	return grade
}

// ResolveAge 返回"可用年龄"：优先 Birthday 实时推算，无 Birthday fallback 到冗余 Age 字段，均为空则 0
func ResolveAge(child *model.User) int {
	if child.Birthday != nil {
		return ComputeAge(*child.Birthday)
	}
	if child.Age != nil {
		a := *child.Age
		if a < 0 {
			a = 0
		}
		return a
	}
	return 0
}

// ResolveGrade 返回"可用年级"：
// 1) grade_overridden=true → 用 Grade 手动值；
// 2) Birthday 存在 → 推算；
// 3) 否则 fallback 冗余 Grade 字段，均为空则 0
// 同时返回 grade_overridden（用户是否手动覆盖）
func ResolveGrade(child *model.User) (grade int, overridden bool) {
	if child.GradeOverridden && child.Grade != nil {
		g := *child.Grade
		if g < 0 {
			g = 0
		}
		if g > 6 {
			g = 6
		}
		return g, true
	}
	if child.Birthday != nil {
		return ComputeGrade(*child.Birthday), false
	}
	if child.Grade != nil {
		g := *child.Grade
		if g < 0 {
			g = 0
		}
		if g > 6 {
			g = 6
		}
		return g, false
	}
	return 0, false
}

// refreshAgeFromBirthday 保存前：若 Birthday 存在则刷新 Age 冗余字段；若 Grade 未覆盖则刷新 Grade 冗余字段
func refreshAgeFromBirthday(child *model.User) {
	if child.Birthday != nil {
		age := ComputeAge(*child.Birthday)
		child.Age = &age
		if !child.GradeOverridden {
			g := ComputeGrade(*child.Birthday)
			child.Grade = &g
		}
	}
}

type AddChildInput struct {
	FamilyID       uint
	Nickname       string
	Gender         *int
	Birthday       *time.Time
	Grade          *int
	GradeOverridden *bool
	Age            *int
	Hobbies        string
}

func (s *ChildService) AddChild(input AddChildInput) (*model.User, error) {
	if input.Nickname == "" {
		return nil, errors.New("姓名不能为空")
	}

	gradeOverridden := false
	if input.GradeOverridden != nil {
		gradeOverridden = *input.GradeOverridden
	}

	child := &model.User{
		FamilyID:       input.FamilyID,
		Role:           model.RoleChild,
		Nickname:       input.Nickname,
		Gender:         input.Gender,
		Birthday:       input.Birthday,
		Grade:          input.Grade,
		GradeOverridden: gradeOverridden,
		Age:            input.Age,
		Hobbies:        input.Hobbies,
		Balance:        0, // 新手指引不加积分：创建时默认 0，不做任何加法
	}

	refreshAgeFromBirthday(child)

	if err := database.DB.Create(child).Error; err != nil {
		return nil, errors.New("创建孩子档案失败")
	}

	return child, nil
}

func (s *ChildService) ListChildren(familyID uint) ([]model.User, error) {
	var children []model.User
	err := database.DB.Where("family_id = ? AND role = ?", familyID, model.RoleChild).
		Order("created_at ASC").Find(&children).Error
	return children, err
}

func (s *ChildService) GetChild(id, familyID uint) (*model.User, error) {
	var child model.User
	err := database.DB.Where("id = ? AND family_id = ? AND role = ?", id, familyID, model.RoleChild).First(&child).Error
	if err != nil {
		return nil, errors.New("孩子档案不存在")
	}
	return &child, nil
}

type UpdateChildInput struct {
	Nickname        *string
	Gender          *int
	Birthday        *time.Time
	Avatar          *string
	Grade           *int
	GradeOverridden *bool
	Age             *int
	Hobbies         *string
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
	if input.GradeOverridden != nil {
		child.GradeOverridden = *input.GradeOverridden
	}
	if input.Grade != nil {
		child.Grade = input.Grade
		if child.GradeOverridden {
			// 手动覆盖：将 grade 规范化到 0-6
			g := *child.Grade
			if g < 0 {
				g = 0
			}
			if g > 6 {
				g = 6
			}
			child.Grade = &g
		}
	}
	if input.Age != nil {
		child.Age = input.Age
	}
	if input.Hobbies != nil {
		child.Hobbies = *input.Hobbies
	}

	refreshAgeFromBirthday(child)

	if err := database.DB.Save(child).Error; err != nil {
		return nil, errors.New("更新失败")
	}
	return child, nil
}

func (s *ChildService) DeleteChild(id, familyID uint) error {
	result := database.DB.Where("id = ? AND family_id = ? AND role = ?", id, familyID, model.RoleChild).Delete(&model.User{})
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
