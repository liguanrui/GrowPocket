# AI 助理模块 PRD 升级 v3.2 — 实施计划(系统能力调用层)

> **本计划性质**:Plan Mode 产物。本文档本身是"写 PRD 的计划",不是 PRD 本身。计划被用户确认后,执行者据此撰写 `AI助理模块PRD升级-v3.2.md`(PRD 正文)。
>
> **用户已确认的三项决策**:
> 1. 升级核心方向:**引入 Function Calling**(从"上下文快照注入"升级为"按需工具调用")
> 2. 写操作策略:**AI 提议 + UI 二次确认**(AI 返回结构化建议动作,前端弹确认卡片,用户点确认才走正常 REST API 鉴权链路)
> 3. PRD 产出形式:**新建 v3.2 独立文档**(与 v3.1 UI 层并列,遇冲突以新文档为准)

---

## Phase 1 探索结论(已完成的代码库勘察)

### 当前实现架构(基线)

- **AI 服务** [ai_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/backend/internal/service/ai_service.go):仅发起纯 `/chat/completions` 调用,**未传 `tools` / `functions` 数组**,无 function calling 机制。
- **对话服务** [chat_service.go:91 buildSystemPrompt](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/backend/internal/service/chat_service.go#L91):仅注入三类快照数据 — 孩子信息(昵称+余额)、`GetChildScores` 六维分、`ListTasks` 最近 5 条(不筛选状态)。
- **意图识别** [chat_service.go:144 detectIntent](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/backend/internal/service/chat_service.go#L144):基于关键词匹配,仅给消息打 `intent` 标签存库供前端切 IP 表情,**不会回调任何 Service**。
- **前端** [AssistantPage.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/frontend/src/pages/AssistantPage.tsx):已 1:1 还原 v3.1 设计图(5 状态机),发送消息走 `POST /chat/message`,接收 `{reply, intent, session_id}`。

### 后端可暴露的工具面(已勘察 12 个 Service,60+ 方法)

**只读类(低风险,推荐首批接入)**:
- `TaskService.ListTasks` / `GetTask`
- `ScoreService.GetBalance` / `GetHistory` / `GetMonthlyStats` / `GetTrend`
- `AbilityService.ListDimensions` / `GetChildScores` / `GetGrowthIndex` / `GetGradeGuide`
- `RedeemService.ListItems` / `GetItem` / `GetRedeems`
- `GrowthService.Album` / `Timeline`
- `GrowthCycleService.GetCurrentCycle` / `GetCycleProgress`
- `GrowthStoryService.GetStory` / `ListStories`
- `MasterChallengeService.GetAvailableTemplates` / `GetInstances` / `GetInstanceDetail`
- `ActivityService.ListActivities` / `GetActivity`
- `CommunityService.ListShares` / `ListProjects`
- `QuestionnaireService.GetByStage`
- `ChildService.ListChildren` / `GetChild`

**写操作类(P1,需 UI 二次确认)**:
- `TaskService.SubmitTask`(提交验收)
- `RedeemService.Redeem`(兑换奖励)
- `GrowthCycleService.SetGoal`(设置阶段目标,家长专属)
- `GrowthCycleService.CreateCycle`(创建周期,家长专属)
- `ScoreService.Adjust`(手动加减积分,家长专属)

**禁止直接暴露(本次不实施)**:
- `AbilityService.ReassessScores` / `AwardTaskCompletion` / `AddScoreForDimension` / `AwardMasteryStar`(内部方法,由阶段回顾/问卷流程内部调用)
- `GrowthStoryService.GenerateStory`(阶段回顾专属,走专门 UI 流程)
- `MasterChallengeService.UpdateStage` / `SubmitForReview` / `Review`(**缺 familyID 鉴权**,需先修复)
- `CommunityService.CompleteDonation`(**缺 familyID 鉴权**)
- 所有 `Delete*` / `UpdateChild` / `DeleteChild` 等危险操作

### 已识别的安全缺口(必须在 PRD 中明确)

1. **缺 familyID 鉴权的写方法**:`MasterChallengeService.UpdateStage/SubmitForReview/Review`、`CommunityService.CompleteDonation`、`GrowthStoryService.GenerateProjectStory` — 这些方法若被 AI 调用会越权,本次 PRD 明确禁止暴露,并在"未来扩展"章节标注需先补鉴权。
2. **缺家庭隔离的全局读方法**:`ActivityService.ListActivities`、`CommunityService.ListShares`、`CommunityService.GetChildByID` — 暴露给 AI 时需在 tool 实现层包一层家庭过滤。
3. **`QuestionnaireService.SubmitAnswers` 无幂等保护** — 一调用即发积分+累加能力分,本次禁止暴露给 AI。
4. **`MasterChallengeService.Review` 通过时四项副作用一气呵成**(加稀有积分+写 Transaction+AwardMasteryStar+生成项目故事)— 即便未来开放也必须人工确认。

---

## Phase 3 计划:PRD 文档结构与核心内容

### 产出文件

**新建**:`/Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/.trae/documents/AI助理模块PRD升级-v3.2.md`

定位:PRD-v3 第 4.1 节(高层)+ v3.1(UI 层)之后的"系统能力调用层"细化。与 v3.1 并列,遇冲突以 v3.2 为准。

### PRD 文档结构(10 节 + 附录)

```
# AI 助理模块 PRD 升级 v3.2(系统能力调用层)
> 版本 v3.2 / 更新日期 / 依据(本次勘察)/ 与 v3+v3.1 的关系 / 冲突修正清单

## 1. 概述与范围
  1.1 文档目的(把 AI 助理从"快照注入"升级为"function calling 按需工具调用")
  1.2 适用范围(仅 AI 助理 Tab 的对话能力层,不重复 v3.1 的 UI 规格)
  1.3 与 v3 / v3.1 的关系及冲突修正清单
      - C-FC-01: buildSystemPrompt 快照注入 → 退役(保留最小身份上下文,数据按需拉取)
      - C-FC-02: detectIntent 关键词识别 → 退役(LLM 自主选择 tool)
      - C-FC-03: AI 仅返回文字 → 新增"建议动作"结构化字段(写操作)
      - C-FC-04: POST /chat/message 响应体 → 扩展(reply + intent + session_id + suggested_actions)

## 2. 技术架构升级
  2.1 旧架构(快照注入模式)与新架构(function calling 模式)对比图
  2.2 新架构数据流:
      用户消息 → LLM(携带 tools 定义)→ LLM 决定是否调 tool
        → 是:后端执行 tool 返回结果 → LLM 二次生成回复 → 前端
        → 否:LLM 直接生成回复 → 前端
      写操作:LLM 返回 suggested_actions → 前端弹确认卡片 → 用户确认 → 前端调 REST API
  2.3 AIService 改造点(ai_service.go):
      - Chat 方法新增 tools 参数
      - 新增 ChatWithTools 方法(支持 tool_calls 循环)
      - 响应解析支持 tool_calls 字段
  2.4 ChatService 改造点(chat_service.go):
      - buildSystemPrompt 精简(仅身份+角色权限,不再注入数据快照)
      - SendMessage 改为调用 ChatWithTools
      - 新增 tool 注册表(toolRegistry)与执行分发器(executeToolCall)
      - detectIntent 保留(仅用于前端 IP 表情,不影响 tool 路由)
  2.5 上下文长度控制(单次对话 < 4000 tokens,tool 返回结果截断策略)

## 3. 工具清单(Tool Catalog)— 核心章节
  3.1 工具分类总览表(只读 / 写操作 / 禁止暴露)
  3.2 只读工具详细规格(P0,首批实施)
      每个工具含:工具名、描述、参数 schema、对应 Service 方法、权限要求、返回值结构、示例
  3.3 写操作工具详细规格(P1,需 UI 二次确认)
      每个工具含:工具名、描述、参数 schema、对应 Service 方法、权限要求、返回值结构、
      确认卡片 UI 规格(标题/正文/确认按钮文案/取消按钮文案)、确认后调用的 REST API
  3.4 禁止暴露清单(P2/不实施,附理由)

## 4. 写操作确认流程(UI 层)
  4.1 suggested_actions 响应结构定义
      { action: string, params: object, summary: string, confirm_text: string, cancel_text: string, api_endpoint: string, api_method: string }
  4.2 确认卡片组件规格(ActionConfirmCard)
      - 位置:AI 气泡下方,独立卡片
      - 样式:白底+橙色边框+两个按钮(取消/确认)
      - 状态:pending(待确认)/ executing(执行中)/ success(成功)/ failed(失败)
  4.3 确认后调用链路:前端直接调 REST API(走 JWT 鉴权)→ 成功后刷新相关数据 → AI 后续消息引用执行结果
  4.4 取消链路:用户点取消 → AI 回复"已取消,有需要再告诉我"
  4.5 多个 suggested_actions 的处理(顺序确认 vs 并列卡片)
  4.6 权限校验:儿童角色收到家长专属 suggested_action 时,卡片置灰+提示"需要家长操作"

## 5. 意图识别升级
  5.1 旧 detectIntent(关键词)的局限(无法理解复合意图、无法处理"帮我看看还要做啥任务"等)
  5.2 新模式:LLM 自主选择 tool(基于 tool 描述与参数)
  5.3 detectIntent 保留职责:仅用于前端 IP 表情切换(从 tool_name 反推表情,而非关键词)
      - tool=submit_task → proud
      - tool=query_points → think
      - tool=redeem_item → surprised
      - 无 tool 调用 → happy
  5.4 意图 → 表情映射表(更新版,覆盖全部新工具)

## 6. 上下文构造策略变化
  6.1 退役的注入项(从 buildSystemPrompt 移除):
      - 六维得分快照(改由 query_child_scores tool 按需拉)
      - 最近 5 条任务快照(改由 list_tasks tool 按需拉)
      - 孩子余额快照(改由 query_child_balance tool 按需拉)
  6.2 保留的注入项(身份+权限,精简版):
      - IP 身份("你是小萌芽,GrowPocket 的 AI 成长助理")
      - 当前对话者角色(parent/child)
      - 当前 child_id / family_id(供 tool 执行时鉴权)
      - 角色权限说明(儿童不可执行家长专属操作)
  6.3 上下文膨胀控制:tool 返回结果若 > 500 字,截断并附"如需详情请追问"
  6.4 多轮对话上下文:保留最近 10 条历史消息(tool 调用结果也计入)

## 7. 安全与权限模型
  7.1 工具执行鉴权三要素:family_id(从 JWT)+ child_id(从会话)+ user_role(从 user 表)
  7.2 只读工具的权限:同一 family 内可查任意 child,跨 family 拒绝
  7.3 写操作工具的权限矩阵
      | 工具 | 家长 | 儿童 |
      |------|------|------|
      | submit_task | ✓ | ✓ |
      | redeem_item | ✓ | ✓(需家长额度配置,可选) |
      | set_stage_goal | ✓ | ✗(卡片置灰) |
      | create_cycle | ✓ | ✗ |
      | adjust_score | ✓ | ✗ |
  7.4 禁止暴露的安全缺口清单(本次不修复,仅记录):
      - MasterChallengeService.UpdateStage/SubmitForReview/Review 缺 familyID
      - CommunityService.CompleteDonation 缺 familyID
      - CommunityService.GetChildByID 无家庭隔离
  7.5 审计日志:写操作 tool 调用全量记录(tool_name/params/执行人/结果/时间)

## 8. 数据模型与接口变更
  8.1 ChatMessage 模型扩展(新增字段):
      - tool_calls(JSON,存 LLM 返回的 tool 调用请求)
      - tool_call_id(string,关联 tool 执行结果消息)
      - suggested_actions(JSON,存建议动作,供前端渲染)
  8.2 POST /chat/message 响应体扩展:
      { reply, intent, session_id, suggested_actions?: ActionSuggestion[] }
  8.3 新增接口:
      - POST /chat/message/confirm(前端确认写操作后调用,携带 action_id + params)
  8.4 现有 REST API 复用(写操作确认后前端直接调,不走 AI 链路):
      - POST /tasks/:id/submit、POST /redeem/:id、POST /growth-cycle/goal 等

## 9. 功能需求清单(FR-AI-FC-xxx)
  9.1 只读工具需求(FR-AI-FC-001 ~ 013,每个工具一条)
  9.2 写操作工具需求(FR-AI-FC-014 ~ 018,每个工具一条 + 确认卡片规格)
  9.3 架构改造需求(FR-AI-FC-019 ~ 024):
      - FR-AI-FC-019: AIService 支持 function calling
      - FR-AI-FC-020: ChatService 工具注册表与分发器
      - FR-AI-FC-021: buildSystemPrompt 精简
      - FR-AI-FC-022: POST /chat/message 响应体扩展
      - FR-AI-FC-023: ActionConfirmCard 前端组件
      - FR-AI-FC-024: 写操作审计日志
  9.4 与 v3 FR-AI-001~008 + v3.1 FR-AI-UI-001~014 的三向对照表

## 10. 实施分期
  Phase 1 (P0):只读工具接入 + AIService 改造(13 个查询工具上线)
  Phase 2 (P1):写操作工具 + UI 二次确认(5 个写工具 + ActionConfirmCard)
  Phase 3 (P2):安全缺口修复 + 扩展工具(补 familyID 鉴权后开放大师挑战/社区写操作)

## 附录
  A. 工具清单总表(工具名 / 类型 / 对应 Service 方法 / 权限 / 优先级)
  B. 与 v3 / v3.1 的三向需求对照关系
  C. 现状偏差说明(当前 buildSystemPrompt 注入项 vs v3.2 精简后注入项)
  D. 风险与缓解措施表
```

### 各章节核心内容要点(撰写 PRD 时的关键决策)

**第 2 节 — 技术架构**:核心是给出新旧架构对比图。旧架构是"buildSystemPrompt 注入快照 → LLM 文字回复",新架构是"精简 system prompt + tools 定义 → LLM 自主调 tool → 后端执行 → LLM 二次生成回复 → 前端渲染(含 suggested_actions 卡片)"。必须明确 `AIService.ChatWithTools` 的循环逻辑:LLM 可能返回 `tool_calls`,后端执行后把结果作为 `tool` role 消息追加,再次调用 LLM,直到 LLM 返回 `finish_reason=stop`。

**第 3 节 — 工具清单**:PRD 最核心章节。每个工具按以下模板写:
```
#### 工具:query_child_balance
- 描述:查询儿童当前积分余额
- 对应 Service:ScoreService.GetBalance(childID, familyID)
- 参数 schema:{}
- 权限:家长/儿童均可,需 family_id 鉴权
- 返回值:{ balance: int, nickname: string }
- LLM 调用时机:用户问"我有多少积分""我的余额"
- 富文本高亮:余额数字用 font-bold text-primary
- 示例对话:用户"我有多少分" → tool 调用 → 返回 {balance:2850} → LLM 回复"你当前有 2850 积分~继续加油!"
```

**第 4 节 — 写操作确认流程**:`suggested_actions` 结构是关键创新点。AI 不直接执行写操作,而是返回结构化建议,前端渲染成确认卡片。确认后前端**直接调原本的 REST API**(如 `POST /tasks/:id/submit`),走正常 JWT 鉴权,不经 AI 链路。这样既给了 AI"执行能力",又保留了完整鉴权与审计。

**第 5 节 — 意图识别**:必须明确 `detectIntent` 不退役但降级 — 仅用于前端 IP 表情切换,且从 `tool_name` 反推而非关键词。例如旧逻辑 `strings.Contains(msg, "积分")` 改为 `toolName == "query_child_balance"`。

**第 6 节 — 上下文构造**:必须给出 buildSystemPrompt 精简前后的对照表。精简后 system prompt 预计 < 200 tokens(身份+角色+child_id/family_id),留出 3800 tokens 给 tool 定义+历史+回复。

**第 7 节 — 安全与权限**:必须明确"禁止暴露清单"及理由。这部分是给后续实施者的安全护栏,避免有人把 `MasterChallengeService.Review` 这种缺鉴权的方法直接暴露给 AI。

**第 9 节 — FR-AI-FC 需求清单**:约 24 条,每条含验收标准。与 v3 的 FR-AI-001~008 形成"高层 → 能力调用层"映射,与 v3.1 的 FR-AI-UI-001~014 形成"UI 层 → 能力调用层"映射。

**第 10 节 — 实施分期**:
- Phase 1(P0):13 个只读工具 + AIService 改造 + ChatService 工具注册表
- Phase 2(P1):5 个写工具 + ActionConfirmCard 组件 + POST /chat/message/confirm 接口
- Phase 3(P2):安全缺口修复后扩展(大师挑战/社区写操作)

### 关键决策点(PRD 中须明确)

1. **tool_calls 循环上限**:LLM 单轮最多调 3 个 tool(防无限循环),超出则强制返回"请一次只问一个问题"。
2. **tool 返回结果截断**:超过 500 字截断,附"如需详情请追问"提示。
3. **写操作确认卡片有效期**:24 小时未确认自动失效,需重新对话触发。
4. **儿童权限降级**:儿童角色收到家长专属 suggested_action 时,卡片置灰+提示"需要请家长帮忙操作",不直接拒绝(避免对话断裂)。
5. **保留 detectIntent**:仅用于 IP 表情,不影响 tool 路由。避免一次性改太多导致回归风险。
6. **buildSystemPrompt 不完全退役**:精简但保留(身份+角色+child_id/family_id),不删除方法,避免破坏现有调用链。
7. **tool 定义来源**:在 ChatService 中维护 `toolRegistry` map,而非分散在代码里。便于后续扩展。
8. **富文本高亮规则**:沿用 v3.1 的 `font-bold text-primary` 规则,tool 返回的数值字段在 LLM 回复中高亮。

---

## Assumptions & Decisions(撰写 PRD 时的假设与决策)

- **假设 1**:LLM 模型支持 OpenAI 兼容的 function calling 协议(当前 ai_service.go 调 baseURL + `/chat/completions`,应兼容 OpenAI 协议)。PRD 须在"实施前提"章节注明:若实际模型不支持 tool_calls,降级为"prompt 注入工具描述 + LLM 输出 JSON"模式。
- **假设 2**:前端 [AssistantPage.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/frontend/src/pages/AssistantPage.tsx) 已具备渲染富文本气泡的能力,新增 suggested_actions 卡片是在现有气泡下方追加组件,不破坏 v3.1 的 UI 规格。
- **假设 3**:写操作确认后前端调用的 REST API 已存在(如 `POST /tasks/:id/submit`),无需新增写接口,仅新增 `POST /chat/message/confirm` 用于记录确认动作。
- **决策 1**:PRD 不覆盖 v3.1 已定义的 UI 细节(气泡样式/页眉/抽屉等),仅新增 suggested_actions 卡片规格。
- **决策 2**:PRD 不修复安全缺口(缺 familyID 鉴权的方法),仅在"禁止暴露清单"中记录,留给后续单独的安全修复任务。
- **决策 3**:保留 detectIntent 关键词识别(仅用于 IP 表情),不强行改为 LLM 输出表情标签,降低改动范围。
- **决策 4**:`query_reward` 意图的"无数据支撑"问题在 v3.2 中通过 `list_redeem_items` + `list_redeem_records` 两个 tool 解决,不再依赖 system prompt 注入。

---

## Verification Steps(PRD 文档完成后的验收)

1. PRD 文档结构 10 节 + 附录完整,每节内容可独立指导开发
2. 工具清单(第 3 节)覆盖全部 13 个只读工具 + 5 个写操作工具,每个工具含完整参数 schema 与 Service 方法映射
3. 写操作确认流程(第 4 节)含 suggested_actions 完整结构定义 + ActionConfirmCard 组件规格 + 确认/取消两条链路
4. 安全章节(第 7 节)明确列出禁止暴露清单及理由,权限矩阵覆盖全部 5 个写操作工具
5. 三向对照表(附录 B)覆盖 v3 FR-AI-001~008 + v3.1 FR-AI-UI-001~014 + v3.2 FR-AI-FC-001~024
6. 实施分期(第 10 节)Phase 1/2/3 边界清晰,Phase 1 可独立交付(P0 只读工具上线即可缓解"query_reward 无数据"等核心痛点)
7. 每个 FR-AI-FC 需求条目可逐条映射到具体 Service 方法与(若涉及)REST API
8. 现状偏差说明(附录 C)含 buildSystemPrompt 精简前后对照、detectIntent 降级前后职责对照

---

## 撰写 PRD 时的注意事项

1. **不要重复 v3.1 的 UI 规格**:本文档仅新增 suggested_actions 卡片规格,气泡/页眉/抽屉等引用 v3.1 即可。
2. **不要修复安全缺口**:缺 familyID 鉴权的方法仅在"禁止暴露清单"记录,不在本文档修复。
3. **不要扩展非 AI 助理模块的范围**:本次仅升级 AI 助理的"能力调用层",不改动任务 Tab/成长 Tab/社区 Tab 的现有功能。
4. **工具清单要可执行**:每个工具的参数 schema 必须能直接转成 OpenAI tool 定义 JSON,Service 方法映射必须含完整方法签名。
5. **写操作确认流程要给出前端组件规格**:ActionConfirmCard 的位置/样式/状态机必须明确,否则前端无法实现。
6. **保留 detectIntent 的过渡设计**:明确其在新架构中的"降级"职责,避免实施者误以为要删除。
