package service

import (
	"encoding/json"
	"testing"
)

// TestToolCall_ParseToolCallsResponse 构造一个含 tool_calls 的假响应 JSON，
// 验证解析出正确的 name/arguments，覆盖 finish_reason=tool_calls 的分支。
func TestToolCall_ParseToolCallsResponse(t *testing.T) {
	raw := `{
		"choices": [
			{
				"finish_reason": "tool_calls",
				"message": {
					"content": null,
					"tool_calls": [
						{
							"id": "call_abc123",
							"type": "function",
							"function": {
								"name": "create_task",
								"arguments": "{\"title\":\"写作业\",\"points\":10}"
							}
						}
					]
				}
			}
		]
	}`

	var resp chatCompletionResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if len(resp.Choices) != 1 {
		t.Fatalf("Choices 数量 got %d want 1", len(resp.Choices))
	}

	choice := resp.Choices[0]
	if choice.FinishReason != "tool_calls" {
		t.Errorf("FinishReason got %q want tool_calls", choice.FinishReason)
	}
	if len(choice.Message.ToolCalls) != 1 {
		t.Fatalf("ToolCalls 数量 got %d want 1", len(choice.Message.ToolCalls))
	}

	tc := choice.Message.ToolCalls[0]
	if tc.ID != "call_abc123" {
		t.Errorf("ID got %q want call_abc123", tc.ID)
	}
	if tc.Type != "function" {
		t.Errorf("Type got %q want function", tc.Type)
	}
	if tc.Function.Name != "create_task" {
		t.Errorf("Function.Name got %q want create_task", tc.Function.Name)
	}

	wantArgs := `{"title":"写作业","points":10}`
	if tc.Function.Arguments != wantArgs {
		t.Errorf("Function.Arguments got %q want %q", tc.Function.Arguments, wantArgs)
	}

	// arguments 是 JSON 字符串，应可二次解析拿到具体参数
	var args map[string]any
	if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
		t.Fatalf("Arguments 二次解析失败: %v", err)
	}
	if title, _ := args["title"].(string); title != "写作业" {
		t.Errorf("args.title got %v want 写作业", args["title"])
	}
	// JSON 数字默认解析为 float64
	if points, _ := args["points"].(float64); points != 10 {
		t.Errorf("args.points got %v want 10", args["points"])
	}
}

// TestToolCall_ParseStopResponse 验证 finish_reason=stop 时 tool_calls 为空、content 有内容。
func TestToolCall_ParseStopResponse(t *testing.T) {
	raw := `{
		"choices": [
			{
				"finish_reason": "stop",
				"message": {
					"content": "好的，我来帮你创建任务。"
				}
			}
		]
	}`

	var resp chatCompletionResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if len(resp.Choices) != 1 {
		t.Fatalf("Choices 数量 got %d want 1", len(resp.Choices))
	}

	choice := resp.Choices[0]
	if choice.FinishReason != "stop" {
		t.Errorf("FinishReason got %q want stop", choice.FinishReason)
	}
	if choice.Message.Content != "好的，我来帮你创建任务。" {
		t.Errorf("Content got %q want 好的，我来帮你创建任务。", choice.Message.Content)
	}
	if len(choice.Message.ToolCalls) != 0 {
		t.Errorf("ToolCalls 数量 got %d want 0", len(choice.Message.ToolCalls))
	}
}

// TestToolDefinition_Serialize 验证工具定义能正确序列化为 OpenAI 兼容的请求字段。
func TestToolDefinition_Serialize(t *testing.T) {
	tool := ToolDefinition{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        "create_task",
			Description: "为孩子创建一个新任务",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"title":  map[string]any{"type": "string"},
					"points": map[string]any{"type": "integer"},
				},
				"required": []string{"title", "points"},
			},
		},
	}

	bs, err := json.Marshal(tool)
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(bs, &got); err != nil {
		t.Fatalf("反序列化失败: %v", err)
	}
	if got["type"] != "function" {
		t.Errorf("type got %v want function", got["type"])
	}
	fn, _ := got["function"].(map[string]any)
	if fn == nil {
		t.Fatal("function 字段缺失")
	}
	if fn["name"] != "create_task" {
		t.Errorf("function.name got %v want create_task", fn["name"])
	}
	if fn["description"] != "为孩子创建一个新任务" {
		t.Errorf("function.description got %v want 为孩子创建一个新任务", fn["description"])
	}
	params, _ := fn["parameters"].(map[string]any)
	if params == nil {
		t.Fatal("function.parameters 字段缺失")
	}
	if params["type"] != "object" {
		t.Errorf("parameters.type got %v want object", params["type"])
	}
}
