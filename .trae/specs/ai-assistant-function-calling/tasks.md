# Tasks

> 范围:PRD v3.2 的 Phase 1(P0 只读工具)+ Phase 2(P1 写操作工具)。Phase 3(安全缺口修复)留作后续 spec。
> 推荐执行顺序:Task 1 → 2 → 3 → 4(可并行)→ 5 → 6 → 7 → 8 → 9 → 10

# Phase 1:P0 只读工具 + 架构改造

- [x] Task 1: 扩展数据模型与数据库迁移
  - [x] SubTask 1.1: 在 `backend/internal/model/chat_message.go` 新增 3 字段:ToolCalls(text/JSON) / ToolCallID(string) / SuggestedActions(text/JSON)
  - [x] SubTask 1.2: 新增模型文件 `backend/internal/model/ai_audit_log.go`(AIAuditLog:ID/FamilyID/ChildID/UserID/SessionID/MessageID/ToolName/Params/Result/ErrorMessage/CreatedAt,加 gorm 索引 tag)
  - [x] SubTask 1.3: 确认 AutoMigrate 注册 AIAuditLog(在 db 初始化处)
  - [x] SubTask 1.4: 编写并运行迁移,验证两张表的字段就绪(go build 通过)

- [x] Task 2: AIService 支持 function calling
  - [x] SubTask 2.1: 在 `backend/internal/service/ai_service.go` 定义 ToolDefinition 结构体(Name/Description/Parameters JSON schema)与 ToolCall 响应结构(ID/Function.Name/Function.Arguments)
  - [x] SubTask 2.2: 新增 `AIService.ChatWithTools(systemPrompt string, history []ChatMessage, userMessage string, tools []ToolDefinition) (reply string, toolCalls []ToolCall, err error)` 方法
  - [x] SubTask 2.3: 请求体新增 tools 字段;响应解析支持 finish_reason="tool_calls" 与 tool_calls 数组
  - [x] SubTask 2.4: 保留原 `Chat` 方法不动(向后兼容)
  - [x] SubTask 2.5: 单元测试:模拟 LLM 返回 tool_calls,验证解析正确(3 个测试通过)

- [x] Task 3: ChatService 工具注册表与分发器
  - [x] SubTask 3.1: 在 `backend/internal/service/chat_service.go` 新增 `toolRegistry map[string]ToolEntry`(ToolEntry 含 ToolDefinition + ExecuteFunc)
  - [x] SubTask 3.2: 新增 `executeToolCall(ctx, toolName, argsJSON, familyID, childID, userRole) (resultJSON string, err error)` 分发器
  - [x] SubTask 3.3: 新增 `getToolDefinitions() []ToolDefinition` 方法,从 registry 提取定义传给 LLM
  - [x] SubTask 3.4: 改造 `SendMessage`:调用 ChatWithTools,循环执行 tool_calls(上限 3 次),将结果以 tool role 追加后再次调 LLM,直到 finish_reason=stop 或达上限
  - [x] SubTask 3.5: 循环上限保护:超 3 次强制返回"请一次只问一个问题"
  - [x] SubTask 3.6: tool 返回结果 > 500 字截断 + 附"如需详情请追问"

- [x] Task 4: 精简 buildSystemPrompt + 降级 detectIntent(与 Task 3 合并执行)
  - [x] SubTask 4.1: 修改 `buildSystemPrompt`:移除孩子信息/六维分/最近5任务三类快照注入
  - [x] SubTask 4.2: 保留 IP 身份 + 对话者角色 + 角色权限说明;新增 child_id / family_id 注入
  - [x] SubTask 4.3: 验证精简后 system prompt < 200 tokens
  - [x] SubTask 4.4: 改造 `detectIntent`:新增 `intentFromToolName(toolName string) string` 函数,从 tool_name 反推 intent(如 query_child_balance→query_points)
  - [x] SubTask 4.5: SendMessage 中根据本轮是否调用 tool 及 tool_name 决定 intent(无 tool→chat);保留原 detectIntent 函数不删除

- [x] Task 5: 实现 13 个只读工具并注册
  - [x] SubTask 5.1: query_child_balance → ScoreService.GetBalance,返回 {balance, nickname}
  - [x] SubTask 5.2: query_child_scores → AbilityService.GetChildScores + GetGrowthIndex,返回 {dimensions[], growth_index}
  - [x] SubTask 5.3: list_tasks → TaskService.ListTasks,参数 status(pending/submitted/completed/rejected),默认 pending,page_size=10,返回 {tasks[], total}
  - [x] SubTask 5.4: get_task_detail → TaskService.GetTask,参数 task_id,返回任务详情
  - [x] SubTask 5.5: list_redeem_items → RedeemService.ListItems,参数 category 可选,返回 {items[], total}
  - [x] SubTask 5.6: list_redeem_records → RedeemService.GetRedeems,返回 {records[], total}
  - [x] SubTask 5.7: get_growth_timeline → GrowthService.Timeline,参数 days 默认 30,超 500 字截断
  - [x] SubTask 5.8: get_growth_album → GrowthService.Album,返回 {photos[], total}
  - [x] SubTask 5.9: get_current_cycle → GrowthCycleService.GetCurrentCycle,返回 {cycle, goals[]}
  - [x] SubTask 5.10: get_cycle_progress → GrowthCycleService.GetCycleProgress,参数 cycle_id,tool 实现层用 database.DB 校验 family_id 归属
  - [x] SubTask 5.11: list_growth_stories → GrowthStoryService.ListStories,page_size=5
  - [x] SubTask 5.12: list_master_challenges → MasterChallengeService.GetInstances
  - [x] SubTask 5.13: list_activities → ActivityService.ListActivities,tool 实现层过滤敏感字段(仅留 7 个公开字段)
  - [x] SubTask 5.14: 在 toolRegistry 注册全部 13 个工具(registerReadonlyTools)

- [ ] Task 6: Phase 1 集成验证
  - [ ] SubTask 6.1: 端到端测试"我有多少积分"→ query_child_balance → 回复含余额数字
  - [ ] SubTask 6.2: 端到端测试"今日任务"→ list_tasks(status=pending)→ 回复含待完成任务
  - [ ] SubTask 6.3: 端到端测试"最近有什么奖励"→ list_redeem_items → 回复含商品列表(解决 v3.1 query_reward 无数据问题)
  - [ ] SubTask 6.4: 端到端测试"成长报告"→ query_child_scores → 回复含成长指数+短板维度
  - [ ] SubTask 6.5: 验证 get_cycle_progress 拒绝跨 family 访问
  - [ ] SubTask 6.6: 验证 list_activities 不返回 organizer_id 等敏感字段

# Phase 2:P1 写操作工具 + UI 二次确认

- [x] Task 7: 后端写操作工具与接口
  - [x] SubTask 7.1: 定义 ActionSuggestion 结构体(action/params/summary/confirm_text/cancel_text/api_endpoint/api_method/api_body/requires_parent)
  - [x] SubTask 7.2: 改造 SendMessage:写工具走 ExecuteFunc 收集 suggested_actions,回送短结果给 LLM 生成文字
  - [x] SubTask 7.3: 修改 `POST /chat/message` 响应体,新增 suggested_actions 字段(空时为 [])
  - [x] SubTask 7.4: 在 toolRegistry 注册 5 个写工具(registerWriteTools,IsWrite=true,仅构造建议不执行写操作)
  - [x] SubTask 7.5: 新增 `POST /chat/message/confirm` handler,写入 AIAuditLog(不执行写操作)
  - [x] SubTask 7.6: 在 `backend/cmd/main.go` 注册 /chat/message/confirm 路由
  - [x] SubTask 7.7: ChatMessage 持久化 suggested_actions 字段

- [x] Task 8: 前端 ActionConfirmCard 组件
  - [x] SubTask 8.1: 新增 `frontend/src/components/ActionConfirmCard.tsx`,props: suggestion + onConfirm + onCancel + status
  - [x] SubTask 8.2: 实现四态机:pending/executing(spinner)/success(bg-success)/failed(bg-danger+重试)/cancelled
  - [x] SubTask 8.3: 样式:border-2 border-primary rounded-lg;取消按钮 bg-warm-light;确认按钮 bg-primary(映射项目语义 token)
  - [x] SubTask 8.4: 儿童权限降级:requires_parent=true 时 opacity-60,确认禁用,提示"需要请家长帮忙操作"
  - [x] SubTask 8.5: 24 小时有效期:useMemo 检查 created_at,超期置灰"已过期,请重新询问"

- [x] Task 9: 前端集成 ActionConfirmCard
  - [x] SubTask 9.1: chat.ts 新增 suggested_actions? 字段 + confirmAction(messageId, action, params, result, apiResponse) 调 POST /chat/message/confirm
  - [x] SubTask 9.2: AssistantPage AI 消息含 suggested_actions 时在气泡下方渲染 ActionConfirmCard
  - [x] SubTask 9.3: 确认按钮:executing → 调 api_endpoint(JWT)→ success + childStore.fetchChildren() 刷新 + confirmAction + toast + 追加本地 AI 消息
  - [x] SubTask 9.4: 取消按钮:cancelled + confirmAction(..., "cancelled") + 追加本地 AI 消息"已取消"
  - [x] SubTask 9.5: 失败:failed + errorMessage + 重试按钮(复用 handleConfirmAction)

- [ ] Task 10: Phase 2 集成验证
  - [ ] SubTask 10.1: 端到端测试"我完成了洗碗"→ AI 返回 submit_task suggested_action → 卡片渲染 → 确认后任务状态变 submitted
  - [ ] SubTask 10.2: 端到端测试"兑换小风扇"→ redeem_item suggested_action → 确认后余额扣减
  - [ ] SubTask 10.3: 儿童账号测试"设置目标为80"→ set_stage_goal suggested_action → 卡片置灰 + 提示需要家长
  - [ ] SubTask 10.4: 家长账号测试"奖励小明10积分"→ adjust_score suggested_action → 确认后余额增加
  - [ ] SubTask 10.5: 验证 AIAuditLog 表记录全部写操作(tool_name/params/executor/result)
  - [ ] SubTask 10.6: 验证卡片取消后不再可交互
  - [ ] SubTask 10.7: 验证卡片 24h 过期后置灰不可确认

# Task Dependencies
- [Task 2] 依赖 [Task 1](模型先就绪)
- [Task 3] 依赖 [Task 2](ChatService 调用 ChatWithTools)
- [Task 4] 可与 [Task 3] 并行(独立修改 buildSystemPrompt 与 detectIntent)
- [Task 5] 依赖 [Task 3](工具注册到 toolRegistry)
- [Task 6] 依赖 [Task 5]
- [Task 7] 依赖 [Task 6](Phase 1 验证通过)
- [Task 8] 可与 [Task 7] 并行(纯前端组件,不依赖后端接口)
- [Task 9] 依赖 [Task 7] + [Task 8]
- [Task 10] 依赖 [Task 9]

# 验证修复任务(Task 6 + Task 10 系统性验证发现)

> 来源:Task 6 + Task 10 代码审查发现。5 个写工具的 `api_endpoint` / `api_method` 与 `backend/cmd/main.go` 实际注册的 REST 路由不一致,前端确认卡片调 API 会 404/405。必须在 Phase 2 端到端验证前修复。

- [x] Fix Task A: 修正 5 个写工具的 api_endpoint / api_method 与实际路由对齐
  - [x] Fix A.1: `submit_task` `APIMethod` 改为 `PUT`(PUT /tasks/:id/submit)
  - [x] Fix A.2: `redeem_item` `APIEndpoint` 改 `/redeems`,`APIBody` 含 {item_id, child_id}
  - [x] Fix A.3: `set_stage_goal` `APIEndpoint` 改 `fmt.Sprintf("/growth-cycles/%d/goals", cycleID)`,`APIBody` 含 {child_id, dimension_id, target_score}
  - [x] Fix A.4: `create_cycle` `APIEndpoint` 改 `/growth-cycles`,`APIBody` 含 {child_id, name, start_date, end_date},日期转 RFC3339
  - [x] Fix A.5: `adjust_score` 按 delta 正负分流 `/score/add` 或 `/score/deduct`,`APIBody` 含 {child_id, points(abs), title, description}
  - [x] Fix A.6: 修复后重跑 `go build ./...` + `go vet ./internal/...` + `go test` 全部通过(exit 0)
  - [ ] Fix A.7: 端到端确认 4 张写卡片确认按钮能调通 REST API(需用户手动验证:依赖真实 LLM)

> 说明:set_stage_goal / create_cycle / adjust_score 的 `requires_parent=true` 标记正确,儿童降级与 24h 过期逻辑无误;问题仅在 `api_endpoint` / `api_method` 与实际路由的对齐。前端 `ActionConfirmCard` + `AssistantPage.handleConfirmAction` 用 `suggestion.api_method` + `suggestion.api_endpoint` + `suggestion.api_body` 发请求,因此修好后端工具字段即可,无需改前端。
