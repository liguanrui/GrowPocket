package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"growpocket/pkg/util"
	"log"

	"gorm.io/gorm"
)

type AuthService struct{}

func NewAuthService() *AuthService {
	return &AuthService{}
}

type RegisterInput struct {
	Nickname  string
	Password  string
	ShareCode string // 可选：填写则加入已有家庭
}

type RegisterOutput struct {
	User        *model.User
	Family      *model.Family
	Token       string
	HasChildren bool
	Joined      bool // true=通过分享码加入
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

	var existing model.User
	result := database.DB.Where("role = ? AND nickname = ?", "parent", input.Nickname).First(&existing)
	if result.Error == nil {
		return nil, errors.New("该昵称已被注册")
	}

	hashedPwd, err := util.HashPassword(input.Password)
	if err != nil {
		return nil, errors.New("密码加密失败")
	}

	shareCode := util.NormalizeShareCode(input.ShareCode)
	tx := database.DB.Begin()

	var family *model.Family
	joined := false
	skipSeed := false

	if shareCode != "" {
		var existingFamily model.Family
		if err := tx.Where("share_code = ?", shareCode).First(&existingFamily).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("家庭分享码无效")
		}
		if !existingFamily.IsActive {
			tx.Rollback()
			return nil, errors.New("该家庭已停用，无法加入")
		}
		family = &existingFamily
		joined = true
		skipSeed = true
	} else {
		code, err := allocateUniqueShareCode(tx)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		family = &model.Family{Name: input.Nickname + "家", ShareCode: code, IsActive: true}
		if err := tx.Create(family).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("创建家庭失败")
		}
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

	var childCount int64
	tx.Model(&model.User{}).Where("family_id = ? AND role = ?", family.ID, model.RoleChild).Count(&childCount)

	if err := tx.Commit().Error; err != nil {
		return nil, errors.New("注册失败")
	}

	if !skipSeed {
		if err := NewTaskTemplateService().SeedInitialTemplates(family.ID, user.ID); err != nil {
			log.Printf("初始化任务模板失败(family=%d): %v", family.ID, err)
		}
	}

	token, err := util.GenerateJWT(user.ID, family.ID, user.Nickname, user.Role, jwtSecret, jwtDuration)
	if err != nil {
		return nil, errors.New("生成令牌失败")
	}

	return &RegisterOutput{
		User:        user,
		Family:      family,
		Token:       token,
		HasChildren: childCount > 0,
		Joined:      joined,
	}, nil
}

func allocateUniqueShareCode(tx *gorm.DB) (string, error) {
	for retry := 0; retry < 12; retry++ {
		code, err := util.GenerateShareCode(8)
		if err != nil {
			return "", errors.New("生成分享码失败")
		}
		var count int64
		tx.Model(&model.Family{}).Where("share_code = ?", code).Count(&count)
		if count == 0 {
			return code, nil
		}
	}
	return "", errors.New("生成分享码失败，请重试")
}

type LoginInput struct {
	Nickname string
	Password string
}

type LoginOutput struct {
	User   *model.User
	Family *model.Family
	Token  string
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
	if err := database.DB.First(&family, user.FamilyID).Error; err != nil {
		return nil, errors.New("家庭不存在")
	}
	// 旧数据兜底：登录时若无分享码则补一个
	if family.ShareCode == "" {
		if code, err := allocateUniqueShareCode(database.DB); err == nil {
			database.DB.Model(&family).Update("share_code", code)
			family.ShareCode = code
		}
	}

	token, err := util.GenerateJWT(user.ID, family.ID, user.Nickname, user.Role, jwtSecret, jwtDuration)
	if err != nil {
		return nil, errors.New("生成令牌失败")
	}

	return &LoginOutput{
		User:   &user,
		Family: &family,
		Token:  token,
	}, nil
}
