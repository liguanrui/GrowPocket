package model

import (
	"encoding/json"
	"strings"
	"time"
)

// SuggestedActionsField 存储为 text(JSON 字符串)，序列化时输出为数组
// 空字符串或非法 JSON 输出 []，避免前端 .map 崩溃
type SuggestedActionsField string

func (s SuggestedActionsField) MarshalJSON() ([]byte, error) {
	if strings.TrimSpace(string(s)) == "" {
		return []byte("[]"), nil
	}
	// 校验是否为合法 JSON 数组，合法则原样输出，非法则输出 []
	var arr []json.RawMessage
	if err := json.Unmarshal([]byte(s), &arr); err != nil {
		return []byte("[]"), nil
	}
	return []byte(s), nil
}

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
	SuggestedActions SuggestedActionsField `gorm:"type:text" json:"suggested_actions"`
	CreatedAt        time.Time             `json:"created_at"`
}
