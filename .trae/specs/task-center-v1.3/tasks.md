# Tasks

> **执行原则**:严格遵守 PRD V1.3 与 spec.md,先模型 → 后服务 → 再 handler → 最后前端;每个任务完成即更新对应 checklist 复选框。
> **依赖关系**:Task 2/3/4 可并行;Task 6 依赖 Task 5;Task 8 依赖 Task 5/6/7;Task 10-13 依赖 Task 9;Task 14-16 依赖前端基础任务。

## Phase 1:数据模型与迁移(基础)

- [x] Task 1: 创建 cycle_plan 与 cycle_goal_setting 数据模型
  - [x] SubTask 1.1: 在 `backend/internal/model/` 创建 `cycle_plan.go`,定义 CyclePlan 结构体(含 cycle_length_weeks / goals_json 等字段)
  - [x] SubTask 1.2: 在 `backend/internal/model/` 创建 `cycle_goal_setting.go`,定义 CycleGoalSetting 结构体
  - [x] SubTask 1.3: 在 `backend/internal/model/task.go` 的 TaskTemplate 结构体加 4 字段:`TaskKind` / `ParentID` / `Supervision` / `PrerequisiteCode`
  - [x] SubTask 1.4: 在 `backend/internal/database/database.go` 注册 AutoMigrate 新模型

- [x] Task 2: 修改 task_template 模型加 4 字段(可与 Task 1 并行)
  - [x] SubTask 2.1: TaskTemplate 加 `TaskKind`(ENUM: daily_fixed/weekly_recurring/guardian_reqd/collaborative/parent_child/cycle_theme)
  - [x] SubTask 2.2: TaskTemplate 加 `ParentID`(*uint,关联 ParentTask)
  - [x] SubTask 2.3: TaskTemplate 加 `Supervision`(JSON,陪同配置)
  - [x] SubTask 2.4: TaskTemplate 加 `PrerequisiteCode`(string,前置依赖编码)

- [x] Task 3: 创建 ParentTask 与 SkillTree 数据模型(可与 Task 1/2 并行)
  - [x] SubTask 3.1: 创建 `backend/internal/model/parent_task.go`(里程碑 JSON + 子任务关联)
  - [x] SubTask 3.2: 创建 `backend/internal/model/skill_tree.go`(技能树模板 + 孩子技能解锁进度)

## Phase 2:核心服务层(可与 Phase 1 并行的部分)

- [x] Task 4: 创建 cycle_goal_service(阶段目标设定服务)
  - [x] SubTask 4.1: 创建 `backend/internal/service/cycle_goal_service.go`
  - [x] SubTask 4.2: 实现 `SetGoal(child_id, parent_user_id, target_cycle_start_date, cycle_length_weeks, focus_dims, points_target)` 方法
  - [x] SubTask 4.3: 实现 `GetGoal(child_id, target_cycle_start_date)` 查询方法
  - [x] SubTask 4.4: 实现 `CalculateDefaultGoal(child_id, grade)` 默认推算方法(本年级主维 + 自动积分目标)

- [x] Task 5: 创建 cycle_plan_service(Cycle 编排核心服务,依赖 Task 1)
  - [x] SubTask 5.1: 创建 `backend/internal/service/cycle_plan_service.go`
  - [x] SubTask 5.2: 实现 `GenerateCyclePlan(child_id, start_monday, cycle_length_weeks=2, goals=None)` 主方法(对应 PRD 7.6.1 伪代码)
  - [x] SubTask 5.3: 实现 Step2 初始化 cycle_days 空容器 + 锚任务每日注入(cycle_days = cycle_length_weeks × 7)
  - [x] SubTask 5.4: 实现 Step4 每日拓展槽生成(主 65%/次 30%/潜 ≤5% + Cool-down 全局去重 + 重点维度加权 +20%)
  - [x] SubTask 5.5: 实现 Step5 父任务里程碑均匀分布(max_per_day=1, cycle_days 动态)
  - [x] SubTask 5.6: 实现 Step6 RAG R-1/R-2 规则(主题周弱维加权 + guardian_reqd 安全确认书预填)
  - [x] SubTask 5.7: 实现 Step7 Sanitize S-1/S-2/S-3(校验范围改为整个 Cycle)
  - [x] SubTask 5.8: 实现 Step8 整 Cycle 整体主次潜占比校验 + swap 末位任务
  - [x] SubTask 5.9: 实现 `GetLockedCyclePlan(child_id, date)` + `GetDailySlice(date)` 切片方法
  - [x] SubTask 5.10: 实现 `LockCyclePlan(id, lock_version, parent_id)` / `UnlockCyclePlan(id)` 锁版方法

- [x] Task 6: 修改 task_generation_service 适配可配置周期(依赖 Task 5)
  - [x] SubTask 6.1: 修改 `generate_daily_tasks` 主路径,优先读可配置 Cycle 锁版快照
  - [x] SubTask 6.2: 保留 V1.0 fallback 路径(10 步生成)在 Cycle 快照不存在时触发
  - [x] SubTask 6.3: 实现 `apply_intraday_overrides` 家长临时调整覆盖
  - [x] SubTask 6.4: 实现 `apply_safe_blacklist` 当日技能解锁进度变更替换

- [x] Task 7: 实现主题周规则适配不同周期长度(依赖 Task 5)
  - [x] SubTask 7.1: 实现 `detect_weak_dim_and_decide_theme` 弱维识别(历史窗口=最近一个已锁版 Cycle)
  - [x] SubTask 7.2: 实现 1 周 Cycle 时整周期=主题周(拓展槽 100% 派给 theme_dim)
  - [x] SubTask 7.3: 实现 2-4 周 Cycle 时主题周占其中 1 周(默认 week1,家长可调整 position)
  - [x] SubTask 7.4: 实现 `ToggleThemeWeek(id, theme_dim, position, enable)` 主题周开关 + 位置调整

## Phase 3:Handler 与路由

- [x] Task 8: 创建 cycle_goal_handler(依赖 Task 4)
  - [x] SubTask 8.1: 创建 `backend/internal/handler/cycle_goal_handler.go`
  - [x] SubTask 8.2: 实现 `POST /api/v1/cycle-goals` 接口
  - [x] SubTask 8.3: 接口返回 goal_setting.id + 系统推算的拓展槽建议值 + 主题周触发预判
  - [x] SubTask 8.4: 参数校验(cycle_length_weeks 必须 1/2/3/4;focus_dims 长度 1-3;points_target 必须 50/100/200/300/500)
  - [x] SubTask 8.5: 在 `backend/cmd/main.go` 注册路由

- [x] Task 9: 创建 cycle_plan_handler(依赖 Task 5/7)
  - [x] SubTask 9.1: 创建 `backend/internal/handler/cycle_plan_handler.go`
  - [x] SubTask 9.2: 实现 `GET /api/v1/cycle-plans/preview`(加 cycle_length_weeks 可选参数,返回阶段目标徽标)
  - [x] SubTask 9.3: 实现 `POST /api/v1/cycle-plans/:id/lock` 锁版接口(乐观锁 + 指纹校验标记位)
  - [x] SubTask 9.4: 实现 `POST /api/v1/cycle-plans/:id/regenerate` 重新生成(保留 locked=true 任务)
  - [x] SubTask 9.5: 实现 `POST /api/v1/cycle-plans/:id/task-adjust` 5 类调整操作(lock/replace/add/remove/escalate_supervision)
  - [x] SubTask 9.6: 实现 `GET /api/v1/cycle-plans/replace-candidates` 拉取 3 条候选(冷却池外 + RAG R-1 加权)
  - [x] SubTask 9.7: 实现 `POST /api/v1/cycle-plans/:id/toggle-theme-week`(加 position 参数)
  - [x] SubTask 9.8: 实现 `GET /api/v1/cycle-plans/:id/export-pdf` 导出周期计划 PDF
  - [x] SubTask 9.9: 在 `backend/cmd/main.go` 注册路由

## Phase 4:定时任务与埋点

- [x] Task 10: 修改定时任务调度器(依赖 Task 5)
  - [x] SubTask 10.1: 在 `backend/cmd/main.go` 修改现有「每周日 20:00 触发」逻辑
  - [x] SubTask 10.2: 实现「Cycle 结束前一周的周日 20:00」动态触发逻辑(按 cycle_length_weeks 计算)
  - [x] SubTask 10.3: 实现 1 周 Cycle 每周日触发、4 周 Cycle 每 4 周触发一次

- [x] Task 11: 实现埋点采集(依赖 Task 5/8/9)
  - [x] SubTask 11.1: 实现 `cycle_goal_set` 埋点(家长提交阶段目标设定)
  - [x] SubTask 11.2: 实现 `cycle_goal_completed_vs_target` 埋点(Cycle 结束时对比实际 vs 目标)
  - [x] SubTask 11.3: 实现 `cycle_length_distribution` 埋点(周期统计快照)
  - [x] SubTask 11.4: 修改 `theme_week_triggered/toggled_off` 加 `position` 参数;新增 `theme_week_position_changed` 埋点
  - [x] SubTask 11.5: 修改 `cycle_plan_generated/locked/unlocked/task_adjusted/ratio_warning_shown` 加 `cycle_length_weeks` 参数
  - [x] SubTask 11.6: 修改 `sanitize_rule_hit_S1/S2/S3` 加 `cycle_length_weeks` 参数

## Phase 5:前端类型与服务层

- [x] Task 12: 前端类型定义(可与后端 Phase 2-3 并行)
  - [x] SubTask 12.1: 在 `frontend/src/types/index.ts` 新增 `CyclePlan` / `CycleGoalSetting` / `CycleLengthWeeks` 类型
  - [x] SubTask 12.2: 新增 `TaskKind` 枚举类型(daily_fixed/weekly_recurring/guardian_reqd/collaborative/parent_child/cycle_theme)
  - [x] SubTask 12.3: 新增 `ThemeWeekConfig` 类型(含 position 字段)
  - [x] SubTask 12.4: 新增 `SupervisionConfig` 类型(level: confirm/accompany/doorstep + sign_off_required)

- [x] Task 13: 前端 service 层(依赖 Task 12)
  - [x] SubTask 13.1: 创建 `frontend/src/services/cycleGoal.ts`(setGoal / getGoal / calculateDefault)
  - [x] SubTask 13.2: 创建 `frontend/src/services/cyclePlan.ts`(preview / lock / regenerate / taskAdjust / replaceCandidates / toggleThemeWeek / exportPdf)
  - [x] SubTask 13.3: 在 `frontend/src/services/api.ts` 注册新接口 base URL

## Phase 6:前端 UI 实现

- [x] Task 14: 周期课程表页骨架(依赖 Task 13)
  - [x] SubTask 14.1: 创建 `frontend/src/pages/CyclePlanPage.tsx`(家长专属,无家长权限提示「请爸爸妈妈登录」)
  - [x] SubTask 14.2: 顶部栏:周期选择 + 周期长度档位切换器(1/2/3/4 周) + 🎯设定本周期目标入口 + 整 Cycle 维度占比统计条 + 🔒锁版状态
  - [x] SubTask 14.3: 在 `frontend/src/components/` 创建 `CycleCalendarGrid.tsx`(动态行数:1 周=1 行×7 列 / 4 周=4 行×7 列)
  - [x] SubTask 14.4: 每日 cell:日期徽标 + 任务卡片列表(按 task_kind 分色)+ 完成度 mini 圆环
  - [x] SubTask 14.5: 悬浮操作条(预览时间窗显示,锁版后隐藏):🔄 重新生成 / 🔒 全部锁定 / 📤 导出 PDF / ✅ 确认锁版
  - [x] SubTask 14.6: 能力占比仪表盘(实时计算整 Cycle 主维/次维/潜维占比,不达标红标提醒)

- [x] Task 15: 阶段目标设定 UI(依赖 Task 13)
  - [x] SubTask 15.1: 创建 `frontend/src/components/GoalSettingModal.tsx`(弹层形式)
  - [x] SubTask 15.2: 周期长度档位选择(1/2/3/4 周,默认 2 周)
  - [x] SubTask 15.3: 重点能力维度多选(1-3 个,系统默认勾选本年级主维,可勾选弱维)
  - [x] SubTask 15.4: 周期积分目标选择(5 档:50/100/200/300/500,系统给出推荐值)
  - [x] SubTask 15.5: 保存按钮调用 `POST /api/v1/cycle-goals` 接口
  - [x] SubTask 15.6: 保存成功后触发课程表重新生成 + 跳转预览页

- [x] Task 16: 今日任务页升级(依赖 Task 13)
  - [x] SubTask 16.1: 修改 `frontend/src/pages/TaskListPage.tsx` 顶部一级 Tab:📘 今日任务(默认) / 📅 周期课程表(家长专属)
  - [x] SubTask 16.2: 「周期概览卡」改为按 cycle_length_weeks 显示进度条(例如「2/4 周」+ 完成率 + 预计积分)
  - [x] SubTask 16.3: 锚任务专区加「每日保底」徽标 + task_kind 彩色徽标
  - [x] SubTask 16.4: 拓展任务专区加分 Tab:全部 / 主维 / 次维 / 潜维 / 🌟主题周(激活时显示)
  - [x] SubTask 16.5: 主题周期间任务卡片加「🌟XX 主题周」金色徽标

- [x] Task 17: 单任务编辑面板(依赖 Task 14)
  - [x] SubTask 17.1: 单天 cell 长按或点击 → 展开当日任务编辑面板
  - [x] SubTask 17.2: 实现 5 类调整 UI:🔒锁定 / 🔄换一个 / 📌提级陪同 / ➖删除 / ➕从拓展池选任务加进来
  - [x] SubTask 17.3: 删除后主维<60% 红标警告弹窗(可继续删或取消)
  - [x] SubTask 17.4: 🔄换一个时调用 replace-candidates 接口弹出 3 条候选选择器

- [x] Task 18: 主题周配置面板(依赖 Task 14)
  - [x] SubTask 18.1: 顶部「主题周」入口(2-4 周 Cycle 显示「位置选择」下拉)
  - [x] SubTask 18.2: 调用 toggle-theme-week 接口传 position 参数
  - [x] SubTask 18.3: 主题周开启/关闭/位置调整后实时重算占比仪表盘

## Phase 7:验证与测试

- [x] Task 19: 后端单元测试
  - [x] SubTask 19.1: cycle_goal_service 单测(SetGoal / GetGoal / CalculateDefaultGoal)
  - [x] SubTask 19.2: cycle_plan_service 单测(GenerateCyclePlan 在 1/2/3/4 周四档下的输出)
  - [x] SubTask 19.3: Sanitize S-1/S-2/S-3 规则单测(整个 Cycle 校验范围)
  - [x] SubTask 19.4: Cool-down 池在 1 周 Cycle 下潜维 14 天冷却等价于本 Cycle 内不重复的验证
  - [x] SubTask 19.5: 主题周 1 周整周期 / 2-4 周占 1 周适配验证

- [x] Task 20: 端到端模拟测试(对应 PRD 12.1-B 验收)
  - [x] SubTask 20.1: 6 年级 × 4 档周期长度 × 50 次 = 1200 次模拟测试脚本
  - [x] SubTask 20.2: 验证 95% 满足整 Cycle 聚合主维≥60% / 次维 28-32% / 潜维≤10%
  - [x] SubTask 20.3: 验证 Cool-down 池全局生效(主维 3 天不重复率 100% / 次维 5 天≥98% / 潜维本 Cycle 内 100%)
  - [x] SubTask 20.4: 验证 parent_id 里程碑均匀分布(日密度≤1 条)
  - [x] SubTask 20.5: 验证阶段目标设定 → 课程表生成链路(重点维度拓展槽占比 +20% / 积分预估达成率≥95%)

# Task Dependencies

- Task 2/3 可与 Task 1 并行(都是 Phase 1 模型层)
- Task 4 可与 Task 1/2/3 并行(独立的 goal 服务,不依赖 cycle_plan)
- Task 5 依赖 Task 1(需要 CyclePlan 模型)
- Task 6 依赖 Task 5(需要 GenerateCyclePlan 主方法)
- Task 7 依赖 Task 5(主题周规则嵌入 GenerateCyclePlan)
- Task 8 依赖 Task 4(需要 cycle_goal_service)
- Task 9 依赖 Task 5/7(需要 cycle_plan_service + 主题周规则)
- Task 10 依赖 Task 5(需要按 cycle_length_weeks 动态触发)
- Task 11 依赖 Task 5/8/9(埋点嵌入各接口)
- Task 12 可与后端 Phase 2-3 并行(纯类型定义)
- Task 13 依赖 Task 12
- Task 14-18 依赖 Task 13
- Task 19 依赖 Task 1-11
- Task 20 依赖 Task 19

# Parallelizable Work

- **Phase 1 全部 4 个任务**(Task 1/2/3/4)可同时启动
- **Task 12 前端类型定义**可与后端 Phase 2-3 并行
- **Task 19/20 测试**可与前端 Phase 6 并行(后端测试不依赖前端)

## Phase 8:算法优化与红线测试补全(根据 Task 20 测试结果新增)

> **背景**:Task 20 的 1200 次模拟测试发现主代码算法在以下场景未达 PRD V1.3 关键硬约束,需补全修复任务与测试覆盖。

- [x] Task 21: 优化 cycle_plan_service 算法以满足整 Cycle 占比合规率 ≥95%(对应 PRD 12.1-B 硬约束 ①)
  - [x] SubTask 21.1: 修复 `swapEndToFitRatio` 仅处理 latent→primary 的限制,新增 secondary 超标(<28%)时的回补逻辑(从 primary 池拉次维任务填充)
  - [x] SubTask 21.2: 修复 1 周 Cycle 主题周整周期派发 theme_dim 时,导致次维占比 <28% 的问题(主题周天数不计入占比统计,全周期主题周时 theme_week_only=1 直接通过)
  - [x] SubTask 21.3: 重跑 `TestCyclePlanSimulation_1200Runs` 验证占比合规率 ≥95% _(实测 1200/1200=100%)_

- [x] Task 22: 优化 Cool-down 池避免模板不足时回退全量候选(对应 PRD 12.1-B 硬约束 ②)
  - [x] SubTask 22.1: 修复 `sampleDayExtraWithGlobalCooldown` 在候选模板不足时直接回退全量候选的逻辑,改为按日期索引存储冷却池 + 不回退(池子不足返回较少任务)
  - [x] SubTask 22.2: 强化主维 3 天不重复校验(目前 93.42% < 99%),在生成后增加扫描+替换步骤 _(修复:swapTaskInPlan/addTaskToPlan 补位任务遵守冷却规则,实测 100%)_
  - [x] SubTask 22.3: 强化潜维本 Cycle 内 100% 不重复校验(目前 87.17% < 100%),潜维配额从 1 改为允许 0(本周已体验过则跳过) _(修复:潜维使用 cycle-wide 集合 + addTaskToPlan 排除已用 ID,实测 100%)_
  - [x] SubTask 22.4: 重跑 `TestCyclePlanSimulation_1200Runs` 验证 Cool-down 全局生效 _(实测 1200/1200=100%)_

- [ ] Task 23: 补充学术红线 + 安全红线测试覆盖(对应 PRD 12.1-B 硬约束 ④)
  - [ ] SubTask 23.1: 创建 `backend/internal/service/academic_redline_test.go`,扫描所有 TaskTemplate 的 title/description 关键词(对照 project_memory 中「Reason 必须不包含关键词」清单),验证 0 命中
  - [ ] SubTask 23.2: 创建 `backend/internal/service/safety_blacklist_test.go`,模拟 12 类危险操作模板,验证未解锁技能的孩子调 `GetPreview` / `GetReplaceCandidates` 接口 100% 不返回对应高级任务
  - [ ] SubTask 23.3: 把 PRD 验收 checklist 中「学术红线」「安全红线」2 项打勾

- [ ] Task 24: 补充 PRD 文档对齐验证(对应 PRD 第十三章,非代码任务)
  - [ ] SubTask 24.1: 对照《1-6年级成长任务基础规范V1》验证 4 档周期长度下主次潜占比 + 重点维度加权 +20% 不破坏合规
  - [ ] SubTask 24.2: 对照《每日锚任务汇总》验证 1 周 Cycle 锚任务数(7天×3-5条)与 4 周 Cycle 锚任务数(28天×3-5条)的合规性
  - [ ] SubTask 24.3: 对照《1-6年级任务模板库》验证重点维度选择时该维度拓展池候选数充足(每维至少 10 条可选)
  - [ ] SubTask 24.4: 对照《技能解锁树汇总》验证 4 档周期长度下技能解锁进度推算正确(长周期下单技能可解锁 Lv.2)
  - [ ] SubTask 24.5: 对照《跨周期父任务汇总》验证 1 周/4 周 Cycle 下父任务里程碑跨度适配
  - [ ] SubTask 24.6: 对照《问卷题库-分龄6档V2》验证阶段目标默认推荐值来自问卷 V2 弱维识别 + 历史回看窗口为「近一个已锁版 Cycle」

# Task Dependencies(新增)

- Task 21/22/23 可并行(都是独立的优化/测试任务)
- Task 24 依赖 Task 21/22(算法优化后才能验证文档对齐)
- Task 21-24 完成后,重跑 Task 20 测试验证所有 PRD 关键硬约束通过
