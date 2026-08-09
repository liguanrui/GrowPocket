package model

import "time"

// Family 家庭表：每个家长注册时自动创建一个家庭，一个家庭可以包含多个家长和多个孩子
type Family struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	ShareCode string    `gorm:"size:8;uniqueIndex" json:"share_code"` // 家庭分享码，供其他家长注册时加入
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Users []User `gorm:"foreignKey:FamilyID" json:"-"`
}
