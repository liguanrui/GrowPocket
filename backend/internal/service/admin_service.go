package service

import (
	"crypto/rand"
	"errors"
	"growpocket/internal/config"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"growpocket/pkg/util"
	"log"
	"math/big"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const adminBcryptCost = 12

type AdminAuthService struct {
	cfg *config.Config
}

func NewAdminAuthService(cfg *config.Config) *AdminAuthService {
	return &AdminAuthService{cfg: cfg}
}

func (s *AdminAuthService) hashPassword(pwd string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pwd), adminBcryptCost)
	return string(b), err
}

func (s *AdminAuthService) Login(username, password, clientIP string) (*model.AdminUser, string, error) {
	if username == "" || password == "" {
		return nil, "", errors.New("用户名和密码不能为空")
	}

	var admin model.AdminUser
	result := database.DB.Where("username = ?", username).First(&admin)
	if result.Error != nil {
		return nil, "", errors.New("用户名或密码错误")
	}

	if bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(password)) != nil {
		return nil, "", errors.New("用户名或密码错误")
	}

	if !admin.IsActive {
		return nil, "", errors.New("账号已被停用")
	}

	now := time.Now()
	database.DB.Model(&admin).Updates(map[string]interface{}{
		"last_login_at": &now,
		"last_login_ip": clientIP,
	})
	admin.LastLoginAt = &now
	admin.LastLoginIP = clientIP

	token, err := util.GenerateAdminJWT(admin.ID, admin.Username, admin.Role, s.cfg.AdminJWTSecret, s.cfg.AdminJWTExpireHour)
	if err != nil {
		return nil, "", errors.New("生成令牌失败")
	}

	return &admin, token, nil
}

func (s *AdminAuthService) ChangePassword(adminID uint, oldPwd, newPwd string) error {
	if oldPwd == "" || newPwd == "" {
		return errors.New("密码不能为空")
	}
	if len(newPwd) < 8 {
		return errors.New("新密码长度至少 8 位")
	}

	var admin model.AdminUser
	if err := database.DB.First(&admin, adminID).Error; err != nil {
		return errors.New("管理员不存在")
	}

	if bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(oldPwd)) != nil {
		return errors.New("原密码错误")
	}

	hashed, err := s.hashPassword(newPwd)
	if err != nil {
		return errors.New("密码加密失败")
	}

	return database.DB.Model(&admin).Update("password", hashed).Error
}

func (s *AdminAuthService) ListAdmins() ([]model.AdminUser, error) {
	var admins []model.AdminUser
	err := database.DB.Order("id ASC").Find(&admins).Error
	return admins, err
}

func (s *AdminAuthService) CreateAdmin(u *model.AdminUser, password string) error {
	if u.Username == "" {
		return errors.New("用户名不能为空")
	}
	if len(u.Username) < 2 || len(u.Username) > 50 {
		return errors.New("用户名长度需在 2-50 字符之间")
	}
	if password == "" {
		return errors.New("密码不能为空")
	}
	if len(password) < 8 {
		return errors.New("密码长度至少 8 位")
	}
	if u.Role == "" {
		u.Role = model.AdminRoleAdmin
	}

	var count int64
	database.DB.Model(&model.AdminUser{}).Where("username = ?", u.Username).Count(&count)
	if count > 0 {
		return errors.New("该用户名已存在")
	}

	hashed, err := s.hashPassword(password)
	if err != nil {
		return errors.New("密码加密失败")
	}
	u.Password = hashed

	return database.DB.Create(u).Error
}

func (s *AdminAuthService) UpdateAdmin(id uint, u *model.AdminUser) error {
	var existing model.AdminUser
	if err := database.DB.First(&existing, id).Error; err != nil {
		return errors.New("管理员不存在")
	}

	updates := map[string]interface{}{}
	if u.Nickname != "" {
		updates["nickname"] = u.Nickname
	}
	if u.Role != "" {
		updates["role"] = u.Role
	}
	updates["is_active"] = u.IsActive

	return database.DB.Model(&existing).Updates(updates).Error
}

func (s *AdminAuthService) DeleteAdmin(id uint) error {
	var existing model.AdminUser
	if err := database.DB.First(&existing, id).Error; err != nil {
		return errors.New("管理员不存在")
	}
	return database.DB.Delete(&existing).Error
}

func randomPassword(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			b[i] = charset[i%len(charset)]
			continue
		}
		b[i] = charset[n.Int64()]
	}
	return string(b)
}

func (s *AdminAuthService) SeedInitialSuperAdmin(initPassword string) error {
	var count int64
	database.DB.Model(&model.AdminUser{}).Count(&count)
	if count > 0 {
		return nil
	}

	pwd := initPassword
	generated := false
	if pwd == "" {
		pwd = randomPassword(16)
		generated = true
	}

	hashed, err := s.hashPassword(pwd)
	if err != nil {
		return err
	}

	admin := &model.AdminUser{
		Username: "admin",
		Password: hashed,
		Nickname: "超级管理员",
		Role:     model.AdminRoleSuperAdmin,
		IsActive: true,
	}

	if err := database.DB.Create(admin).Error; err != nil {
		return err
	}

	if generated {
		log.Printf("首次启动自动生成超级管理员临时密码: admin / %s ，请登录后立即修改", pwd)
	}
	return nil
}

func (s *AdminAuthService) RecordOperationLog(adminID uint, adminName, action, targetType string, targetID uint, detail, ip, userAgent string) {
	opLog := &model.AdminOperationLog{
		AdminID:    adminID,
		AdminName:  adminName,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Detail:     detail,
		IP:         ip,
		UserAgent:  userAgent,
	}
	if err := database.DB.Create(opLog).Error; err != nil {
		log.Printf("写入操作日志失败: %v", err)
	}
}

type OperationLogQuery struct {
	AdminID  uint
	Action   string
	DateFrom string
	DateTo   string
}

func (s *AdminAuthService) ListOperationLogs(pag util.Pagination, q OperationLogQuery) ([]model.AdminOperationLog, int64, error) {
	db := database.DB.Model(&model.AdminOperationLog{})
	if q.AdminID > 0 {
		db = db.Where("admin_id = ?", q.AdminID)
	}
	if q.Action != "" {
		db = db.Where("action = ?", q.Action)
	}
	if q.DateFrom != "" {
		db = db.Where("DATE(created_at) >= ?", q.DateFrom)
	}
	if q.DateTo != "" {
		db = db.Where("DATE(created_at) <= ?", q.DateTo)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []model.AdminOperationLog
	err := db.Order("created_at DESC").
		Offset(pag.Offset()).
		Limit(pag.Limit()).
		Find(&logs).Error
	return logs, total, err
}
