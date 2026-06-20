package model

import "time"

// Redeem 兑换记录
// 简化版：点击兑换立即扣除积分 + 扣减商品库存，无审核环节
type Redeem struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ChildID   uint      `gorm:"index;not null" json:"child_id"`
	ChildName string    `gorm:"size:50;not null" json:"child_name"`
	ItemID    uint      `gorm:"not null" json:"item_id"`
	ItemName  string    `gorm:"size:200;not null" json:"item_name"`
	ItemImage string    `gorm:"size:500" json:"item_image,omitempty"`
	Points    int       `gorm:"not null" json:"points"`
	CreatedAt time.Time `json:"created_at"`
}
