package model

import "time"

const (
	AdminRoleSuperAdmin = "super_admin"
	AdminRoleAdmin      = "admin"
	AdminRoleViewer     = "viewer"
)

type AdminUser struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Username    string     `gorm:"size:50;not null;uniqueIndex" json:"username"`
	Password    string     `gorm:"size:255" json:"-"`
	Nickname    string     `gorm:"size:50" json:"nickname"`
	Role        string     `gorm:"size:20;default:'admin';index" json:"role"`
	IsActive    bool       `gorm:"default:true" json:"is_active"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	LastLoginIP string     `gorm:"size:50" json:"last_login_ip,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type AdminOperationLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	AdminID    uint      `gorm:"index" json:"admin_id"`
	AdminName  string    `gorm:"size:50" json:"admin_name"`
	Action     string    `gorm:"size:100;index" json:"action"`
	TargetType string    `gorm:"size:50;default:''" json:"target_type"`
	TargetID   uint      `gorm:"default:0" json:"target_id"`
	Detail     string    `gorm:"type:text;default:''" json:"detail"`
	IP         string    `gorm:"size:50;default:''" json:"ip"`
	UserAgent  string    `gorm:"size:500;default:''" json:"user_agent"`
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
}
