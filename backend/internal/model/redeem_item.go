package model

import "time"

// RedeemItem 兑换商品
// category: 0=物质奖励 1=体验特权 2=其他
// stock: 库存；-1 表示无限库存
type RedeemItem struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	FamilyID    uint      `gorm:"index;not null" json:"family_id"`
	Name        string    `gorm:"size:200;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	Points      int       `gorm:"not null" json:"points"`
	Image       string    `gorm:"size:500" json:"image,omitempty"`
	Category    int       `gorm:"not null;default:0" json:"category"`
	Stock       int       `gorm:"not null;default:-1" json:"stock"` // -1 表示无限
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

const (
	RedeemItemCategoryMaterial = 0 // 物质奖励
	RedeemItemCategoryExperience = 1 // 体验特权
	RedeemItemCategoryOther = 2    // 其他
	RedeemItemStockUnlimited = -1
)
