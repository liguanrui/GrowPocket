# AI 助理模块 PRD 升级 v3.2(系统能力调用层)

> **版本**:v3.2(系统能力调用层)
> **更新日期**:2026-08-05
> **依据**:基于 `backend/internal/service/` 12 个 Service 60+ 方法的完整勘察
> **与主 PRD 关系**:本文为 `PRD-童劳童得-v3.md` 第 4.1 节的"系统能力调用层"细化,与 `AI助理模块PRD细化-v3.md`(UI 层)并列。遇冲突以本文为准。
> **前置文档**:
> - [PRD-童劳童得-v3.md](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/.trae/documents/PRD-童劳童得-v3.md)(高层 FR-AI-001~008)
> - [AI助理模块PRD细化-v3.md](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/.trae/documents/AI助理模块PRD细化-v3.md)(UI 层 FR-AI-UI-001~014)

---

## 1. 概述与范围

### 1.1 文档目的

把 AI 助理从"上下文快照注入"模式升级为"function calling 按需工具调用"模式。当前实现中,`buildSystemPrompt` 仅注入三类快照数据(孩子信息/六维分/最近5条任务),AI 无法真正查询或操作系统能力。本次升级引入 OpenAI 兼容的 function calling 协议,AI 可自主调用后端 Service 方法完成查询与(经 UI 二次确认的)写操作。

### 1.2 适用范围

仅 AI 助理 Tab 的对话能力层(工具调用、意图路由、写操作确认流程)。不重复 v3.1 已定义的 UI 规格(气泡/页眉/抽屉/语音输入等),仅新增"建议动作确认卡片"组件规格。

### 1.3 实施前提

- **假设**:当前 LLM 模型(由 `ai_service.go` 调 `baseURL + /chat/completions`)支持 OpenAI 兼容的 function calling 协议(`tools` 与 `tool_calls` 字段)。
- **降级方案**:若实际模型不支持 `tool_calls`,降级为"prompt 注入工具描述 + LLM 输出 JSON"模式。降级模式不属本 PRD 范围,由实施时单独评估。

### 1.4 与 v3 / v3.1 的关系及冲突修正清单

| 编号 | 冲突点 | v3 / v3.1 原文 | v3.2 口径 | 修正方向 |
|------|--------|---------------|-----------|---------|
| C-FC-01 | buildSystemPrompt | v3 4.1.2 定义"自动填充儿童信息/任务/成长/目标"作为上下文 | 数据按需拉取,system prompt 仅保留身份+角色+child_id/family_id | **精简** buildSystemPrompt,移除数据快照注入 |
| C-FC-02 | detectIntent | v3 6.1 流程"意图识别 → 执行动作"暗示 detectIntent 驱动动作执行 | LLM 自主选择 tool,detectIntent 仅用于 IP 表情 | **降级** detectIntent,不退役 |
| C-FC-03 | AI 回复格式 | v3.1 仅定义文字气泡 + 富文本高亮 | 新增"建议动作"结构化字段(suggested_actions) | **扩展** AI 回复,支持结构化建议 |
| C-FC-04 | POST /chat/message 响应体 | 当前 `{reply, intent, session_id}` | 扩展为 `{reply, intent, session_id, suggested_actions?}` | **扩展** 响应体 |

---

## 2. 技术架构升级

### 2.1 新旧架构对比

**旧架构(快照注入模式)**:
```
用户消息
  → buildSystemPrompt(注入:孩子信息+六维分+最近5任务)
  → AIService.Chat(systemPrompt, history, userMessage)
  → LLM 基于快照作答
  → 返回文字回复
  → 前端渲染气泡
```

**新架构(function calling 模式)**:
```
用户消息
  → buildSystemPrompt(精简:身份+角色+child_id/family_id)
  → AIService.ChatWithTools(systemPrompt, history, userMessage, tools)
  → LLM 决定是否调 tool:
      → 是:后端 executeToolCall 执行 → 结果作为 tool role 消息追加 → 再次调 LLM → ... → finish_reason=stop
      → 否:直接生成回复
  → 返回 {reply, intent, suggested_actions?}
  → 前端渲染气泡 + (若有)建议动作卡片
  → 写操作:用户点确认 → 前端直接调 REST API(JWT 鉴权)→ 刷新数据
```

### 2.2 新架构数据流要点

1. **tool_calls 循环**:LLM 单轮可能返回多个 `tool_calls`,后端顺序执行后追加 `tool` role 消息,再次调用 LLM。循环上限 **3 次**(防无限循环),超出强制返回"请一次只问一个问题"。
2. **tool 执行同步**:tool 调用在后端同步执行,结果立即返回给 LLM,不异步。
3. **写操作不直接执行**:LLM 想做写操作时,返回 `suggested_actions` 结构(而非真正调用写 tool),前端渲染确认卡片,用户确认后走 REST API。

### 2.3 AIService 改造点([ai_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/backend/internal/service/ai_service.go))

| 改造项 | 说明 |
|--------|------|
| `Chat` 方法保留 | 向后兼容,不删除 |
| 新增 `ChatWithTools` 方法 | 支持 `tools` 参数与 `tool_calls` 循环 |
| 请求体扩展 | 新增 `tools` 字段(OpenAI tool 定义数组) |
| 响应解析扩展 | 解析 `tool_calls` 字段(`id` / `function.name` / `function.arguments`) |
| 循环控制 | `finish_reason == "tool_calls"` 时继续循环,`== "stop"` 时结束;最多 3 轮 |

### 2.4 ChatService 改造点([chat_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/backend/internal/service/chat_service.go))

| 改造项 | 说明 |
|--------|------|
| `buildSystemPrompt` 精简 | 移除数据快照注入,仅保留身份+角色+child_id/family_id(详见第 6 节) |
| `SendMessage` 改造 | 改为调用 `ChatWithTools`,处理 tool_calls 循环 |
| 新增 `toolRegistry` | `map[string]ToolDefinition`,集中管理工具定义与执行函数 |
| 新增 `executeToolCall` | 分发器:根据 tool_name 调用对应 Service 方法,返回 JSON 结果 |
| `detectIntent` 保留 | 仅用于前端 IP 表情,从 `tool_name` 反推表情(详见第 5 节) |

### 2.5 上下文长度控制

| 维度 | 限制 |
|------|------|
| 单次对话总 tokens | < 4000(含 system + tools + history + user + tool_results + reply) |
| tool 返回结果截断 | > 500 字截断,附"如需详情请追问" |
| 历史消息保留 | 最近 10 条(含 tool 调用结果) |
| system prompt | < 200 tokens |

---

## 3. 工具清单(Tool Catalog)

### 3.1 工具分类总览

| 类别 | 数量 | 优先级 | 说明 |
|------|------|--------|------|
| 只读工具 | 13 | P0 | 查询类,无副作用,首批接入 |
| 写操作工具 | 5 | P1 | 需 UI 二次确认,Phase 2 接入 |
| 禁止暴露 | — | P2 | 缺鉴权或副作用过大,本次不实施 |

### 3.2 只读工具详细规格(P0)

#### 3.2.1 query_child_balance

| 项 | 值 |
|----|-----|
| 描述 | 查询儿童当前积分余额 |
| 对应 Service | `ScoreService.GetBalance(childID, familyID uint) (int, string, error)` |
| 参数 schema | `{ type: "object", properties: {}, required: [] }` |
| 权限 | 家长/儿童均可,需 family_id 鉴权 |
| 返回值 | `{ balance: int, nickname: string }` |
| LLM 调用时机 | 用户问"我有多少积分""我的余额" |
| 富文本高亮 | 余额数字 `font-bold text-primary` |
| 示例 | 用户"我有多少分" → tool 返回 `{balance:2850, nickname:"小明"}` → LLM "小明当前有 **2850** 积分,继续加油!" |

#### 3.2.2 query_child_scores

| 项 | 值 |
|----|-----|
| 描述 | 查询儿童六大能力维度得分与成长指数 |
| 对应 Service | `AbilityService.GetChildScores(childID, familyID) ([]model.ChildAbilityScore, error)` + `AbilityService.GetGrowthIndex(childID, familyID) (int, error)` |
| 参数 schema | `{ type: "object", properties: {}, required: [] }` |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ dimensions: [{ id: int, name: string, score: int, mastery_stars: int }], growth_index: int }` |
| LLM 调用时机 | 用户问"我的能力怎么样""成长报告""动手能力如何" |
| 富文本高亮 | 成长指数 + 最弱维度名 |
| 示例 | 用户"帮我看看成长报告" → tool 返回六维 → LLM "你的成长指数是 **72**,生活自理 **85** 表现很好,但社交情感 **58** 还有提升空间~" |

#### 3.2.3 list_tasks

| 项 | 值 |
|----|-----|
| 描述 | 查询儿童任务列表(支持状态筛选) |
| 对应 Service | `TaskService.ListTasks(familyID, childID uint, status int, page, pageSize int) ([]model.Task, int64, error)` |
| 参数 schema | `{ type: "object", properties: { status: { type: "string", enum: ["pending","submitted","completed","rejected"] } }, required: [] }` |
| 默认值 | status=pending(待完成), page=1, page_size=10 |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ tasks: [{ id, title, points, status, difficulty, ability_dimension_name }], total: int }` |
| LLM 调用时机 | 用户问"今日任务""还有什么没做""做完的任务有哪些" |
| 富文本高亮 | 任务数 + 总积分 |
| 示例 | 用户"今日任务是什么" → tool 返回 3 条待完成任务 → LLM "你今天还有 **3** 个任务待完成:洗碗(2积分)、整理书包(1积分)、阅读30分钟(2积分),加油!" |

#### 3.2.4 get_task_detail

| 项 | 值 |
|----|-----|
| 描述 | 查询单个任务详情 |
| 对应 Service | `TaskService.GetTask(id, familyID uint) (*model.Task, error)` |
| 参数 schema | `{ type: "object", properties: { task_id: { type: "integer" } }, required: ["task_id"] }` |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ id, title, description, points, status, difficulty, ability_dimension_name, photo, created_at }` |
| LLM 调用时机 | 用户追问某任务详情 |

#### 3.2.5 list_redeem_items

| 项 | 值 |
|----|-----|
| 描述 | 查询商城可兑换商品列表 |
| 对应 Service | `RedeemService.ListItems(familyID uint, category int, page, pageSize int) ([]model.RedeemItem, int64, error)` |
| 参数 schema | `{ type: "object", properties: { category: { type: "integer" } }, required: [] }` |
| 默认值 | category=0(全部), page=1, page_size=10 |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ items: [{ id, name, points_required, stock, category, image_url }], total: int }` |
| LLM 调用时机 | 用户问"有什么奖励""能兑换什么""最近有什么奖励" |
| 富文本高亮 | 积分要求 |
| 示例 | 用户"最近有什么奖励" → tool 返回 5 个商品 → LLM "商城有这些可以兑换:小风扇(**50**积分)、绘本(**100**积分)... 你现在 **2850** 积分可以兑换任意一个!" |

#### 3.2.6 list_redeem_records

| 项 | 值 |
|----|-----|
| 描述 | 查询儿童兑换记录 |
| 对应 Service | `RedeemService.GetRedeems(childID, familyID uint, page, pageSize int) ([]model.Redeem, int64, error)` |
| 参数 schema | `{ type: "object", properties: {}, required: [] }` |
| 默认值 | page=1, page_size=10 |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ records: [{ id, item_name, points_cost, redeemed_at, status }], total: int }` |
| LLM 调用时机 | 用户问"我兑换过什么""兑换记录" |

#### 3.2.7 get_growth_timeline

| 项 | 值 |
|----|-----|
| 描述 | 查询成长时间线(任务/兑换/积分事件聚合) |
| 对应 Service | `GrowthService.Timeline(childID, familyID uint, days int) ([]map[string]interface{}, error)` |
| 参数 schema | `{ type: "object", properties: { days: { type: "integer" } }, required: [] }` |
| 默认值 | days=30 |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ events: [{ date, type, title, points }], summary: { task_count, total_points, redeem_count } }` |
| 截断 | 超过 500 字截断,附"如需详情请查看成长页" |
| LLM 调用时机 | 用户问"最近做了什么""这段时间的成长" |

#### 3.2.8 get_growth_album

| 项 | 值 |
|----|-----|
| 描述 | 查询成长相册(含照片的任务) |
| 对应 Service | `GrowthService.Album(childID, familyID uint, page, pageSize int) ([]model.Task, int64, error)` |
| 参数 schema | `{ type: "object", properties: {}, required: [] }` |
| 默认值 | page=1, page_size=10 |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ photos: [{ task_id, title, photo_url, created_at }], total: int }` |
| LLM 调用时机 | 用户问"我的相册""成长照片" |

#### 3.2.9 get_current_cycle

| 项 | 值 |
|----|-----|
| 描述 | 查询当前成长周期与阶段目标 |
| 对应 Service | `GrowthCycleService.GetCurrentCycle(childID, familyID uint) (*model.GrowthCycle, []model.Goal, error)` |
| 参数 schema | `{ type: "object", properties: {}, required: [] }` |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ cycle: { id, name, start_date, end_date, status }, goals: [{ dimension_id, dimension_name, target_score, current_score }] }` |
| LLM 调用时机 | 用户问"当前目标""周期进度""这周要提升什么" |
| 富文本高亮 | 目标分值 + 当前分值 |
| 示例 | 用户"当前目标是什么" → tool 返回周期+2个目标 → LLM "本周期的目标是:独立自主 **80**分(当前 **72**),动手实践 **75**分(当前 **68**),还差一点点!" |

#### 3.2.10 get_cycle_progress

| 项 | 值 |
|----|-----|
| 描述 | 查询周期内目标进度对比 |
| 对应 Service | `GrowthCycleService.GetCycleProgress(cycleID uint) ([]map[string]interface{}, error)` |
| 参数 schema | `{ type: "object", properties: { cycle_id: { type: "integer" } }, required: ["cycle_id"] }` |
| 权限 | 需 family_id 鉴权(tool 实现层需校验 cycle 属于当前 family) |
| 返回值 | `{ progress: [{ dimension_name, target_score, current_score, progress_percent }] }` |
| 安全注意 | 原 Service 方法仅凭 cycleID,tool 实现层须补 familyID 校验 |
| LLM 调用时机 | 用户追问周期进度详情 |

#### 3.2.11 list_growth_stories

| 项 | 值 |
|----|-----|
| 描述 | 查询历史成长故事列表 |
| 对应 Service | `GrowthStoryService.ListStories(childID, familyID uint, page, pageSize int) ([]model.GrowthStory, int64, error)` |
| 参数 schema | `{ type: "object", properties: {}, required: [] }` |
| 默认值 | page=1, page_size=5 |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ stories: [{ id, cycle_id, title, generated_at, preview }], total: int }` |
| LLM 调用时机 | 用户问"以前的成长故事""上次回顾" |

#### 3.2.12 list_master_challenges

| 项 | 值 |
|----|-----|
| 描述 | 查询儿童的大师挑战实例列表 |
| 对应 Service | `MasterChallengeService.GetInstances(childID, familyID uint) ([]model.MasterChallengeInstance, error)` |
| 参数 schema | `{ type: "object", properties: {}, required: [] }` |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ instances: [{ id, template_title, status, current_stage, total_stages, started_at }] }` |
| LLM 调用时机 | 用户问"大师挑战""我的项目" |

#### 3.2.13 list_activities

| 项 | 值 |
|----|-----|
| 描述 | 查询公益活动列表 |
| 对应 Service | `ActivityService.ListActivities(p ListActivitiesParams) ([]model.CharityActivity, int64, error)` |
| 参数 schema | `{ type: "object", properties: {}, required: [] }` |
| 默认值 | page=1, page_size=10 |
| 权限 | 家长/儿童均可 |
| 返回值 | `{ activities: [{ id, title, location, start_time, participants_count, max_participants, points }], total: int }` |
| 安全注意 | 原 Service 无家庭隔离(全局列表),tool 实现层须过滤敏感字段(如 organizer_id) |
| LLM 调用时机 | 用户问"有什么公益活动""能参加什么" |

### 3.3 写操作工具详细规格(P1,需 UI 二次确认)

#### 3.3.1 submit_task

| 项 | 值 |
|----|-----|
| 描述 | 提交任务验收 |
| 对应 Service | `TaskService.SubmitTask(id, familyID uint, photo string) (*model.Task, error)` |
| 参数 schema | `{ type: "object", properties: { task_id: { type: "integer" }, photo: { type: "string" } }, required: ["task_id"] }` |
| 权限 | 家长/儿童均可 |
| 确认卡片标题 | "确认提交任务" |
| 确认卡片正文 | "任务:**{task_title}**,提交后将进入家长审核状态" |
| 确认按钮文案 | "确认提交" |
| 取消按钮文案 | "取消" |
| 确认后 REST API | `POST /tasks/:id/submit`(body: `{ photo?: string }`) |
| 返回值(确认后) | `{ task: { id, status: "submitted" }, success: bool }` |
| LLM 调用时机 | 用户说"我完成了洗碗""提交任务" |

#### 3.3.2 redeem_item

| 项 | 值 |
|----|-----|
| 描述 | 兑换商城商品 |
| 对应 Service | `RedeemService.Redeem(itemID, childID, familyID uint) (*model.Redeem, int, error)` |
| 参数 schema | `{ type: "object", properties: { item_id: { type: "integer" } }, required: ["item_id"] }` |
| 权限 | 家长/儿童均可 |
| 确认卡片标题 | "确认兑换" |
| 确认卡片正文 | "商品:**{item_name}**,扣除 **{points_required}** 积分,当前余额 **{balance}**" |
| 确认按钮文案 | "确认兑换" |
| 取消按钮文案 | "取消" |
| 确认后 REST API | `POST /redeem/:id` |
| 返回值(确认后) | `{ redeem_id: int, new_balance: int, success: bool }` |
| LLM 调用时机 | 用户说"我要兑换小风扇""兑换那个100积分的绘本" |

#### 3.3.3 set_stage_goal

| 项 | 值 |
|----|-----|
| 描述 | 设置阶段目标(家长专属) |
| 对应 Service | `GrowthCycleService.SetGoal(cycleID, familyID, childID, dimensionID uint, targetScore int) (*model.Goal, error)` |
| 参数 schema | `{ type: "object", properties: { cycle_id: { type: "integer" }, dimension_id: { type: "integer" }, target_score: { type: "integer" } }, required: ["cycle_id", "dimension_id", "target_score"] }` |
| 权限 | **仅家长** |
| 确认卡片标题 | "设置阶段目标" |
| 确认卡片正文 | "周期:**{cycle_name}**,目标维度:**{dimension_name}**,目标分值:**{target_score}**" |
| 确认按钮文案 | "确认设置" |
| 取消按钮文案 | "取消" |
| 确认后 REST API | `POST /growth-cycle/goal` |
| 儿童权限降级 | 卡片置灰 + 提示"需要请家长帮忙设置目标" |
| LLM 调用时机 | 家长说"给小明设定这周的目标""把独立自主目标设为80" |

#### 3.3.4 create_cycle

| 项 | 值 |
|----|-----|
| 描述 | 创建新的成长周期(家长专属) |
| 对应 Service | `GrowthCycleService.CreateCycle(familyID, childID uint, name string, startDate, endDate time.Time) (*model.GrowthCycle, error)` |
| 参数 schema | `{ type: "object", properties: { name: { type: "string" }, start_date: { type: "string", format: "date" }, end_date: { type: "string", format: "date" } }, required: ["name", "start_date", "end_date"] }` |
| 权限 | **仅家长** |
| 确认卡片标题 | "创建成长周期" |
| 确认卡片正文 | "周期名:**{name}**,周期:**{start_date}** 至 **{end_date}**" |
| 确认按钮文案 | "确认创建" |
| 取消按钮文案 | "取消" |
| 确认后 REST API | `POST /growth-cycle` |
| 儿童权限降级 | 卡片置灰 + 提示"需要请家长帮忙创建周期" |
| LLM 调用时机 | 家长说"创建一个新的成长周期""开始新一轮目标" |

#### 3.3.5 adjust_score

| 项 | 值 |
|----|-----|
| 描述 | 手动调整积分(家长专属,奖惩) |
| 对应 Service | `ScoreService.Adjust(childID, familyID, createdBy uint, delta int, title, description, photo string) (int, error)` |
| 参数 schema | `{ type: "object", properties: { delta: { type: "integer" }, title: { type: "string" }, description: { type: "string" } }, required: ["delta", "title"] }` |
| 权限 | **仅家长** |
| 确认卡片标题 | delta > 0 ? "确认奖励积分" : "确认扣除积分" |
| 确认卡片正文 | "**{title}**,**{abs(delta)}** 积分,当前余额 **{balance}**" |
| 确认按钮文案 | "确认" |
| 取消按钮文案 | "取消" |
| 确认后 REST API | `POST /score/adjust` |
| 儿童权限降级 | 卡片置灰 + 提示"需要请家长操作" |
| LLM 调用时机 | 家长说"奖励小明10积分""扣5积分因为没完成作业" |

### 3.4 禁止暴露清单(本次不实施)

| Service 方法 | 禁止理由 |
|-------------|---------|
| `AbilityService.ReassessScores` | 内部方法,阶段回顾专属,会覆盖写入六维分 |
| `AbilityService.AwardTaskCompletion` | 内部方法,任务完成时由 ReviewTask 内部调用 |
| `AbilityService.AddScoreForDimension` | 内部方法,问卷服务专属 |
| `AbilityService.AwardMasteryStar` | 内部方法,大师挑战 Review 内部调用 |
| `GrowthStoryService.GenerateStory` | 阶段回顾专属,走专门 UI 流程(成长页"阶段回顾"按钮) |
| `GrowthStoryService.GenerateProjectStory` | **缺 familyID 鉴权**,仅凭 instanceID |
| `MasterChallengeService.UpdateStage` | **缺 familyID 鉴权**,仅凭 stageID |
| `MasterChallengeService.SubmitForReview` | **缺 familyID 鉴权**,仅凭 instanceID |
| `MasterChallengeService.Review` | **缺 familyID 鉴权** + 通过时四项副作用一气呵成(加积分+写Transaction+AwardMasteryStar+生成故事) |
| `CommunityService.CompleteDonation` | **缺 familyID 鉴权**,仅凭 donationID |
| `QuestionnaireService.SubmitAnswers` | 无幂等保护,一调用即发积分+累加能力分 |
| 所有 `Delete*` 方法 | 危险操作,不通过 AI 暴露 |
| `ChildService.UpdateChild` / `DeleteChild` | 危险操作,不通过 AI 暴露 |

---

## 4. 写操作确认流程(UI 层)

### 4.1 suggested_actions 响应结构定义

```typescript
interface ActionSuggestion {
  action: string;          // 动作类型,如 "submit_task" / "redeem_item"
  params: object;          // 动作参数,如 { task_id: 123 }
  summary: string;         // 卡片正文摘要,如 "任务:洗碗,提交后将进入家长审核"
  confirm_text: string;    // 确认按钮文案,如 "确认提交"
  cancel_text: string;     // 取消按钮文案,如 "取消"
  api_endpoint: string;    // 确认后调用的 REST API,如 "/tasks/123/submit"
  api_method: string;      // HTTP 方法,如 "POST"
  api_body?: object;       // 请求体,如 { photo: "..." }
  requires_parent?: boolean; // 是否需要家长权限
}
```

### 4.2 ActionConfirmCard 组件规格

| 属性 | 值 |
|------|-----|
| 位置 | AI 气泡下方,独立卡片(非气泡内) |
| 容器 | `bg-card border-2 border-primary rounded-lg p-4 mt-1` |
| 标题 | `text-sm font-bold text-foreground` |
| 正文 | `text-sm text-muted-foreground mt-1`(支持富文本高亮) |
| 按钮组 | `flex gap-2 mt-3` |
| 取消按钮 | `flex-1 h-10 rounded-lg bg-muted text-muted-foreground text-sm font-medium` |
| 确认按钮 | `flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium` |
| 状态机 | pending → executing → success / failed |
| executing 态 | 确认按钮显示 spinner + 禁用,文案改为"执行中..." |
| success 态 | 卡片变 `bg-state-success/10 border-state-success`,显示"✓ 已完成" |
| failed 态 | 卡片变 `bg-state-error/10 border-state-error`,显示"✗ 失败:{error}"+ 重试按钮 |
| 置灰态(儿童权限降级) | 整卡片 `opacity-60`,确认按钮禁用,底部提示"需要请家长操作" |

### 4.3 确认后调用链路

```
用户点确认按钮
  → 前端将卡片状态置为 executing
  → 前端直接调 api_endpoint(走 JWT 鉴权,不经 AI 链路)
  → 成功:
      → 卡片状态置为 success
      → 刷新相关数据(如余额/任务列表)
      → AI 发送一条后续消息引用执行结果(如"已成功提交洗碗任务,等家长审核哦~")
  → 失败:
      → 卡片状态置为 failed
      → 显示错误信息 + 重试按钮
```

### 4.4 取消链路

```
用户点取消按钮
  → 卡片状态置为 failed(或单独的 cancelled 态,视觉同 failed 但文案"已取消")
  → AI 发送一条后续消息"已取消,有需要再告诉我"
  → 卡片不再可交互
```

### 4.5 多个 suggested_actions 的处理

| 场景 | 处理方式 |
|------|---------|
| AI 返回多个建议动作 | 顺序排列多个 ActionConfirmCard,各自独立确认 |
| 用户先确认第 2 个 | 允许乱序确认,各卡片独立 |
| 一个动作确认后影响其他动作(如兑换后余额不足) | 后续卡片在用户确认时重新校验,失败则显示"余额不足" |

### 4.6 权限校验(儿童角色)

```
儿童角色收到 requires_parent=true 的 suggested_action
  → 卡片置灰(opacity-60)
  → 确认按钮禁用
  → 底部提示"需要请家长帮忙操作"
  → 不直接拒绝(避免对话断裂)
  → AI 文字回复:"这个操作需要家长帮忙,你可以请爸爸妈妈来操作哦~"
```

### 4.7 确认卡片有效期

- 卡片创建后 **24 小时**未确认自动失效,卡片变灰 + 提示"已过期,请重新询问"。
- 失效后不可再确认,需用户重新对话触发 AI 生成新的 suggested_action。

---

## 5. 意图识别升级

### 5.1 旧 detectIntent 的局限

当前 [chat_service.go:144 detectIntent](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/backend/internal/service/chat_service.go#L144) 基于关键词匹配:

```go
if strings.Contains(msg, "积分") { return "query_points" }
```

局限:
1. 无法理解复合意图("帮我看看还要做啥任务才能凑够积分兑换绘本")
2. 无法处理口语化表达("我那个洗碗的活干完了")
3. 仅打标签,不驱动动作执行

### 5.2 新模式:LLM 自主选择 tool

v3.2 中,意图识别由 LLM 基于 tool 描述自主完成。LLM 根据用户消息 + tool 的 `description` 字段决定是否调用 tool 及调用哪个 tool。无需后端关键词匹配。

### 5.3 detectIntent 保留职责(降级)

`detectIntent` **不退役**,但职责降级为**仅用于前端 IP 表情切换**,且从 `tool_name` 反推而非关键词:

```go
func intentFromToolName(toolName string) string {
    switch toolName {
    case "submit_task": return "submit_task"
    case "query_child_balance": return "query_points"
    case "query_child_scores", "get_current_cycle": return "query_ability"
    case "redeem_item", "list_redeem_items": return "query_reward"
    case "set_stage_goal", "create_cycle", "adjust_score": return "parent_set_goal"
    case "": return "chat"  // 无 tool 调用
    default: return "query_task"  // 其他查询类
    }
}
```

### 5.4 意图 → IP 表情映射表(更新版)

| tool_name | intent | IP 表情 |
|-----------|--------|---------|
| `submit_task` | submit_task | proud |
| `query_child_balance` | query_points | think |
| `query_child_scores` | query_ability | encourage |
| `get_current_cycle` | query_ability | encourage |
| `list_tasks` | query_task | happy |
| `get_task_detail` | query_task | happy |
| `list_redeem_items` | query_reward | surprised |
| `list_redeem_records` | query_reward | surprised |
| `redeem_item` | query_reward | surprised |
| `get_growth_timeline` | query_ability | encourage |
| `get_growth_album` | query_ability | encourage |
| `list_growth_stories` | parent_review | proud |
| `list_master_challenges` | query_task | happy |
| `list_activities` | query_task | happy |
| `set_stage_goal` | parent_set_goal | proud |
| `create_cycle` | parent_set_goal | proud |
| `adjust_score` | parent_set_goal | proud |
| (无 tool 调用) | chat | happy |

---

## 6. 上下文构造策略变化

### 6.1 buildSystemPrompt 精简前后对照

| 注入项 | 旧(v3.1) | 新(v3.2) | 说明 |
|--------|----------|----------|------|
| IP 身份 | ✓ | ✓ | 保留("你是小萌芽,GrowPocket 的 AI 成长助理") |
| 对话者角色 | ✓ | ✓ | 保留(parent/child) |
| 角色权限说明 | ✓ | ✓ | 保留(儿童不可执行家长专属操作) |
| child_id / family_id | ✗ | ✓ | **新增**(供 tool 执行时鉴权) |
| 孩子姓名+余额 | ✓ | ✗ | **移除**(改由 query_child_balance tool) |
| 六维得分+成长指数 | ✓ | ✗ | **移除**(改由 query_child_scores tool) |
| 最近 5 条任务 | ✓ | ✗ | **移除**(改由 list_tasks tool) |
| 家长目标设置引导 | ✓ | ✓ | 保留(但改为"可通过 set_stage_goal tool 协助") |

### 6.2 精简后 system prompt 模板

```
你是「小萌芽」,GrowPocket 的 AI 成长助理,一个温暖的种子精灵。
你的角色是陪伴 6-12 岁儿童成长。
当前对话者角色:{userRole}(parent=家长,child=儿童)。
当前儿童 ID:{childID},家庭 ID:{familyID}。
回答要简洁、温暖、富有鼓励性。
如果家长请求设置目标或回顾,你可以调用对应工具协助。
注意:当前用户是儿童时,不能执行家长专属操作(设置目标、调整积分、创建周期),
若儿童请求这些操作,温柔地告诉他们需要请家长帮忙。
```

预估 token 数:< 200。

### 6.3 上下文膨胀控制

| 场景 | 策略 |
|------|------|
| tool 返回结果 > 500 字 | 截断 + 附"如需详情请追问" |
| 历史消息 > 10 条 | 截断早期历史(保留最近 10 条,含 tool 结果) |
| tool 定义本身 | 13 个只读工具约 800 tokens,5 个写工具约 400 tokens |

### 6.4 多轮对话上下文

- 保留最近 10 条历史消息(含 tool 调用结果)。
- tool 调用结果以 `tool` role 消息存入历史,供后续轮次引用。
- 写操作确认结果(成功/失败)不入历史(因为写操作走前端 REST API,不经 AI 链路);AI 后续消息由前端在确认成功后触发一条新的用户消息(如"已成功提交任务")。

---

## 7. 安全与权限模型

### 7.1 工具执行鉴权三要素

| 要素 | 来源 | 用途 |
|------|------|------|
| `family_id` | JWT token | 家庭隔离,跨 family 拒绝 |
| `child_id` | 当前会话(ChatSession.child_id) | 儿童隔离,同 family 内可切换 |
| `user_role` | user 表(user.Role) | 权限区分(parent/child) |

### 7.2 只读工具权限

- 同一 family 内:可查任意 child 数据。
- 跨 family:拒绝(返回空结果或错误)。
- 全局列表类(`list_activities`):tool 实现层过滤敏感字段(如 organizer_id),仅返回公开字段。

### 7.3 写操作工具权限矩阵

| 工具 | 家长 | 儿童 | 儿童降级处理 |
|------|------|------|-------------|
| `submit_task` | ✓ | ✓ | — |
| `redeem_item` | ✓ | ✓ | — |
| `set_stage_goal` | ✓ | ✗ | 卡片置灰 + "需要请家长帮忙设置目标" |
| `create_cycle` | ✓ | ✗ | 卡片置灰 + "需要请家长帮忙创建周期" |
| `adjust_score` | ✓ | ✗ | 卡片置灰 + "需要请家长操作" |

### 7.4 禁止暴露的安全缺口清单(本次不修复,仅记录)

| Service 方法 | 缺口 | 修复建议(未来) |
|-------------|------|---------------|
| `MasterChallengeService.UpdateStage` | 仅凭 stageID,无 familyID | 补 familyID 参数 + 校验 stage 属于当前 family |
| `MasterChallengeService.SubmitForReview` | 仅凭 instanceID | 同上 |
| `MasterChallengeService.Review` | 仅凭 submissionID | 同上 |
| `CommunityService.CompleteDonation` | 仅凭 donationID | 补 familyID 参数 + 校验 |
| `GrowthStoryService.GenerateProjectStory` | 仅凭 instanceID | 补 familyID 参数 + 校验 |
| `GrowthCycleService.GetCycleProgress` | 仅凭 cycleID(读操作) | 补 familyID 参数 + 校验(tool 实现层已临时补) |
| `CommunityService.GetChildByID` | 无家庭隔离 | 移除或加 familyID 校验 |

### 7.5 审计日志

写操作 tool 调用全量记录:

| 字段 | 说明 |
|------|------|
| `tool_name` | 工具名 |
| `params` | 调用参数(JSON) |
| `executor_user_id` | 执行人(从 JWT) |
| `child_id` | 目标儿童 |
| `family_id` | 目标家庭 |
| `result` | 成功/失败 |
| `error_message` | 失败原因(若失败) |
| `created_at` | 时间戳 |

审计日志存储于新表 `ai_tool_audit`(详见第 8 节)。

---

## 8. 数据模型与接口变更

### 8.1 ChatMessage 模型扩展

在现有 [chat_message.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-ai-assistant-module-content-kDUOiL/backend/internal/model/chat_message.go) 基础上新增字段:

| 字段 | 类型 | 用途 |
|------|------|------|
| `tool_calls` | `text`(JSON) | LLM 返回的 tool 调用请求(存原始 JSON) |
| `tool_call_id` | `string` | 关联 tool 执行结果消息(OpenAI 协议字段) |
| `suggested_actions` | `text`(JSON) | 建议动作数组(供前端渲染确认卡片) |

### 8.2 POST /chat/message 响应体扩展

**旧响应体**:
```json
{ "reply": "...", "intent": "...", "session_id": 123 }
```

**新响应体**:
```json
{
  "reply": "...",
  "intent": "...",
  "session_id": 123,
  "suggested_actions": [
    {
      "action": "submit_task",
      "params": { "task_id": 123 },
      "summary": "任务:洗碗,提交后将进入家长审核状态",
      "confirm_text": "确认提交",
      "cancel_text": "取消",
      "api_endpoint": "/tasks/123/submit",
      "api_method": "POST",
      "api_body": {},
      "requires_parent": false
    }
  ]
}
```

`suggested_actions` 可选字段,仅当 AI 返回写操作建议时存在;查询类回复不含此字段。

### 8.3 新增接口

| 接口 | 方法 | 用途 |
|------|------|------|
| `/chat/message/confirm` | `POST` | 前端确认写操作后调用,记录确认动作(用于审计) |

**POST /chat/message/confirm 请求体**:
```json
{
  "message_id": 123,
  "action": "submit_task",
  "params": { "task_id": 123 },
  "result": "success",
  "api_response": { ... }
}
```

此接口仅用于记录审计日志,**不执行实际写操作**(实际写操作由前端直接调 `api_endpoint`)。

### 8.4 现有 REST API 复用

写操作确认后,前端直接调用以下现有 REST API(走 JWT 鉴权):

| suggested_action.action | REST API | 方法 |
|------------------------|----------|------|
| submit_task | `/tasks/:id/submit` | POST |
| redeem_item | `/redeem/:id` | POST |
| set_stage_goal | `/growth-cycle/goal` | POST |
| create_cycle | `/growth-cycle` | POST |
| adjust_score | `/score/adjust` | POST |

### 8.5 新增数据模型:AIAuditLog

```go
type AIAuditLog struct {
    ID            uint      `gorm:"primaryKey" json:"id"`
    FamilyID      uint      `gorm:"index;not null" json:"family_id"`
    ChildID       uint      `gorm:"index" json:"child_id"`
    UserID        uint      `gorm:"not null" json:"user_id"`
    SessionID     uint      `gorm:"index" json:"session_id"`
    MessageID     uint      `gorm:"index" json:"message_id"`
    ToolName      string    `gorm:"size:50;not null" json:"tool_name"`
    Params        string    `gorm:"type:text" json:"params"`
    Result        string    `gorm:"size:20" json:"result"` // success/failed/cancelled/expired
    ErrorMessage  string    `gorm:"type:text" json:"error_message"`
    CreatedAt     time.Time `json:"created_at"`
}
```

---

## 9. 功能需求清单(FR-AI-FC-xxx)

### 9.1 只读工具需求(FR-AI-FC-001 ~ 013)

| 编号 | 工具 | 描述 | 验收标准 |
|------|------|------|---------|
| FR-AI-FC-001 | query_child_balance | 查询积分余额 | LLM 问"积分"时调用,返回 balance+nickname |
| FR-AI-FC-002 | query_child_scores | 查询六维得分+成长指数 | 返回六维分+成长指数,LLM 能指出短板 |
| FR-AI-FC-003 | list_tasks | 查询任务列表(支持状态筛选) | 默认返回待完成任务,支持 status 参数 |
| FR-AI-FC-004 | get_task_detail | 查询单个任务详情 | 需 task_id 参数 |
| FR-AI-FC-005 | list_redeem_items | 查询商城商品 | 解决 v3.1 query_reward 无数据支撑问题 |
| FR-AI-FC-006 | list_redeem_records | 查询兑换记录 | — |
| FR-AI-FC-007 | get_growth_timeline | 查询成长时间线 | 默认 30 天,超 500 字截断 |
| FR-AI-FC-008 | get_growth_album | 查询成长相册 | — |
| FR-AI-FC-009 | get_current_cycle | 查询当前周期+目标 | 返回 cycle+goals |
| FR-AI-FC-010 | get_cycle_progress | 查询周期进度 | tool 实现层补 familyID 鉴权 |
| FR-AI-FC-011 | list_growth_stories | 查询成长故事列表 | — |
| FR-AI-FC-012 | list_master_challenges | 查询大师挑战实例 | — |
| FR-AI-FC-013 | list_activities | 查询公益活动列表 | 过滤敏感字段 |

### 9.2 写操作工具需求(FR-AI-FC-014 ~ 018)

| 编号 | 工具 | 描述 | 验收标准 |
|------|------|------|---------|
| FR-AI-FC-014 | submit_task | 提交任务验收 | 返回 suggested_action,确认后调 POST /tasks/:id/submit |
| FR-AI-FC-015 | redeem_item | 兑换商品 | 返回 suggested_action 含余额提示,确认后调 POST /redeem/:id |
| FR-AI-FC-016 | set_stage_goal | 设置阶段目标(家长专属) | 儿童收到时卡片置灰 |
| FR-AI-FC-017 | create_cycle | 创建周期(家长专属) | 儿童收到时卡片置灰 |
| FR-AI-FC-018 | adjust_score | 调整积分(家长专属) | 儿童收到时卡片置灰 |

### 9.3 架构改造需求(FR-AI-FC-019 ~ 024)

| 编号 | 功能 | 描述 | 验收标准 |
|------|------|------|---------|
| FR-AI-FC-019 | AIService 支持 function calling | 新增 ChatWithTools 方法,支持 tool_calls 循环 | 循环上限 3 次,finish_reason=stop 时结束 |
| FR-AI-FC-020 | ChatService 工具注册表 | toolRegistry map 集中管理工具定义与执行 | 新增工具仅需注册,不改分发器 |
| FR-AI-FC-021 | buildSystemPrompt 精简 | 移除数据快照注入,仅保留身份+角色+child_id/family_id | system prompt < 200 tokens |
| FR-AI-FC-022 | POST /chat/message 响应体扩展 | 新增 suggested_actions 字段 | 仅写操作回复含此字段 |
| FR-AI-FC-023 | ActionConfirmCard 前端组件 | AI 气泡下方确认卡片 | 含 pending/executing/success/failed 四态 |
| FR-AI-FC-024 | 写操作审计日志 | AIAuditLog 模型 + 全量记录 | 含 tool_name/params/executor/result |

### 9.4 三向需求对照表

| v3 高层(FR-AI-xxx) | v3.1 UI 层(FR-AI-UI-xxx) | v3.2 能力调用层(FR-AI-FC-xxx) |
|---------------------|--------------------------|-------------------------------|
| FR-AI-001 助手 Tab 默认首页 | FR-AI-UI-001 固定页眉 | — |
| FR-AI-002 IP 形象对话头像 | FR-AI-UI-002 双位置头像 | — |
| FR-AI-003 对话上下文自动构造 | — | FR-AI-FC-021 buildSystemPrompt 精简 |
| FR-AI-004 查询/提交任务意图 | FR-AI-UI-004 快捷短语 | FR-AI-FC-003 list_tasks + FR-AI-FC-014 submit_task |
| FR-AI-005 查询积分/能力意图 | FR-AI-UI-008 富文本高亮 | FR-AI-FC-001 query_child_balance + FR-AI-FC-002 query_child_scores |
| FR-AI-006 家长设置阶段目标 | — | FR-AI-FC-016 set_stage_goal + FR-AI-FC-017 create_cycle |
| FR-AI-007 对话历史保存 | FR-AI-UI-009 历史抽屉 | — |
| FR-AI-008 角色权限区分 | FR-AI-UI-010 儿童切换 | FR-AI-FC-023 ActionConfirmCard 权限降级 |
| — | — | FR-AI-FC-005 list_redeem_items(解决 query_reward 无数据) |
| — | — | FR-AI-FC-018 adjust_score(家长奖惩) |
| — | — | FR-AI-FC-019~024 架构改造 |

---

## 10. 实施分期

### Phase 1(P0):只读工具接入 + AIService 改造

| 任务 | 说明 |
|------|------|
| AIService.ChatWithTools | 新增支持 tool_calls 循环的方法 |
| ChatService.toolRegistry | 13 个只读工具注册 |
| ChatService.executeToolCall | 工具执行分发器 |
| buildSystemPrompt 精简 | 移除数据快照注入 |
| detectIntent 降级 | 改为从 tool_name 反推表情 |
| 13 个只读工具实现 | 每个 tool 包装对应 Service 方法 |

**Phase 1 交付价值**:
- 解决 query_reward 无数据支撑问题(list_redeem_items)
- 解决任务列表不筛选状态问题(list_tasks 支持 status)
- 解决快照式数据问题(按需拉取,实时数据)
- AI 能力从"3 类快照"扩展到"13 项查询能力"

### Phase 2(P1):写操作工具 + UI 二次确认

| 任务 | 说明 |
|------|------|
| 5 个写操作工具注册 | submit_task/redeem_item/set_stage_goal/create_cycle/adjust_score |
| suggested_actions 响应结构 | POST /chat/message 响应体扩展 |
| ActionConfirmCard 组件 | 前端确认卡片(四态机) |
| POST /chat/message/confirm | 审计日志接口 |
| AIAuditLog 模型 | 审计日志表 |
| 儿童权限降级 | 卡片置灰逻辑 |

**Phase 2 交付价值**:
- AI 从"仅查询"扩展到"查询+提议写操作"
- 写操作经 UI 二次确认,保留完整鉴权
- 审计日志可追溯

### Phase 3(P2):安全缺口修复 + 扩展工具

| 任务 | 说明 |
|------|------|
| MasterChallengeService 补 familyID | UpdateStage/SubmitForReview/Review |
| CommunityService.CompleteDonation 补 familyID | — |
| GrowthStoryService.GenerateProjectStory 补 familyID | — |
| 补鉴权后开放大师挑战写工具 | 新增 start_master_challenge / update_stage / submit_for_review 工具 |
| CommunityService.GetChildByID 加家庭隔离 | — |

**Phase 3 交付价值**:
- 安全缺口修复
- AI 能力扩展到大师挑战全流程

---

## 附录

### 附录 A:工具清单总表

| 工具名 | 类型 | 对应 Service 方法 | 权限 | 优先级 |
|--------|------|------------------|------|--------|
| query_child_balance | 只读 | ScoreService.GetBalance | 家长/儿童 | P0 |
| query_child_scores | 只读 | AbilityService.GetChildScores + GetGrowthIndex | 家长/儿童 | P0 |
| list_tasks | 只读 | TaskService.ListTasks | 家长/儿童 | P0 |
| get_task_detail | 只读 | TaskService.GetTask | 家长/儿童 | P0 |
| list_redeem_items | 只读 | RedeemService.ListItems | 家长/儿童 | P0 |
| list_redeem_records | 只读 | RedeemService.GetRedeems | 家长/儿童 | P0 |
| get_growth_timeline | 只读 | GrowthService.Timeline | 家长/儿童 | P0 |
| get_growth_album | 只读 | GrowthService.Album | 家长/儿童 | P0 |
| get_current_cycle | 只读 | GrowthCycleService.GetCurrentCycle | 家长/儿童 | P0 |
| get_cycle_progress | 只读 | GrowthCycleService.GetCycleProgress | 家长/儿童(需补鉴权) | P0 |
| list_growth_stories | 只读 | GrowthStoryService.ListStories | 家长/儿童 | P0 |
| list_master_challenges | 只读 | MasterChallengeService.GetInstances | 家长/儿童 | P0 |
| list_activities | 只读 | ActivityService.ListActivities | 家长/儿童 | P0 |
| submit_task | 写 | TaskService.SubmitTask | 家长/儿童 | P1 |
| redeem_item | 写 | RedeemService.Redeem | 家长/儿童 | P1 |
| set_stage_goal | 写 | GrowthCycleService.SetGoal | 仅家长 | P1 |
| create_cycle | 写 | GrowthCycleService.CreateCycle | 仅家长 | P1 |
| adjust_score | 写 | ScoreService.Adjust | 仅家长 | P1 |

### 附录 B:三向需求对照关系

详见第 9.4 节。

### 附录 C:现状偏差说明

#### C.1 buildSystemPrompt 精简前后对照

| 注入项 | 当前(v3.1) | v3.2 | 变更 |
|--------|------------|------|------|
| IP 身份 | ✓ | ✓ | 保留 |
| 对话者角色 | ✓ | ✓ | 保留 |
| 角色权限说明 | ✓ | ✓ | 保留 |
| child_id / family_id | ✗ | ✓ | 新增 |
| 孩子姓名+余额 | ✓ | ✗ | 移除(改 tool) |
| 六维得分+成长指数 | ✓ | ✗ | 移除(改 tool) |
| 最近 5 条任务 | ✓ | ✗ | 移除(改 tool) |
| 家长目标设置引导 | ✓ | ✓ | 保留(措辞调整) |

#### C.2 detectIntent 降级前后职责对照

| 职责 | 当前(v3.1) | v3.2 |
|------|------------|------|
| 意图识别 | 关键词匹配 | LLM 自主选择 tool |
| 动作路由 | 不路由(仅打标签) | LLM 自主调 tool |
| IP 表情切换 | 从关键词反推 | 从 tool_name 反推 |
| 存库 | intent 字段 | intent 字段(保留) |

### 附录 D:风险与缓解措施表

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LLM 不支持 tool_calls | 架构无法实施 | 降级为"prompt 注入工具描述 + LLM 输出 JSON"模式(单独评估) |
| LLM 误调用写工具 | 用户被意外扣分 | 写操作必须经 UI 二次确认,AI 不直接执行 |
| tool_calls 循环无限 | 后端卡死 | 循环上限 3 次,超出强制返回 |
| tool 返回数据过大 | 上下文超 4000 tokens | 超 500 字截断 + 提示追问 |
| 儿童绕过权限 | 执行家长操作 | 前端卡片置灰 + 后端 REST API 鉴权(双重) |
| 快照与实时数据不一致 | AI 引用旧数据 | v3.2 按需拉取,无快照问题 |
| 安全缺口被利用 | 越权访问 | 禁止暴露缺鉴权方法(第 7.4 节) |
| 审计日志缺失 | 无法追溯 | AIAuditLog 全量记录写操作 |

---

## 关键决策点汇总

1. **tool_calls 循环上限**:3 次(防无限循环)
2. **tool 返回结果截断**:500 字
3. **写操作确认卡片有效期**:24 小时
4. **儿童权限降级**:卡片置灰,不直接拒绝
5. **保留 detectIntent**:仅用于 IP 表情,不影响 tool 路由
6. **buildSystemPrompt 不完全退役**:精简但保留
7. **tool 定义来源**:ChatService.toolRegistry map 集中管理
8. **富文本高亮规则**:沿用 v3.1 `font-bold text-primary`
