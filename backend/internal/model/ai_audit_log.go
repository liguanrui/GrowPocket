package model

import "time"

// AIAuditLog AI 助理写操作审计日志
// 用于记录 AI 助理通过 Function Calling 执行的所有写操作（如发任务、记账等），
// 便于后续审计、回溯与异常排查。
type AIAuditLog struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	FamilyID     uint      `gorm:"index;not null" json:"family_id"`   // 家庭 ID
	ChildID      uint      `gorm:"index" json:"child_id"`             // 孩子 ID
	UserID       uint      `gorm:"not null" json:"user_id"`           // 执行人 ID
	SessionID    uint      `gorm:"index" json:"session_id"`           // 关联会话 ID
	MessageID    uint      `gorm:"index" json:"message_id"`           // 关联消息 ID
	ToolName     string    `gorm:"size:50;not null" json:"tool_name"` // 调用的 tool 名称
	Params       string    `gorm:"type:text" json:"params"`           // 调用参数 JSON
	Result       string    `gorm:"size:20" json:"result"`             // 执行结果：success/failed/cancelled/expired
	ErrorMessage string    `gorm:"type:text" json:"error_message"`    // 失败时的错误信息
	CreatedAt    time.Time `json:"created_at"`                        // 创建时间
}
