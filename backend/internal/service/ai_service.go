package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"

	"growpocket/internal/model"
)

type AIService struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
}

// ToolDefinition OpenAI 兼容的工具定义
type ToolDefinition struct {
	Type     string          `json:"type"` // 固定 "function"
	Function ToolFunctionDef `json:"function"`
}

// ToolFunctionDef 工具函数定义
type ToolFunctionDef struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"` // JSON Schema
}

// ToolCall LLM 返回的工具调用请求
type ToolCall struct {
	ID       string           `json:"id"`
	Type     string           `json:"type"` // "function"
	Function ToolCallFunction `json:"function"`
}

// ToolCallFunction 工具调用函数信息
type ToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON 字符串
}

// toolChatMessage 支持 function calling 协议的请求消息
type toolChatMessage struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`                // 不用 omitempty：DeepSeek 要求 content 字段必须存在，assistant 携带 tool_calls 时 content 为空串
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`   // assistant 消息携带的工具调用请求
	ToolCallID string     `json:"tool_call_id,omitempty"` // role=tool 消息携带的关联 ID
}

// chatCompletionResponse OpenAI 兼容的对话响应
type chatCompletionResponse struct {
	Choices []chatChoice `json:"choices"`
}

// chatChoice 单个候选结果
type chatChoice struct {
	FinishReason string              `json:"finish_reason"`
	Message      chatResponseMessage `json:"message"`
}

// chatResponseMessage 响应消息体，同时支持普通回复与工具调用
type chatResponseMessage struct {
	Content   string     `json:"content"`
	ToolCalls []ToolCall `json:"tool_calls"`
}

func NewAIService(apiKey, model, baseURL string) *AIService {
	return &AIService{
		apiKey:  apiKey,
		model:   model,
		baseURL: baseURL,
		client:  &http.Client{Timeout: 60 * time.Second},
	}
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Chat 调用 LLM 对话接口
// systemPrompt: 系统提示词（含上下文）
// history: 历史消息
// userMessage: 用户当前消息
// 返回：LLM 回复文本
func (s *AIService) Chat(systemPrompt string, history []chatMessage, userMessage string) (string, error) {
	if s.apiKey == "" {
		// 无 API Key 时返回降级回复
		return "AI 助理暂未配置，请联系管理员设置 AI_API_KEY。", nil
	}

	messages := []chatMessage{{Role: "system", Content: systemPrompt}}
	messages = append(messages, history...)
	messages = append(messages, chatMessage{Role: "user", Content: userMessage})

	reqBody := map[string]interface{}{
		"model":    s.model,
		"messages": messages,
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req, err := http.NewRequest("POST", s.baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", errors.New("AI 请求失败: " + resp.Status + " " + string(body))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 {
		return "", errors.New("AI 返回空结果")
	}
	return result.Choices[0].Message.Content, nil
}

// ChatWithTools 支持 function calling 的对话，返回回复文本与本轮请求的工具调用
// systemPrompt: 系统提示词（含上下文）
// history: 历史消息（可包含 assistant 携带的 tool_calls 与 role=tool 的执行结果）
// userMessage: 用户当前消息
// tools: 可用工具定义列表
// 返回三元组：
//   - reply: LLM 回复文本（finish_reason=stop 时有内容，=tool_calls 时可能为空）
//   - toolCalls: 本轮 LLM 请求执行的工具调用（finish_reason=tool_calls 时非空，=stop 时为空）
//   - err: 调用错误
//
// 调用方应在 toolCalls 非空时执行工具，将结果以 role=tool 消息追加进 history 后再次调用本方法循环，
// 直到 finish_reason=stop 拿到最终 reply。
func (s *AIService) ChatWithTools(systemPrompt string, history []model.ChatMessage, userMessage string, tools []ToolDefinition) (reply string, toolCalls []ToolCall, err error) {
	if s.apiKey == "" {
		// 无 API Key 时返回降级回复
		return "AI 助理暂未配置，请联系管理员设置 AI_API_KEY。", nil, nil
	}

	// 组装 messages：system + history + user，复用与 Chat 一致的结构
	messages := make([]toolChatMessage, 0, len(history)+2)
	messages = append(messages, toolChatMessage{Role: "system", Content: systemPrompt})
	for _, h := range history {
		msg := toolChatMessage{
			Role:    h.Role,
			Content: h.Content,
		}
		// assistant 消息可能携带上一轮的工具调用请求，需原样回传给 LLM
		if h.ToolCalls != "" {
			var tcs []ToolCall
			if json.Unmarshal([]byte(h.ToolCalls), &tcs) == nil && len(tcs) > 0 {
				msg.ToolCalls = tcs
			}
		}
		// role=tool 消息需携带 tool_call_id 关联到对应的工具调用
		if h.ToolCallID != "" {
			msg.ToolCallID = h.ToolCallID
		}
		messages = append(messages, msg)
	}
	messages = append(messages, toolChatMessage{Role: "user", Content: userMessage})

	reqBody := map[string]interface{}{
		"model":    s.model,
		"messages": messages,
	}
	// 仅在提供工具时携带 tools 字段，避免空数组影响部分兼容实现
	if len(tools) > 0 {
		reqBody["tools"] = tools
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req, err := http.NewRequest("POST", s.baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		log.Printf("[AI] HTTP 请求失败 model=%s msgs=%d tools=%d payload=%d err=%v",
			s.model, len(messages), len(tools), len(bodyBytes), err)
		return "", nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[AI] 非 200 响应 status=%s model=%s msgs=%d tools=%d payload=%d body=%s",
			resp.Status, s.model, len(messages), len(tools), len(bodyBytes), string(body))
		return "", nil, errors.New("AI 请求失败: " + resp.Status + " " + string(body))
	}

	// 解析响应：同时支持普通回复(content)与工具调用(tool_calls)
	// finish_reason=tool_calls 时 toolCalls 非空、reply 可能为空，调用方执行后循环
	// finish_reason=stop 时 toolCalls 为空、reply 为最终回复
	rawResp, _ := io.ReadAll(resp.Body)
	var result chatCompletionResponse
	if err := json.Unmarshal(rawResp, &result); err != nil {
		log.Printf("[AI] 响应解析失败 model=%s msgs=%d tools=%d err=%v raw=%s",
			s.model, len(messages), len(tools), err, string(rawResp))
		return "", nil, err
	}
	if len(result.Choices) == 0 {
		log.Printf("[AI] 返回空 choices model=%s msgs=%d tools=%d raw=%s",
			s.model, len(messages), len(tools), string(rawResp))
		return "", nil, errors.New("AI 返回空结果")
	}
	choice := result.Choices[0]
	return choice.Message.Content, choice.Message.ToolCalls, nil
}
