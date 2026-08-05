package service

import (
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"time"
)

// AnalyticsService 埋点采集服务（V1.3 Task 11）
// 简化实现：基于 log.Printf 输出结构化日志（一行 JSON），不落库
// 格式: [Analytics] event=<event_name> ts=<RFC3339> <field1>=<v1> <field2>=<v2> ...
type AnalyticsService struct{}

// NewAnalyticsService 构造函数
func NewAnalyticsService() *AnalyticsService {
	return &AnalyticsService{}
}

// Event 发送一个埋点事件
// 字段顺序：先 event/ts，然后按 fields map 的 key 字典序输出（保证稳定可读）
func (s *AnalyticsService) Event(event string, fields map[string]interface{}) {
	if s == nil {
		return
	}
	ts := time.Now().UTC().Format(time.RFC3339)
	line := "[Analytics] event=" + event + " ts=" + ts

	// 对 keys 排序以保证输出稳定可读
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		jsonVal, err := json.Marshal(fields[k])
		if err != nil {
			// 回退到字符串形式
			jsonVal = []byte(fmt.Sprintf("%v", fields[k]))
		}
		line += " " + k + "=" + string(jsonVal)
	}
	log.Println(line)
}
