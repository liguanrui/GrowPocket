# 任务中心 V1.3:周期可配置 + 阶段目标设定 Spec

> **来源**:基于 `.trae/documents/任务中心PRD-V1.0.md`(实际版本 V1.3)生成
> **前置版本**:`.trae/specs/growpocket-v3/spec.md`(v3 整体规划)与 `.trae/specs/v3.1-growth-optimization/spec.md`(v3.1 任务生成优化)
> **变更性质**:V1.1 Cycle 全局编排架构演进一步——把固定的「14 天 Cycle」改为「家长可选 1/2/3/4 周四档」,并在生成课程表前新增「阶段目标设定」前置环节,锚定「目标 → 课程表」生成链路

## Why

V1.1 的「固定 14 天 Cycle + 每周日 20:00 触发」存在两个问题:

1. **家庭节奏差异大**:有的家庭希望周维度快速试运行(1 周),有的希望长项目规划(4 周);14 天固定档位无法适配
2. **课程表凭空生成**:Cycle 课程表生成缺乏目标导向,家长无法表达「本周期重点突破哪个能力维度 / 想达到多少积分」,导致生成结果与家长意图错位

V1.3 通过 ① Cycle 长度四档可选 ② 阶段目标设定前置,把「系统推什么孩子做什么」进化为「家长设定目标 → 系统按目标反向推导生成对应长度的课程表」,提升家长拍板权与目标感。

## What Changes

### 一、Cycle 长度可配置 1-4 周四档
- **新增** `cycle_length_weeks` 字段(TINYINT,默认 2 兼容 V1.1),取值 1/2/3/4
- **修改** Cycle 触发时机:从「固定每周日 20:00」改为「Cycle 结束前一周的周日 20:00」(按周期长度动态)
- **修改** Cycle 三大约束按周期长度动态生效:
  - 全局占比:整 Cycle 主维≥60% / 次维~30% / 潜维≤10%
  - Cool-down 池:1 周 Cycle 下潜维 14 天冷却等价于「本 Cycle 内不重复」
  - parent_id 里程碑:均匀分布在 `cycle_length_weeks × 7` 天内,日密度≤1 条

### 二、新增阶段目标设定(支柱0)
- **新增** `cycle_goal_setting` 表(家长设定目标)
- **新增** `POST /api/v1/cycle-goals` 接口
- **新增** 3 类目标要素:
  - ① 周期长度档位(1/2/3/4 周,默认 2 周)
  - ② 重点能力维度(6 维选 1-3 个,系统默认勾选本年级主维)
  - ③ 周期积分目标(50/100/200/300/500 五档,系统按主维任务量推算推荐值)
- **新增** 「🎯设定本周期目标」入口(在📅周期课程表页顶部)

### 三、cycle_plan 表加 2 字段
- `cycle_length_weeks`(TINYINT,默认 2)
- `goals_json`(JSON,阶段目标快照)

### 四、主题周规则适配不同周期长度
- 1 周 Cycle:触发主题周时整个周期即为主题周(拓展槽 100% 派给 theme_dim)
- 2-4 周 Cycle:主题周占其中 1 周(家长可在预览时调整位置,新增 `position=week1/week2/...` 字段)
- **修改** `POST /api/v1/cycle-plans/:id/toggle-theme-week` 接口加 `position` 参数

### 五、引擎算法改造
- **修改** `generate_cycle_plan` 函数签名,新增 `cycle_length_weeks` + `goals` 参数
- **修改** Step4 拓展槽基数根据积分目标动态调整;重点维度加权 +20%
- **修改** Sanitize S-1/S-2/S-3 校验范围从「14 天」改为「整个 Cycle」
- **修改** RAG R-1 触发条件判断从「14 天计划」改为「Cycle 计划」

### 六、新增 API 与埋点
- 新增 1 个 API:`POST /api/v1/cycle-goals`
- 修改 2 个 API:`GET /api/v1/cycle-plans/preview` 加 `cycle_length_weeks` 参数;`POST /api/v1/cycle-plans/:id/toggle-theme-week` 加 `position` 参数
- 新增 3 个埋点:`cycle_goal_set` / `cycle_goal_completed_vs_target` / `cycle_length_distribution`
- 新增 1 个主题周位置调整埋点:`theme_week_position_changed`

### 七、前端 UI 升级
- 「📅周期课程表」页顶部新增「周期长度档位切换器(1/2/3/4 周)」+「🎯设定本周期目标」入口
- 周期日历表格视图按 `cycle_length_weeks` 动态渲染行数(1 周=1 行×7 列 / 4 周=4 行×7 列)
- 新增「阶段目标设定」弹层/页面(3 类目标要素选择)
- 今日任务页「周期概览卡」改为按 `cycle_length_weeks` 显示进度条
- 主题周配置面板新增「位置选择」(2-4 周 Cycle 时显示)

## Impact

### Affected specs
- `.trae/specs/growpocket-v3/spec.md`(v3 任务系统整体规划,本 spec 在其基础上演进)
- `.trae/specs/v3.1-growth-optimization/spec.md`(v3.1 三段式生成,本 spec 复用其 Rank&Generate 主流水线,仅扩展 Cycle 级编排层)

### Affected code
- **后端 Go**:
  - `backend/internal/model/` 新增 `cycle_plan.go` + `cycle_goal_setting.go`,修改 `task.go`(task_template 加 4 字段:task_kind/parent_id/supervision/prerequisite_code)
  - `backend/internal/service/` 新增 `cycle_plan_service.go` + `cycle_goal_service.go`,修改 `task_generation_service.go`(支持 cycle_length_weeks + goals 参数)
  - `backend/internal/handler/` 新增 `cycle_plan_handler.go` + `cycle_goal_handler.go`
  - `backend/cmd/main.go` 注册新路由 + 定时任务(从固定每周日改为按 Cycle 长度动态触发)
- **前端 React+TS**:
  - `frontend/src/pages/` 新增 `CyclePlanPage.tsx` + `CycleGoalSettingPage.tsx`,修改 `TaskListPage.tsx`(顶部 Tab 切换)
  - `frontend/src/services/` 新增 `cyclePlan.ts` + `cycleGoal.ts`
  - `frontend/src/types/index.ts` 新增 CyclePlan + CycleGoalSetting 类型
  - `frontend/src/components/` 新增 `CycleCalendarGrid.tsx`(动态行数)+ `GoalSettingModal.tsx`
- **数据库迁移**:新增 2 张表(cycle_plan + cycle_goal_setting),task_template 表加 4 字段

## ADDED Requirements

### Requirement: Cycle 长度可配置 1-4 周四档

The system SHALL provide 家长可选的 Cycle 长度档位 1 周 / 2 周 / 3 周 / 4 周,默认 2 周兼容 V1.1。

#### Scenario: 家长选择 4 周周期
- **WHEN** 家长在「📅周期课程表」页顶部切换器选择「4 周」
- **THEN** 周期日历表格视图渲染为 4 行×7 列,共 28 天 cell
- **AND** 系统调用 `generate_cycle_plan(child_id, start_monday, cycle_length_weeks=4, goals)` 生成对应长度课程表
- **AND** `cycle_plan.cycle_length_weeks` 字段写入 4

#### Scenario: 1 周 Cycle 下主题周触发
- **WHEN** 1 周 Cycle 触发主题周
- **THEN** 整个周期(7 天)的拓展槽 100% 派给 theme_dim
- **AND** 主题周配置 `position=week1`(唯一选项)

#### Scenario: Cool-down 池 1 周适配
- **WHEN** 1 周 Cycle 下生成潜维任务
- **THEN** 潜维 14 天冷却规则等价于「本 Cycle 内不重复」(7 天范围内)
- **AND** 不影响主维 3 天冷却、次维 5 天冷却的硬约束

### Requirement: 阶段目标设定(支柱0)

The system SHALL provide 家长在生成课程表前设定阶段目标的功能,包括周期长度、重点能力维度、积分目标 3 类要素。

#### Scenario: 家长设定目标后生成课程表
- **WHEN** 家长点「🎯设定本周期目标」→ 选「2 周 + 重点维度=责任担当+学习探索 + 积分目标=200 分」→ 保存
- **THEN** 系统调用 `POST /api/v1/cycle-goals` 写入 `cycle_goal_setting` 表
- **AND** 系统基于目标计算拓展槽数量 + 弱维加权倍率 + 主题周是否触发
- **AND** 调用 `generate_cycle_plan` 生成对应长度(2 周=14 天)的课程表草稿
- **AND** 课程表中重点维度拓展槽占比比默认 +20%

#### Scenario: 家长未主动设定时系统默认推算
- **WHEN** 家长未点「🎯设定本周期目标」直接触发生成
- **THEN** 系统使用默认值:周期长度=2 周 / 重点维度=本年级 PRIMARY_DIMS / 积分目标=按主维任务量自动推算
- **AND** `cycle_goal_setting.is_default=true`

### Requirement: 新增 cycle_goal_setting 表

The system SHALL persist 家长设定的阶段目标到 `cycle_goal_setting` 表,关联到下个生成的 cycle_plan。

字段:child_id / parent_user_id / target_cycle_start_date / cycle_length_weeks / focus_dims(JSON) / points_target / points_target_grade / is_default。

#### Scenario: 同一 child 同一 target_cycle_start_date 唯一
- **WHEN** 家长对同一孩子的同一目标周期重复设定目标
- **THEN** 后写覆盖前写(UNIQUE KEY uk_child_target_cycle)
- **AND** 保留最新一条 goals 记录

### Requirement: 新增 POST /api/v1/cycle-goals 接口

The system SHALL expose `POST /api/v1/cycle-goals` 接口接收家长阶段目标设定。

#### Scenario: 接口成功响应
- **WHEN** POST 请求传入 `child_id / target_cycle_start_date / cycle_length_weeks(1/2/3/4) / focus_dims[] / points_target`
- **THEN** 返回 `goal_setting.id` + 系统推算的拓展槽建议值 + 主题周触发预判
- **AND** HTTP 状态码 200

### Requirement: 触发时机按周期长度动态

The system SHALL trigger Cycle 生成在「下个 Cycle 开始前一周的周日 20:00」,而非固定每周日 20:00。

#### Scenario: 4 周 Cycle 触发时机
- **GIVEN** 当前 Cycle 是 4 周(28 天),起始日 2026-08-04 周一
- **WHEN** 系统在 2026-08-24(下个 Cycle 开始前一周的周日)20:00 触发
- **THEN** 生成 2026-08-31 周一 → 2026-09-27 周日的 28 天课程表

#### Scenario: 1 周 Cycle 触发时机
- **GIVEN** 当前 Cycle 是 1 周(7 天)
- **WHEN** 系统在每周日 20:00 触发(等价于 V1.1 行为)
- **THEN** 生成下周一→下周日的 7 天课程表

### Requirement: 主题周位置可调整(2-4 周 Cycle)

The system SHALL allow 家长在 2-4 周 Cycle 中调整主题周所在周(position=week1/week2/week3/week4)。

#### Scenario: 3 周 Cycle 调整主题周位置
- **WHEN** 家长在 3 周 Cycle 预览页调整主题周从 week1 到 week2
- **THEN** 调用 `POST /api/v1/cycle-plans/:id/toggle-theme-week` 传入 `position=week2`
- **AND** 系统重算整 Cycle 占比仪表盘
- **AND** 触发 `theme_week_position_changed` 埋点

### Requirement: 阶段目标达成对比

The system SHALL 在 Cycle 结束时对比实际达成 vs 设定目标,触发 `cycle_goal_completed_vs_target` 埋点。

#### Scenario: 周期结束对比
- **WHEN** Cycle 结束日 23:59 触发统计
- **THEN** 计算实际积分 vs `points_target` / 重点维度完成率
- **AND** 触发埋点包含 `child_id / cycle_length_weeks / points_target / points_actual / completion_rate_target_dim`
- **AND** 数据写入成长模块「阶段回顾」(显示「本周期目标 vs 实际达成」对比)

## MODIFIED Requirements

### Requirement: cycle_plan 表结构

在 V1.1 cycle_plan 表基础上新增 2 字段:

```sql
ALTER TABLE cycle_plan ADD COLUMN cycle_length_weeks TINYINT NOT NULL DEFAULT 2 COMMENT 'V1.3新增:周期长度档位 1/2/3/4 周,默认2周兼容V1.1';
ALTER TABLE cycle_plan ADD COLUMN goals_json JSON COMMENT 'V1.3新增:阶段目标设定快照 {focus_dims:[1,2], points_target:200, points_target_grade:G3}';
ALTER TABLE cycle_plan ADD INDEX idx_child_length (child_id, cycle_length_weeks);
```

`end_date` 字段含义从「start_date+13 天」改为「start_date + cycle_length_weeks*7 - 1」。

### Requirement: generate_cycle_plan 函数

函数签名从 `generate_cycle_plan(child_id, start_monday)` 修改为 `generate_cycle_plan(child_id, start_monday, cycle_length_weeks=2, goals=None)`。

Step2 初始化空容器改为 `cycle_days = cycle_length_weeks * 7`(7/14/21/28 天)。
Step4 拓展槽基数根据积分目标动态调整;重点维度加权 +20%。
Step7 Sanitize 校验范围改为整个 Cycle。
Step8 校验整 Cycle 整体主次潜占比。
Step9 保存快照时写入 `cycle_length_weeks` + `goals`。

### Requirement: GET /api/v1/cycle-plans/preview 接口

新增可选参数 `cycle_length_weeks`(默认从 goals 读取),返回数据新增「阶段目标徽标」字段。

### Requirement: POST /api/v1/cycle-plans/:id/toggle-theme-week 接口

新增参数 `position=week1/week2/week3/week4`(2-4 周 Cycle 时调整主题周所在周)。

### Requirement: 每日编排函数 generate_daily_tasks

V1.0 的 fallback 路径保持不变;主路径(99% 场景)从「读 14 天 Cycle 锁版快照」改为「读可配置 1-4 周 Cycle 锁版快照」。

## REMOVED Requirements

### Requirement: 固定 14 天 Cycle

**Reason**: 不同家庭节奏差异大,固定 14 天无法适配;改为家长可选 1/2/3/4 周四档
**Migration**:
- 现有 V1.1 cycle_plan 数据自动迁移:cycle_length_weeks 默认值=2(等价 14 天)
- 现有定时任务(每周日 20:00)改为按 Cycle 长度动态触发
- 现有 Cool-down 池规则在 1 周 Cycle 下潜维 14 天冷却等价于「本 Cycle 内不重复」

### Requirement: 课程表凭空生成

**Reason**: 缺乏目标导向,家长无法表达意图;改为先设定阶段目标再反向推导生成
**Migration**:
- 新增 cycle_goal_setting 表存储家长目标
- 家长未主动设定时使用默认值(2 周 + 本年级主维 + 自动推算积分目标),`is_default=true`

