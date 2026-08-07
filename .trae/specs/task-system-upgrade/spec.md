# 任务系统升级 Spec

> 关联 PRD：[任务系统升级PRD.md](../../documents/任务系统升级PRD.md)
> 范围：任务系统 + 成长系统
> 变更类型：新增 + 修改

## Why

当前任务系统为扁平单层结构，AI 每日生成 3 条无差异任务，缺乏持续性和主题性；成长周期目标仅能关联能力维度+分数，周期长度无限制；阶段回顾时所有任务一视同仁，无法体现习惯坚持或主题任务推进。

需要引入习惯养成（每日重复子任务+鼓励语+坚持天数）和父子主题任务（长期主题+AI 分批生成子任务），并让目标设置关联习惯/主题任务，周期限制 1-4 周便于管理。

## What Changes

### 数据模型
- Task 表新增字段：`TaskKind`、`ParentID`、`HabitID`、`GuardianRequired`、`StreakCount`、`TotalCount`、`HabitGoal`、`LastCheckinDate`、`SubTaskOutline`、`Sequence`、`IsKeyMilestone`
- Goal 表新增字段：`GoalType`、`HabitID`、`ParentTaskID`（`TargetScore` 保留但 GoalType=dimension 时置 0）
- 新增 `Habit` 表（习惯库：预设+自定义）
- 新增 `ParentTaskTemplate` 表（主题模板库：预设+自定义）
- AutoMigrate 注册 Habit、ParentTaskTemplate
- Task 表新增索引：`task_kind`、`parent_id`、`habit_id`、`last_checkin_date`

### 任务系统
- 任务类型扩展为 5 种：`daily`/`habit_master`/`habit_daily`/`parent`/`child`
- 习惯养成：目标绑定习惯 → 每日生成 habit_daily（AI 鼓励语）→ 完成更新 habit_master 统计 → 阶段回顾 AI 评估养成程度
- 父子主题任务：父任务创建 → AI 生成子任务大纲存入 `SubTaskOutline` → 分批实例化（完成触发 + 3 天时间兜底）
- 家长陪伴标记：`GuardianRequired` 字段 + 风险关键词自动触发 + 醒目 Banner

### 成长系统
- 周期长度限制 1-4 周（前后端校验）
- 目标设置面板重构为三区块：能力维度（仅勾选去分数）/ 习惯目标（0-2 个）/ 主题任务（0-1 个）
- 周期进度计算改为任务完成度（原 score*100/target 失效）
- AI 任务生成扩展：读取习惯目标生成 habit_daily、读取主题目标补齐子任务
- 成长故事扩展：区分 daily/habit/parent 三类聚合展示，仅全完成父任务生成相册

### 预设库 Seed
- Habit 预设库：6 年龄段 × 9 类别，60+ 条
- ParentTaskTemplate 预设库：6 年龄段 × 6 类别，30-50 条

### API
- 任务列表 `GET /api/tasks` 新增 `task_kind` 查询参数
- 习惯 API：`/api/habits/preset`、`/api/habits/custom`、`/api/habits/active`、`/api/habits/:id/stats`
- 父子任务 API：`/api/parent-task-templates/preset`、`/api/parent-task-templates/custom`、`/api/tasks/parent`、`/api/tasks/parent/:id/generate-children`、`/api/tasks/parent/:id/advance-batch`、`/api/tasks/:id/children`、`/api/tasks/:id/parent`、`/api/tasks/:id/habit-master`
- 周期 API 校验 1-4 周
- 目标设置 API 支持 GoalType 分类

### 前端
- TaskListPage：任务类型徽章（习惯/主题/陪伴）+ 连续天数 badge
- TaskDetailPage：条件渲染习惯打卡区/父任务信息区/陪伴 Banner
- GrowthPage：目标设置面板三区块 + 1-4 周按钮组
- CreateTaskPage：任务类型选择 + 主题任务创建流程

## Impact

- **Affected specs**：
  - `v3.1-growth-optimization`（成长周期/目标/故事逻辑变更）
  - `growpocket-v3`（任务基础结构变更）
- **Affected code**：
  - 后端 model：task.go、goal.go、新增 habit.go、parent_task_template.go
  - 后端 service：task_generation_service.go、growth_story_service.go、growth_cycle_service.go、新增 habit_service.go、parent_task_service.go
  - 后端 handler：tasks.go、growth_cycle_handler.go、新增 habit_handler.go、parent_task_handler.go
  - 后端 database/database.go（AutoMigrate + Seed）
  - 前端 pages：TaskListPage.tsx、TaskDetailPage.tsx、GrowthPage.tsx、CreateTaskPage.tsx
  - 前端 services：tasks.ts、growthCycle.ts、新增 habits.ts、parentTasks.ts
  - cmd/main.go（路由注册）

## ADDED Requirements

### Requirement: 任务类型区分
系统 SHALL 支持 5 种任务类型（daily/habit_master/habit_daily/parent/child），通过 `TaskKind` 字段区分，默认 `daily` 向后兼容。

#### Scenario: 旧任务兼容
- **WHEN** 现有 Task 记录未设置 TaskKind
- **THEN** 自动取默认值 `daily`，行为与升级前一致

#### Scenario: 任务列表过滤
- **WHEN** 调用 `GET /api/tasks` 不带 task_kind 参数
- **THEN** 默认只返回 `daily,habit_daily,child`，不返回 habit_master 和 parent

### Requirement: 习惯养成系统
系统 SHALL 提供习惯库（预设+自定义），目标设置时绑定 1-2 个习惯作为阶段目标，每日生成 habit_daily 子任务带 AI 鼓励语，跟踪连续/累计天数，阶段回顾时 AI 评估养成程度。

#### Scenario: 每日子任务生成（幂等）
- **WHEN** 每日 08:00 定时任务触发，且当日已存在该 HabitID 的 habit_daily
- **THEN** 不重复生成，跳过该习惯

#### Scenario: 习惯打卡更新统计
- **WHEN** habit_daily 子任务被标记为已完成
- **THEN** 对应 habit_master 的 StreakCount+1、TotalCount+1、LastCheckinDate=今天

#### Scenario: 连续中断
- **WHEN** 某日 habit_daily 未完成且次日生成触发
- **THEN** habit_master 的 StreakCount 重置为 0，TotalCount 保留

#### Scenario: 鼓励语生成
- **WHEN** 生成 habit_daily 子任务
- **THEN** 描述由 AI 基于当前坚持天数生成 10-20 字鼓励语

#### Scenario: 阶段回顾养成评估
- **WHEN** 周期结束触发回顾
- **THEN** AI 基于家长批语+坚持天数输出养成程度（已养成/基本养成/待加强）

#### Scenario: 已养成习惯下周期过滤
- **WHEN** 习惯被 AI 评估为"已养成"
- **THEN** 下次目标设置时该习惯不再出现在推荐列表

### Requirement: 自定义习惯
系统 SHALL 允许家长创建自定义习惯（标题+描述），由 AI 每日生成鼓励语和阶段评估。

#### Scenario: 创建自定义习惯
- **WHEN** 家长提交自定义习惯（标题+描述）
- **THEN** 创建 Habit 记录，IsCustom=true，FamilyID+ChildID 标记归属

### Requirement: 父子主题任务
系统 SHALL 提供主题任务模板库（预设+自定义），父任务创建后 AI 生成全部子任务大纲存入 `SubTaskOutline`，按"完成触发+3 天时间兜底"分批实例化为 child 任务。

#### Scenario: 大纲生成
- **WHEN** 父任务创建
- **THEN** AI 一次性生成 3-8 个子任务大纲（标题+简述+预计天数+顺序+是否关键里程碑），存入 parent 的 SubTaskOutline，不创建 child 记录

#### Scenario: 首批实例化
- **WHEN** 大纲生成完成
- **THEN** 立即实例化第 1 个子任务（创建 child 记录，Status=1，Sequence=1）

#### Scenario: 完成触发下一批
- **WHEN** 当前批次子任务全部完成
- **THEN** 自动实例化下一个子任务

#### Scenario: 时间兜底解锁
- **WHEN** 当前批次超过 3 天未完成
- **THEN** 仍解锁下一批，避免卡住

#### Scenario: 相册生成
- **WHEN** 周期回顾且父任务所有子任务已完成
- **THEN** 生成回忆相册（子任务成果照片按时间线排列，关键里程碑高亮）
- **WHEN** 父任务未全部完成
- **THEN** 故事中显示"进行中"状态+当前进度，不生成相册

### Requirement: 主题任务模板库
系统 SHALL 提供预设主题模板（6 年龄段 × 6 类别，30-50 条）和家长自定义模板。

#### Scenario: 按年龄推荐
- **WHEN** 目标设置时获取预设主题模板
- **THEN** 按孩子年龄（由生日推算）过滤返回适配模板

#### Scenario: 自定义主题
- **WHEN** 家长提交自定义主题（标题+描述+预计周期+类别）
- **THEN** 创建 ParentTaskTemplate 记录，IsCustom=true，KeyMilestones 可选（不填由 AI 生成）

### Requirement: 家长陪伴标记
系统 SHALL 支持所有任务类型设置 `GuardianRequired` 标记，风险关键词自动触发。

#### Scenario: 手动勾选
- **WHEN** 家长创建任务时勾选"需要家长陪伴"
- **THEN** GuardianRequired=true

#### Scenario: 风险关键词自动触发
- **WHEN** 任务标题/描述含风险关键词（刀/火/电/化学/高处等）
- **THEN** GuardianRequired 自动置为 true

#### Scenario: 醒目展示
- **WHEN** 任务列表/详情页渲染且 GuardianRequired=true
- **THEN** 显示玫红色"⚠️ 需家长陪伴"标识（详情页为大型 Banner+安全提示）

### Requirement: 习惯库预设
系统 SHALL 在启动时自动 Seed 习惯库（6 年龄段 × 9 类别，60+ 条），幂等更新。

#### Scenario: 启动 Seed
- **WHEN** 服务启动
- **THEN** 自动执行 Habit Seed，已存在的按 Title+FamilyID=0 更新，不存在的创建

### Requirement: 周期长度限制
系统 SHALL 限制成长周期长度为 1-4 周（7-28 天），前后端均校验。

#### Scenario: 创建周期合法
- **WHEN** 创建周期 endDate-startDate ∈ [7,28] 天
- **THEN** 创建成功

#### Scenario: 创建周期非法
- **WHEN** endDate-startDate < 7 或 > 28 天
- **THEN** 返回 400 错误"周期长度需在 1-4 周之间"

#### Scenario: 旧数据兼容
- **WHEN** 已存在的 completed 周期长度不在 1-4 周
- **THEN** 不受影响，仅对新周期校验

## MODIFIED Requirements

### Requirement: 目标设置
目标设置从"维度+目标分数"扩展为三区块：能力维度（仅勾选去分数）/ 习惯目标（0-2 个）/ 主题任务（0-1 个）。

#### Scenario: 设置维度目标（无分数）
- **WHEN** 家长勾选能力维度
- **THEN** 创建 Goal 记录 GoalType=dimension，dimension_id=xxx，TargetScore=0

#### Scenario: 设置习惯目标
- **WHEN** 家长选择 1-2 个习惯
- **THEN** 为每个习惯创建 Goal 记录 GoalType=habit，HabitID=xxx

#### Scenario: 超出习惯数量限制
- **WHEN** 家长尝试选择超过 2 个习惯
- **THEN** 前端阻止选择并提示

### Requirement: 周期进度计算
周期进度从 `current_score*100/target_score` 改为任务完成度计算。

#### Scenario: 计算进度
- **WHEN** 查询周期进度
- **THEN** 返回 已完成任务数 / 周期内已生成任务数（含 daily + habit_daily + child）

### Requirement: AI 任务生成
AI 任务生成扩展读取 GoalType=habit 和 GoalType=parent_task 目标，生成对应子任务。

#### Scenario: 生成习惯子任务
- **WHEN** 检测到 GoalType=habit 目标
- **THEN** 生成 habit_daily 子任务（含 AI 鼓励语）

#### Scenario: 补齐主题子任务
- **WHEN** 检测到 GoalType=parent_task 目标且父任务子任务未齐全
- **THEN** 按分批策略补齐

### Requirement: 成长故事生成
成长故事生成区分 daily/habit/parent 三类聚合展示。

#### Scenario: 故事 Prompt 扩展
- **WHEN** 生成故事
- **THEN** Prompt 包含日常任务/习惯养成（习惯名+坚持天数+批语）/主题任务（完成度）三区块

## REMOVED Requirements

### Requirement: 能力维度目标分数
**Reason**：家长反馈目标分数无实际意义，AI 基于关注维度生成任务即可，无需分数衡量。
**Migration**：`Goal.TargetScore` 字段保留但 GoalType=dimension 时置 0，向后兼容旧数据；周期进度改用任务完成度计算。
