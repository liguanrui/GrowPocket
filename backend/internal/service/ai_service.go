package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

type AIService struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
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
