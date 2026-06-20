package model

import "time"

// Transaction 积分变动明细
// type: 0=收入（任务完成 / 手动加积分 / 兑换审核拒绝返回积分）, 1=支出（兑换 / 手动减积分）
// related_id / related_type: 关联的任务 / 兑换记录 等
type Transaction struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChildID     uint      `gorm:"index;not null" json:"child_id"`
	Type        int       `gorm:"not null" json:"type"` // 0 收入 / 1 支出
	Amount      int       `gorm:"not null" json:"amount"`
	Reason      string    `gorm:"size:500;not null" json:"reason"`
	RelatedID   *uint     `json:"related_id,omitempty"`
	RelatedType *string   `gorm:"size:50" json:"related_type,omitempty"`
	BalanceAfter int      `gorm:"not null" json:"balance_after"`
	CreatedAt   time.Time `json:"created_at"`
}

const (
	TransactionTypeIncome  = 0
	TransactionTypeExpense = 1
)
