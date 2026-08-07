# 任务标签、详情增强与时间穿越测试 Spec

## Why
当前任务卡片和详情页的信息密度不足：任务标签仅显示「AI 生成」一类，习惯/主题/家长陪伴等类型缺乏统一标签；parent 任务详情没有阶段流水展示，用户难以感知主题推进进度；daily 任务详情缺少累计统计和目标关联上下文。此外，开发阶段缺少快速验证多日推进、阶段过渡的测试手段，每次只能等真实时间流逝或手动改库。

## What Changes
- **任务标签系统统一**：TaskCard 和 TaskDetailPage 根据任务属性自动展示彩色标签（AI 生成/习惯养成/主题任务/关键里程碑/家长陪伴/手动创建）
- **主题任务详情阶段流水**：parent 任务详情页新增「阶段流水」区块，含时间线（已完成/进行中/未开始）、整体进度条、关键里程碑专区
- **每日任务详情累计统计**：daily 任务详情页新增「本周期累计」区块（累计完成任务数、累计积分、关联能力维度、周期目标）
- **时间穿越测试功能**：后端引入虚拟时钟 `timeutil.Now()`，新增 debug API 推进/重置时间；前端设置页新增调试入口（仅开发环境显示）

## Impact
- Affected specs: task-system-upgrade（任务系统升级，扩展详情展示）
- Affected code:
  - 前端：`frontend/src/components/TaskCard.tsx`、`frontend/src/pages/TaskDetailPage.tsx`、`frontend/src/pages/SettingsPage.tsx`（或新增调试入口）
  - 前端 services：新增 `debug.ts` 封装时间穿越 API
  - 后端：新增 `backend/internal/util/timeutil/timeutil.go` 虚拟时钟包
  - 后端：`habit_service.go`、`task_generation_service.go`、`task_service.go` 中 `time.Now()` 替换为 `timeutil.Now()`
  - 后端：新增 `debug_handler.go` 提供 advance-time / reset-time / get-time 接口
  - 后端：`cmd/main.go` 注册 debug 路由（仅当 `APP_ENV=development` 时启用）

## ADDED Requirements

### Requirement: 任务标签统一展示
系统 SHALL 在任务卡片和任务详情页顶部根据任务属性自动展示对应彩色标签：
- AI 生成（紫色 `bg-violet-100 text-violet-700`）：`aiGenerated=true`
- 习惯养成（绿色 `bg-emerald-100 text-emerald-700`）：`task_kind ∈ {habit_master, habit_daily}`
- 主题任务（蓝色 `bg-blue-100 text-blue-700`）：`task_kind ∈ {parent, child}`
- 关键里程碑（金色 `bg-amber-100 text-amber-700`）：`is_key_milestone=true`
- 家长陪伴（玫红 `bg-rose-100 text-rose-700`）：`guardian_required=true`
- 手动创建（灰色 `bg-gray-100 text-gray-700`）：`aiGenerated=false && task_kind=daily`

#### Scenario: 习惯打卡任务显示标签
- **WHEN** 用户查看一个 `task_kind=habit_daily` 的任务卡片
- **THEN** 卡片顶部显示「习惯养成」绿色标签

#### Scenario: 主题子任务带关键里程碑
- **WHEN** 用户查看一个 `task_kind=child` 且 `is_key_milestone=true` 的任务
- **THEN** 卡片顶部同时显示「主题任务」蓝色标签和「关键里程碑」金色标签

### Requirement: 主题任务详情阶段流水
系统 SHALL 在 parent 任务详情页展示「阶段流水」区块，含：
- 主题头部：标题、描述、类别徽章、总预计周期
- 时间线：纵向展示所有子任务大纲（已实例化 + 未实例化）
  - 已完成阶段：绿色实心圆 + 完成日期 + 标题 + 🌟 关键里程碑标记
  - 进行中阶段：橙色脉冲圆 + 标题 + 「进行中」徽章
  - 未开始阶段：灰色空心圆 + 大纲标题 + 「未开始」徽章
- 整体进度条：X/Y 个子任务完成
- 关键里程碑专区：所有 `is_key_milestone=true` 的子任务卡片（金色背景）

#### Scenario: 查看进行中的主题任务
- **WHEN** 用户打开一个 parent 任务详情，已完成 2/5 个子任务
- **THEN** 阶段流水显示 2 个绿色实心圆（含完成日期）、1 个橙色脉冲圆（进行中）、2 个灰色空心圆（未开始）

#### Scenario: 关键里程碑高亮
- **WHEN** 某个子任务 `is_key_milestone=true` 且已完成
- **THEN** 时间线节点显示 🌟 标记，并出现在底部「关键里程碑」专区

### Requirement: 每日任务详情累计统计
系统 SHALL 在 daily 任务详情页新增「本周期累计」区块：
- 累计完成任务数（本周期内 status=completed 的 daily 任务总数）
- 累计获得积分（本周期内 completed 任务的 points 之和）
- 关联能力维度（若任务有 `ability_dimension_id`，显示维度名 + 当前分数）
- 周期目标提示（若已设置维度目标，显示「本周期重点关注：XX、XX」）

#### Scenario: 查看带能力维度的日常任务
- **WHEN** 用户打开一个 daily 任务，关联了「学习能力」维度，本周期已完成 5 个任务累计 80 积分
- **THEN** 详情页显示「本周期累计：5 个任务 · 80 积分」「能力维度：学习能力（当前 65 分）」

### Requirement: 时间穿越测试功能
系统 SHALL 提供虚拟时钟机制，允许开发环境快进时间以测试多日推进和阶段过渡：

- 后端新增 `timeutil` 包，提供 `Now()` 函数（默认返回 `time.Now()`，可通过 `SetVirtualTime` 设置虚拟时间）
- 关键服务（habit_service、task_generation_service、task_service 的 ReviewTask 时间判断）SHALL 使用 `timeutil.Now()` 替代 `time.Now()`
- 新增 debug API：
  - `POST /api/debug/advance-time` body `{"days":1}` 推进虚拟时间 N 天
  - `POST /api/debug/reset-time` 重置为真实时间
  - `GET /api/debug/time` 查询当前虚拟时间（含 `is_virtual` 标记）
- 前端设置页新增「调试工具」入口（仅当 `import.meta.env.DEV` 为 true 时显示）
  - 显示当前虚拟时间
  - 「快进 1 天」按钮：调用 advance-time 后刷新任务列表
  - 「快进 7 天」按钮
  - 「重置时间」按钮

#### Scenario: 快进一天触发习惯打卡生成
- **WHEN** 开发者在调试面板点击「快进 1 天」
- **THEN** 后端虚拟时钟推进 24 小时，前端刷新后看到新的 habit_daily 任务生成

#### Scenario: 快进推进主题子任务
- **WHEN** 当前主题子任务超过 3 天未完成，开发者点击「快进 4 天」
- **THEN** 后端 CheckStaleParentTasks 触发，自动推进下一批子任务实例化

#### Scenario: 生产环境禁用
- **WHEN** `APP_ENV != development`
- **THEN** debug API 返回 404，前端不显示调试入口

## MODIFIED Requirements

### Requirement: TaskCard 标签展示
原有 TaskCard 仅在 `aiGenerated=true` 时展示「AI 生成」标签。修改为根据任务属性统一展示多个标签（最多显示前 3 个，超出折叠为「+N」）。

## REMOVED Requirements
无
