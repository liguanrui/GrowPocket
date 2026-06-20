package model

import "time"

// User 用户表（家长账号 + 孩子档案统一在一张表里，通过 role 区分）
// - role = 'parent'：家长（可以登录，有密码）
// - role = 'child'：孩子档案（暂不登录，无密码，balance 字段有效）
type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	FamilyID  uint      `gorm:"index;not null" json:"family_id"`
	Role      string    `gorm:"size:20;not null;index" json:"role"` // parent / child
	Nickname  string    `gorm:"size:50;not null" json:"nickname"`
	Password  string    `gorm:"size:255" json:"-"` // 仅家长填写；孩子的 password 为空
	Avatar    string    `gorm:"size:500" json:"avatar,omitempty"`
	// 以下字段仅 role=child 时填写
	Gender   *int       `json:"gender,omitempty"` // 0=男 1=女
	Birthday *time.Time `json:"birthday,omitempty"`
	Balance  int        `gorm:"default:0" json:"balance"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Family *Family `gorm:"foreignKey:FamilyID" json:"-"`
}
