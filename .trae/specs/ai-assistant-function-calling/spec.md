# AI 助理 Function Calling 升级 Spec

> **来源**:基于 `.trae/documents/AI助理模块PRD升级-v3.2.md`(已撰写完成)
> **前置版本**:`.trae/specs/tonglaotongde/spec.md`(AI 助理模块基线)、`.trae/documents/AI助理模块PRD细化-v3.md`(UI 层 v3.1)
> **变更性质**:能力层升级——把 AI 助理从"上下文快照注入"升级为"OpenAI 兼容 function calling 按需工具调用",并引入"AI 提议 + UI 二次确认"写操作模式
> **执行范围**:本次 spec 仅覆盖 PRD v3.2 的 **Phase 1(P0 只读工具)+ Phase 2(P1 写操作工具)**;Phase 3(安全缺口修复 + 大师挑战/社区写工具)留作后续 spec

## Why

当前 AI 助理([chat_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/backend/internal/service/chat_service.go))采用"快照注入"模式,存在 4 条结构性缺陷:

1. `buildSystemPrompt` 仅注入 3 类快照(孩子信息/六维分/最近 5 任务),AI 无法查询系统能力 — 用户问"有什么奖励可兑换"时 LLM 编造数据
2. 任务列表不筛选状态,前 5 条可能全是已完成任务,与"今日任务"诉求错位
3. 快照是发送时刻的数据,中途完成任务后对话仍引用旧数据
4. `detectIntent` 关键词匹配仅打标签,既不能理解复合意图,也不驱动任何后端动作("提交任务"只能文字回应,无法真正提交)

v3.2 通过引入 OpenAI 兼容 function calling,让 AI 自主调用后端 Service 方法完成查询;写操作采用"AI 返回 suggested_actions → 前端确认卡片 → 用户确认后直接调 REST API(JWT 鉴权)"模式,既扩展能力又保留完整鉴权与审计。

## What Changes

### 架构层(AIService / ChatService)
- **新增** `AIService.ChatWithTools` 方法,支持 `tools` 参数与 `tool_calls` 循环(上限 3 次)
- **新增** `ChatService.toolRegistry`(`map[string]ToolDefinition`)集中管理工具定义与执行函数
- **新增** `ChatService.executeToolCall` 分发器,根据 tool_name 调用对应 Service 方法返回 JSON
- **修改** `ChatService.buildSystemPrompt` 精简:移除 3 类数据快照注入,新增 child_id/family_id 注入,system prompt < 200 tokens
- **修改** `ChatService.SendMessage` 改为调用 `ChatWithTools`,处理 tool_calls 循环
- **修改** `ChatService.detectIntent` 降级:仅用于前端 IP 表情切换,从 tool_name 反推表情(不退役,不删除)

### 只读工具(P0,13 个)
- **新增** 13 个只读工具包装:query_child_balance / query_child_scores / list_tasks / get_task_detail / list_redeem_items / list_redeem_records / get_growth_timeline / get_growth_album / get_current_cycle / get_cycle_progress / list_growth_stories / list_master_challenges / list_activities
- **修改** `get_cycle_progress` tool 实现层补 familyID 鉴权(原 Service 方法仅凭 cycleID)
- **修改** `list_activities` tool 实现层过滤敏感字段(organizer_id 等,原 Service 无家庭隔离)

### 写操作工具(P1,5 个)
- **新增** 5 个写操作工具:submit_task / redeem_item / set_stage_goal / create_cycle / adjust_score
- **新增** `suggested_actions` 响应结构(LLM 返回结构化建议动作,不直接执行写操作)

### 前端(P1)
- **新增** `ActionConfirmCard` 组件(AI 气泡下方,白底橙边,四态机:pending/executing/success/failed)
- **新增** 儿童权限降级逻辑(家长专属 suggested_action 收到时卡片置灰)
- **修改** `AssistantPage.tsx` 消息渲染支持 suggested_actions 卡片
- **修改** `services/chat.ts` 扩展响应类型,新增 `POST /chat/message/confirm` 调用

### 数据模型与接口
- **修改** `ChatMessage` 模型新增 3 字段:tool_calls(JSON) / tool_call_id(string) / suggested_actions(JSON)
- **新增** `AIAuditLog` 模型(写操作审计日志:tool_name/params/executor/result/error_message)
- **修改** `POST /chat/message` 响应体扩展 `suggested_actions` 字段(可选)
- **新增** `POST /chat/message/confirm` 接口(前端确认后调用,仅记录审计,不执行写操作)

### 禁止暴露(本次明确不实施)
- 禁止暴露 13 项 Service 方法(详见 PRD v3.2 第 3.4 节),含缺 familyID 鉴权的 MasterChallengeService.UpdateStage/SubmitForReview/Review、CommunityService.CompleteDonation、GrowthStoryService.GenerateProjectStory,以及无幂等保护的 QuestionnaireService.SubmitAnswers

## Impact

- **Affected specs**:
  - `.trae/specs/tonglaotongde/spec.md`(AI 助理基线 FR-AI-001~008,buildSystemPrompt 与 detectIntent 定义)
  - `.trae/specs/v3.1-growth-optimization/spec.md`(大师挑战相关方法缺鉴权,本次禁止暴露)
- **Affected code**:
  - 后端服务:`backend/internal/service/ai_service.go` / `chat_service.go`
  - 后端模型:`backend/internal/model/chat_message.go`(扩展) / 新增 `ai_audit_log.go`
  - 后端 handler:`backend/internal/handler/chat_handler.go`(响应体扩展) + 新增 confirm 接口
  - 后端路由:`backend/cmd/main.go`(注册 confirm 路由)
  - 前端页面:`frontend/src/pages/AssistantPage.tsx`(消息渲染 + 确认卡片)
  - 前端组件:新增 `frontend/src/components/ActionConfirmCard.tsx`
  - 前端服务:`frontend/src/services/chat.ts`(响应类型 + confirm API)
- **Affected docs**:`.trae/documents/AI助理模块PRD升级-v3.2.md`(本 spec 的来源)
- **不在范围内**:修复 MasterChallengeService/CommunityService 缺 familyID 鉴权的安全缺口(留 Phase 3);UI 层 v3.1 已定义的气泡/页眉/抽屉规格;非 AI 助理模块(任务 Tab/成长 Tab/社区 Tab)现有功能

## ADDED Requirements

### Requirement: Function Calling 调用循环
系统 SHALL 在 AI 助理发送消息时,向 LLM 传递工具定义数组(tools),并支持 tool_calls 循环:LLM 返回 tool_calls 时后端执行对应工具,将结果以 tool role 消息追加后再次调用 LLM,直到 finish_reason=stop 或达到循环上限。

#### Scenario: LLM 调用单个只读工具
- **WHEN** 用户问"我有多少积分"
- **THEN** LLM 返回 tool_calls=[{name:"query_child_balance"}],后端执行 ScoreService.GetBalance 返回 {balance:2850, nickname:"小明"},LLM 二次生成回复"小明当前有 **2850** 积分,继续加油!",前端收到 {reply, intent:"query_points", session_id}

#### Scenario: LLM 连续调用多个工具
- **WHEN** 用户问"我有多少积分,能兑换什么"
- **THEN** LLM 依次调用 query_child_balance + list_redeem_items,后端顺序执行,LLM 综合两次结果生成回复

#### Scenario: 循环上限保护
- **WHEN** LLM 在 3 次循环后仍返回 tool_calls
- **THEN** 系统强制中断,返回"请一次只问一个问题"

### Requirement: 工具注册表
系统 SHALL 在 ChatService 中维护 toolRegistry map,集中管理全部工具的定义(name/description/parameters)与执行函数。新增工具仅需在 registry 注册,不改分发器。

#### Scenario: 新增工具
- **WHEN** 开发者新增 query_xxx 工具
- **THEN** 仅需在 toolRegistry 添加一条记录(定义+执行函数),executeToolCall 自动路由

### Requirement: 只读工具集(P0)
系统 SHALL 提供 13 个只读工具,覆盖积分/能力/任务/兑换/成长/周期/故事/大师挑战/公益活动查询。每个工具 SHALL 包装对应 Service 方法,执行时使用 family_id(从 JWT)+ child_id(从会话)鉴权。

#### Scenario: 查询待完成任务
- **WHEN** 用户问"今日任务是什么"
- **THEN** LLM 调用 list_tasks(status="pending"),返回待完成任务列表,LLM 回复任务数+总积分

#### Scenario: 查询可兑换商品(解决 v3.1 query_reward 无数据问题)
- **WHEN** 用户问"最近有什么奖励"
- **THEN** LLM 调用 list_redeem_items,返回商品列表,LLM 回复时结合用户余额给出建议

#### Scenario: 缺鉴权工具的临时补丁
- **WHEN** LLM 调用 get_cycle_progress
- **THEN** tool 实现层校验 cycleID 属于当前 family_id,否则返回错误

### Requirement: 写操作建议动作(P1)
系统 SHALL 对写操作采用"AI 提议 + UI 二次确认"模式:LLM 不直接执行写工具,而是返回 suggested_actions 结构化数组,前端渲染确认卡片,用户确认后前端直接调对应 REST API(走 JWT 鉴权)。

#### Scenario: 提交任务建议
- **WHEN** 用户说"我完成了洗碗"
- **THEN** LLM 返回 suggested_actions=[{action:"submit_task", params:{task_id:123}, summary:"任务:洗碗,提交后将进入家长审核", api_endpoint:"/tasks/123/submit", api_method:"POST"}],前端在 AI 气泡下方渲染确认卡片

#### Scenario: 用户确认写操作
- **WHEN** 用户点击确认卡片"确认提交"按钮
- **THEN** 前端卡片状态置 executing,直接调 POST /tasks/123/submit(JWT 鉴权),成功后卡片置 success,刷新任务列表,AI 发送后续消息"已成功提交洗碗任务,等家长审核哦~"

#### Scenario: 用户取消写操作
- **WHEN** 用户点击取消按钮
- **THEN** 卡片置 failed 态显示"已取消",AI 发送"已取消,有需要再告诉我",卡片不再可交互

### Requirement: 儿童权限降级
系统 SHALL 在儿童角色收到家长专属 suggested_action(set_stage_goal/create_cycle/adjust_score)时,将确认卡片置灰,禁用确认按钮,显示"需要请家长帮忙操作"提示。

#### Scenario: 儿童请求设置目标
- **WHEN** 儿童说"帮我把独立自主目标设为80"
- **THEN** LLM 返回 set_stage_goal 的 suggested_action(requires_parent=true),前端卡片置灰,确认按钮禁用,底部提示"需要请家长帮忙设置目标",AI 文字回复"这个操作需要家长帮忙,你可以请爸爸妈妈来操作哦~"

### Requirement: 写操作审计日志
系统 SHALL 全量记录写操作工具调用,含 tool_name/params/executor_user_id/child_id/family_id/result/error_message/created_at。

#### Scenario: 审计记录
- **WHEN** 用户确认 submit_task 建议后
- **THEN** 前端调 POST /chat/message/confirm 携带 message_id/action/params/result,后端写入 AIAuditLog 表

### Requirement: 确认卡片有效期
系统 SHALL 给确认卡片设置 24 小时有效期,过期后卡片变灰显示"已过期,请重新询问",不可再确认。

#### Scenario: 卡片过期
- **WHEN** suggested_action 创建 24 小时后未确认
- **THEN** 卡片变灰,显示"已过期,请重新询问",确认按钮禁用

## MODIFIED Requirements

### Requirement: buildSystemPrompt 上下文构造
[原 v3 定义:自动填充儿童信息/任务/成长/目标作为对话上下文]

**v3.2 修改**:buildSystemPrompt 精简,移除 3 类数据快照(孩子信息/六维分/最近5任务),保留 IP 身份+对话者角色+角色权限说明,新增 child_id/family_id 注入(供 tool 执行鉴权)。system prompt < 200 tokens。数据按需通过 tool 调用获取。

### Requirement: detectIntent 意图识别
[原 v3 定义:基于关键词匹配,驱动动作执行]

**v3.2 修改**:detectIntent 降级为仅用于前端 IP 表情切换,从 tool_name 反推表情(如 tool=query_child_balance → intent=query_points → 表情 think)。意图识别与动作路由改由 LLM 自主选择 tool 完成。detectIntent 函数保留不删除,避免破坏现有调用链。

### Requirement: POST /chat/message 响应体
[原响应体:{reply, intent, session_id}]

**v3.2 修改**:扩展为 {reply, intent, session_id, suggested_actions?}。suggested_actions 为可选字段,仅当 AI 返回写操作建议时存在;查询类回复不含此字段。

## REMOVED Requirements

### Requirement: buildSystemPrompt 数据快照注入
**Reason**:快照是发送时刻的数据,中途完成任务后对话仍引用旧数据;且固定注入 5 条任务无法支持状态筛选
**Migration**:改由 query_child_balance / query_child_scores / list_tasks 三个 tool 按需拉取,实时数据

(注:detectIntent 与 buildSystemPrompt 函数本身不删除,仅移除其"数据快照注入"与"驱动动作执行"职责)
