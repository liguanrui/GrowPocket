package model

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

// Transaction 积分变动明细
// type: 0=收入（任务完成 / 手动加积分 / 兑换审核拒绝返回积分）, 1=支出（兑换 / 手动减积分）
// related_id / related_type: 关联的任务 / 兑换记录 等
type Transaction struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ChildID      uint      `gorm:"index;not null" json:"child_id"`
	Type         int       `gorm:"not null" json:"type"` // 0 收入 / 1 支出
	Amount       int       `gorm:"not null" json:"amount"`
	Reason       string    `gorm:"size:500;not null" json:"reason"`
	RelatedID    *uint     `json:"related_id,omitempty"`
	RelatedType  *string   `gorm:"size:50" json:"related_type,omitempty"`
	BalanceAfter int       `gorm:"not null" json:"balance_after"`
	CreatedAt    time.Time `json:"created_at"`
}

const (
	TransactionTypeIncome  = 0
	TransactionTypeExpense = 1
)

// RelatedTypeAllowlist 积分来源白名单（PRD 第 5 章：防止 Onboarding / welcome 等非任务来源误加积分）
var RelatedTypeAllowlist = map[string]struct{}{
	"task":           {}, // 任务完成、任务创建即完成、手工 Adjust（沿用 task 语义）
	"redeem":         {}, // 兑换扣除（支出）
	"master_project": {}, // 大师挑战验收通过的稀有积分奖励（模块 B）
	"academic":       {}, // V3.1 模块 D：学业奖励池里程碑发放（学业白名单，受月度次数与单次上限守卫）
}

// forbiddenReasonKeywords 明确禁止发放积分的动作关键词（匹配 Reason 字段）
var forbiddenReasonKeywords = []string{
	"onboarding",
	"新手指引",
	"新手奖励",
	"welcome",
	"欢迎",
	"注册奖励",
	"问卷奖励",
	"目标设置奖励",
	"任务生成奖励",
	// V3.1 模块 D：禁止以"考试满分"为名义直接发放积分（应走学业趋势档位记录，不发分）
	"考试满分奖励",
	"期末满分奖励",
}

// BeforeCreate GORM hook：写入积分流水前做白名单 & 禁止词校验，确保 Onboarding 流程不会误发积分
func (t *Transaction) BeforeCreate(tx *gorm.DB) error {
	// 1) RelatedType 必须在白名单内（防止"onboarding_bonus""welcome"等新来源加积分）
	if t.RelatedType == nil || *t.RelatedType == "" {
		return errors.New("积分流水缺少 RelatedType，必须使用白名单来源")
	}
	if _, ok := RelatedTypeAllowlist[*t.RelatedType]; !ok {
		return errors.New("积分来源 RelatedType=" + *t.RelatedType + " 不在白名单内，已拦截")
	}
	// 2) Reason 中不得出现"onboarding/欢迎/问卷/目标设置"等禁止发放积分的关键词
	r := strings.ToLower(t.Reason)
	for _, kw := range forbiddenReasonKeywords {
		if strings.Contains(r, strings.ToLower(kw)) {
			return errors.New("积分流水 Reason 含禁止关键词 [" + kw + "]：该动作不得发放积分")
		}
	}
	// 3) Amount 必须为正数
	if t.Amount <= 0 {
		return errors.New("积分流水 Amount 必须大于 0")
	}
	return nil
}
