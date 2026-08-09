package service

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"growpocket/internal/model"
)

type AIService struct {
	apiKey  string
	model   string
	baseURL string
	// 识图多模态（可与文本模型分离）
	visionAPIKey  string
	visionModel   string
	visionBaseURL string
	client        *http.Client
	visionClient  *http.Client
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
		apiKey:       apiKey,
		model:        model,
		baseURL:      baseURL,
		client:       &http.Client{Timeout: 60 * time.Second},
		visionClient: &http.Client{Timeout: 90 * time.Second},
	}
}

// SetVisionConfig 配置识图多模态端点（OpenAI 兼容 image_url）。未配置时 CaptionImage 会失败并由上层降级。
func (s *AIService) SetVisionConfig(apiKey, model, baseURL string) {
	if s == nil {
		return
	}
	s.visionAPIKey = apiKey
	s.visionModel = model
	s.visionBaseURL = baseURL
}

func (s *AIService) visionCreds() (apiKey, model, baseURL string) {
	apiKey = s.visionAPIKey
	if apiKey == "" {
		apiKey = s.apiKey
	}
	model = s.visionModel
	if model == "" {
		model = s.model
	}
	baseURL = s.visionBaseURL
	if baseURL == "" {
		baseURL = s.baseURL
	}
	return apiKey, model, strings.TrimRight(baseURL, "/")
}

func isTextOnlyModel(model string) bool {
	m := strings.ToLower(strings.TrimSpace(model))
	if m == "" {
		return true
	}
	return strings.Contains(m, "deepseek-chat") ||
		strings.Contains(m, "deepseek-reasoner") ||
		m == "deepseek-v4-flash" ||
		m == "deepseek-v4-pro"
}

// CaptionImage 识图写短旁白：把本地图片以 data URL 发给多模态模型。
// DeepSeek 文本模型不支持 image_url，需配置 VISION_MODEL（如 qwen-vl-plus / glm-4v-flash / gpt-4o-mini）。
func (s *AIService) CaptionImage(imagePath, mimeType, userHint string) (string, error) {
	if s == nil {
		return "", errors.New("AI 服务未初始化")
	}
	apiKey, model, baseURL := s.visionCreds()
	if apiKey == "" {
		return "", errors.New("未配置识图 API Key")
	}
	// 文本-only 模型（如 deepseek-chat）跳过识图，避免无意义 400
	if isTextOnlyModel(model) {
		return "", errors.New("当前模型不支持识图，请配置 VISION_MODEL（如 qwen-vl-plus / glm-4v-flash）")
	}
	data, err := os.ReadFile(imagePath)
	if err != nil {
		return "", err
	}
	if mimeType == "" {
		mimeType = "image/jpeg"
		lower := strings.ToLower(imagePath)
		if strings.HasSuffix(lower, ".png") {
			mimeType = "image/png"
		} else if strings.HasSuffix(lower, ".webp") {
			mimeType = "image/webp"
		}
	}
	// 限制体积，避免超大图撑爆请求
	if len(data) > 4*1024*1024 {
		return "", errors.New("图片过大，无法识图")
	}
	dataURL := "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data)
	prompt := "请仔细看这张照片里的画面（人物、动作、环境、情绪）。用一句中文旁白描述可见内容，12～24字，口语温暖，只写画面里有的东西，不要编造任务名或积分。只返回这一句，不要引号、不要解释。"
	if strings.TrimSpace(userHint) != "" {
		prompt += "补充提示（可忽略若不匹配画面）：" + truncateRunes(userHint, 40)
	}

	messages := []map[string]interface{}{
		{
			"role": "user",
			"content": []map[string]interface{}{
				{"type": "text", "text": prompt},
				{"type": "image_url", "image_url": map[string]string{"url": dataURL}},
			},
		},
	}
	reqBody := map[string]interface{}{
		"model":       model,
		"messages":    messages,
		"max_tokens":  80,
		"temperature": 0.4,
	}
	bodyBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.visionClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", errors.New("识图请求失败: " + resp.Status + " " + string(raw))
	}
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 {
		return "", errors.New("识图返回空结果")
	}
	caption := strings.TrimSpace(result.Choices[0].Message.Content)
	caption = strings.Trim(caption, "\"“”'")
	caption = strings.ReplaceAll(caption, "\n", "")
	return truncateRunes(caption, 28), nil
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
