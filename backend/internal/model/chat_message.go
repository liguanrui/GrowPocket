package model

import "time"

// ChatMessage 对话消息
type ChatMessage struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	SessionID uint   `gorm:"index;not null" json:"session_id"`
	Role      string `gorm:"size:20;not null" json:"role"` // user/assistant
	Content   string `gorm:"type:text;not null" json:"content"`
	Intent    string `gorm:"size:30" json:"intent,omitempty"` // 识别出的意图
	// ToolCalls 存 LLM 返回的 tool 调用请求 JSON（Function Calling 协议字段）
	ToolCalls string `gorm:"type:text" json:"tool_calls"`
	// ToolCallID 关联 tool 执行结果消息，对应 OpenAI 协议中的 tool_call_id
	ToolCallID string `gorm:"size:100" json:"tool_call_id"`
	// SuggestedActions 存建议动作 JSON，供前端渲染确认卡片
	SuggestedActions string    `gorm:"type:text" json:"suggested_actions"`
	CreatedAt        time.Time `json:"created_at"`
}
