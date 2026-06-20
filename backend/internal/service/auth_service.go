package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"growpocket/pkg/util"
)

type AuthService struct{}

func NewAuthService() *AuthService {
	return &AuthService{}
}

type RegisterInput struct {
	Nickname string
	Password string
}

type RegisterOutput struct {
	User      *model.User
	Family    *model.Family
	Token     string
}

func (s *AuthService) Register(input RegisterInput, jwtSecret string, jwtDuration int) (*RegisterOutput, error) {
	if input.Nickname == "" || input.Password == "" {
		return nil, errors.New("昵称和密码不能为空")
	}
	if len(input.Nickname) < 2 || len(input.Nickname) > 50 {
		return nil, errors.New("昵称长度需在 2-50 字符之间")
	}
	if len(input.Password) < 6 {
		return nil, errors.New("密码至少 6 位")
	}

	// 检查昵称是否已存在（仅限家长）
	var existing model.User
	result := database.DB.Where("role = ? AND nickname = ?", "parent", input.Nickname).First(&existing)
	if result.Error == nil {
		return nil, errors.New("该昵称已被注册")
	}

	// 密码加密
	hashedPwd, err := util.HashPassword(input.Password)
	if err != nil {
		return nil, errors.New("密码加密失败")
	}

	// 事务：创建家庭 + 创建家长账号
	tx := database.DB.Begin()

	family := &model.Family{Name: input.Nickname + "家"}
	if err := tx.Create(family).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("创建家庭失败")
	}

	user := &model.User{
		FamilyID: family.ID,
		Role:     "parent",
		Nickname: input.Nickname,
		Password: hashedPwd,
	}
	if err := tx.Create(user).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("创建账号失败")
	}

	tx.Commit()

	// 生成 JWT
	token, err := util.GenerateJWT(user.ID, family.ID, user.Nickname, jwtSecret, jwtDuration)
	if err != nil {
		return nil, errors.New("生成令牌失败")
	}

	return &RegisterOutput{
		User:   user,
		Family: family,
		Token:  token,
	}, nil
}

type LoginInput struct {
	Nickname string
	Password string
}

type LoginOutput struct {
	User      *model.User
	Family    *model.Family
	Token     string
}

func (s *AuthService) Login(input LoginInput, jwtSecret string, jwtDuration int) (*LoginOutput, error) {
	if input.Nickname == "" || input.Password == "" {
		return nil, errors.New("昵称和密码不能为空")
	}

	var user model.User
	result := database.DB.Where("role = ? AND nickname = ?", "parent", input.Nickname).First(&user)
	if result.Error != nil {
		return nil, errors.New("昵称或密码错误")
	}

	if !util.CheckPassword(user.Password, input.Password) {
		return nil, errors.New("昵称或密码错误")
	}

	var family model.Family
	database.DB.First(&family, user.FamilyID)

	token, err := util.GenerateJWT(user.ID, family.ID, user.Nickname, jwtSecret, jwtDuration)
	if err != nil {
		return nil, errors.New("生成令牌失败")
	}

	return &LoginOutput{
		User:   &user,
		Family: &family,
		Token:  token,
	}, nil
}
