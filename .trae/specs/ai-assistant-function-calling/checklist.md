# Checklist

> 用于 Phase 1 + Phase 2 实施完成后的系统性验证。逐条检查,通过的打勾;未通过的回 tasks.md 新增修复任务。

## 架构层

- [x] `AIService.ChatWithTools` 方法存在,支持 tools 参数与 tool_calls 循环
- [x] tool_calls 循环上限为 3 次,超出强制返回"请一次只问一个问题"
- [x] 原 `AIService.Chat` 方法保留未删除(向后兼容)
- [x] `ChatService.toolRegistry` 存在,集中管理工具定义与执行函数
- [x] `ChatService.executeToolCall` 分发器能根据 tool_name 路由到对应 ExecuteFunc
- [x] `buildSystemPrompt` 已移除 3 类数据快照(孩子信息/六维分/最近5任务)
- [x] `buildSystemPrompt` 保留 IP 身份 + 对话者角色 + 角色权限 + child_id/family_id
- [x] 精简后 system prompt < 200 tokens
- [x] `detectIntent` 函数保留未删除
- [x] 新增 `intentFromToolName` 函数,从 tool_name 反推 intent
- [x] tool 返回结果 > 500 字时截断并附"如需详情请追问"

## 数据模型与接口

- [x] ChatMessage 模型新增 ToolCalls / ToolCallID / SuggestedActions 三字段
- [x] AIAuditLog 模型存在,含 FamilyID/ChildID/UserID/SessionID/MessageID/ToolName/Params/Result/ErrorMessage/CreatedAt
- [x] AIAuditLog 已在 AutoMigrate 注册
- [x] `POST /chat/message` 响应体新增可选 suggested_actions 字段
- [x] `POST /chat/message/confirm` 接口存在,仅记录审计不执行写操作
- [x] `/chat/message/confirm` 路由已在 main.go 注册

## 只读工具(P0,13 个)

- [x] query_child_balance 包装 ScoreService.GetBalance,返回 {balance, nickname}
- [x] query_child_scores 包装 GetChildScores + GetGrowthIndex,返回 {dimensions[], growth_index}
- [x] list_tasks 支持 status 参数,默认 pending,page_size=10
- [x] get_task_detail 需 task_id 参数,返回任务详情
- [x] list_redeem_items 返回 {items[], total}
- [x] list_redeem_records 返回兑换记录
- [x] get_growth_timeline 默认 30 天,超 500 字截断
- [x] get_growth_album 返回成长相册
- [x] get_current_cycle 返回 {cycle, goals[]}
- [x] get_cycle_progress tool 实现层补 familyID 校验(拒绝跨 family)
- [x] list_growth_stories 默认 page_size=5
- [x] list_master_challenges 返回大师挑战实例
- [x] list_activities tool 实现层过滤敏感字段(organizer_id 等)
- [x] 13 个工具全部在 toolRegistry 注册

## 写操作工具(P1,5 个)

- [x] submit_task 生成 suggested_action,api_endpoint=/tasks/:id/submit
- [x] redeem_item 生成 suggested_action,卡片正文含余额提示
- [x] set_stage_goal 标记 requires_parent=true
- [x] create_cycle 标记 requires_parent=true
- [x] adjust_score 标记 requires_parent=true
- [x] 5 个写工具的 ExecuteFunc 仅生成 suggested_action,不直接执行写操作

> ⚠️ 已发现并记录到 tasks.md 的修复任务:5 个写工具的 `api_endpoint` / `api_method` 与 main.go 实际注册的 REST 路由不一致(method 或路径错位),需在 Phase 2 端到端验证前修复,否则前端确认卡片调 API 会 404/405。详见 tasks.md 末尾"验证修复任务"。

## 前端 ActionConfirmCard

- [x] `frontend/src/components/ActionConfirmCard.tsx` 存在
- [x] 四态机实现:pending / executing(spinner+禁用)/ success(绿底✓)/ failed(红底✗+重试)
- [x] 样式:白底 + 橙色 2px 边框 + 圆角;取消按钮 muted;确认按钮 primary
- [x] 卡片位于 AI 气泡下方(独立卡片,非气泡内)
- [x] requires_parent=true 时卡片 opacity-60,确认按钮禁用,底部提示"需要请家长帮忙操作"
- [x] 24 小时有效期检查:超期显示"已过期,请重新询问",不可确认

## 前端集成

- [x] `services/chat.ts` SendMessageResponse 类型含 suggested_actions 可选字段
- [x] `services/chat.ts` 新增 confirmAction 调用 POST /chat/message/confirm
- [x] `AssistantPage.tsx` AI 消息含 suggested_actions 时渲染 ActionConfirmCard
- [x] 确认按钮:卡片置 executing → 调 api_endpoint(JWT)→ 成功置 success + 刷新 zustand 数据 + 调 confirmAction + 触发 AI 后续消息
- [x] 取消按钮:卡片置 failed("已取消") + 调 confirmAction(..., "cancelled") + AI 发送"已取消,有需要再告诉我"
- [x] 失败时卡片置 failed + 显示错误 + 重试按钮

## 端到端验证(Phase 1)

- [ ] "我有多少积分" → query_child_balance → 回复含余额数字(富文本高亮)(需用户手动验证:依赖真实 LLM API)
- [ ] "今日任务" → list_tasks(status=pending)→ 回复含待完成任务数 + 总积分(需用户手动验证:依赖真实 LLM API)
- [ ] "最近有什么奖励" → list_redeem_items → 回复含商品列表(解决 v3.1 query_reward 无数据问题)(需用户手动验证:依赖真实 LLM API)
- [ ] "成长报告" → query_child_scores → 回复含成长指数 + 短板维度(需用户手动验证:依赖真实 LLM API)
- [ ] get_cycle_progress 拒绝跨 family 访问(需用户手动验证:依赖真实 LLM API)
- [ ] list_activities 不返回 organizer_id 等敏感字段(需用户手动验证:依赖真实 LLM API)

## 端到端验证(Phase 2)

- [ ] "我完成了洗碗" → submit_task suggested_action → 确认后任务状态变 submitted(需用户手动验证:依赖真实 LLM API;且需先修复写工具 api_endpoint/method 不匹配问题)
- [ ] "兑换小风扇" → redeem_item suggested_action → 确认后余额扣减(需用户手动验证:依赖真实 LLM API;且需先修复写工具 api_endpoint/method 不匹配问题)
- [ ] 儿童账号"设置目标为80" → set_stage_goal suggested_action → 卡片置灰 + 提示需要家长(需用户手动验证:依赖真实 LLM API)
- [ ] 家长账号"奖励小明10积分" → adjust_score suggested_action → 确认后余额增加(需用户手动验证:依赖真实 LLM API;且需先修复写工具 api_endpoint/method 不匹配问题)
- [ ] AIAuditLog 表记录全部写操作(tool_name/params/executor/result)(需用户手动验证:依赖真实 LLM API)
- [ ] 卡片取消后不再可交互(需用户手动验证:依赖真实 LLM API)
- [ ] 卡片 24h 过期后置灰不可确认(需用户手动验证:依赖真实 LLM API)

## 安全与禁止暴露

- [x] MasterChallengeService.UpdateStage/SubmitForReview/Review 未被暴露为 tool
- [x] CommunityService.CompleteDonation 未被暴露
- [x] GrowthStoryService.GenerateProjectStory 未被暴露
- [x] QuestionnaireService.SubmitAnswers 未被暴露
- [x] AbilityService.ReassessScores/AwardTaskCompletion/AddScoreForDimension/AwardMasteryStar 未被暴露
- [x] 所有 Delete* 方法未被暴露
- [x] ChildService.UpdateChild/DeleteChild 未被暴露

## 回归验证

- [x] 现有 `POST /chat/message` 不带 suggested_actions 的查询回复正常(字段可选,不破坏旧调用)
- [x] 现有 `detectIntent` 调用方(前端 IP 表情切换)仍能拿到 intent 字段
- [x] 现有历史抽屉/会话管理功能不受影响
- [x] v3.1 的 5 状态机 UI 不受破坏(仅新增卡片,不改原有气泡/页眉/抽屉)
