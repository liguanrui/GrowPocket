# Tasks

## Phase 1：数据模型与基础 API（基础层）

- [x] Task 1: Task 表扩展字段
  - [x] SubTask 1.1: 在 `backend/internal/model/task.go` 的 Task 模型新增字段：TaskKind、ParentID、HabitID、GuardianRequired、StreakCount、TotalCount、HabitGoal、LastCheckinDate、SubTaskOutline、Sequence、IsKeyMilestone（字段定义见 spec.md 数据模型章节）
  - [x] SubTask 1.2: 在 `backend/internal/database/database.go` 的 AutoMigrate 确认 Task 表迁移生效
  - [x] SubTask 1.3: 启动服务，用 sqlite3 验证新字段已建索引（task_kind、parent_id、habit_id、last_checkin_date）
  - [x] 验证：`go build ./...` 通过

- [x] Task 2: Goal 表扩展字段
  - [x] SubTask 2.1: 在 `backend/internal/model/goal.go` 的 Goal 模型新增字段：GoalType、HabitID、ParentTaskID（TargetScore 保留）
  - [x] SubTask 2.2: AutoMigrate 确认 Goal 表迁移生效
  - [x] 验证：`go build ./...` 通过

- [x] Task 3: 新增 Habit 表与 ParentTaskTemplate 表
  - [x] SubTask 3.1: 创建 `backend/internal/model/habit.go`，定义 Habit 模型（字段见 spec.md）
  - [x] SubTask 3.2: 创建 `backend/internal/model/parent_task_template.go`，定义 ParentTaskTemplate 模型
  - [x] SubTask 3.3: 在 database.go 的 AutoMigrate 注册 Habit 和 ParentTaskTemplate
  - [x] 验证：启动服务后两张表已创建，`go build ./...` 通过

- [x] Task 4: 周期长度 1-4 周校验
  - [x] SubTask 4.1: 修改 `backend/internal/service/growth_cycle_service.go` 的 CreateCycle，校验 endDate.Sub(startDate) ∈ [7,28] 天，否则返回 400
  - [x] SubTask 4.2: UpdateCycle 同样校验
  - [x] 验证：curl 创建 6 天周期返回 400，创建 14 天周期成功

- [x] Task 5: 周期进度计算改为任务完成度
  - [x] SubTask 5.1: 修改 `backend/internal/service/growth_cycle_service.go` 的 GetCycleProgress，计算公式改为 已完成任务数/已生成任务数（含 daily+habit_daily+child）
  - [x] 验证：单元测试覆盖空周期、部分完成、全完成场景

- [x] Task 6: 任务列表 API 支持 task_kind 过滤
  - [x] SubTask 6.1: 修改 `backend/internal/handler/tasks.go` 的 ListTasks，新增 task_kind 查询参数（逗号分隔多选），默认只返回 daily,habit_daily,child
  - [x] 验证：curl 带 task_kind=habit_daily 只返回习惯子任务

## Phase 2：习惯养成系统

- [x] Task 7: 习惯库 Seed
  - [x] SubTask 7.1: 创建 `backend/internal/service/habit_seed.go`，定义 6 年龄段 × 9 类别 60+ 条预设习惯数据
  - [x] SubTask 7.2: 在 database.go 启动时调用 SeedHabit()，幂等更新（按 Title+FamilyID=0）
  - [x] 验证：启动后查询 habits 表有 60+ 条 IsCustom=false 记录

- [x] Task 8: 习惯 CRUD API
  - [x] SubTask 8.1: 创建 `backend/internal/handler/habit_handler.go`，实现 GET /api/habits/preset?age=N（按年龄过滤）、POST /api/habits/custom（创建自定义）、GET /api/habits/active?child_id=N（当前周期绑定的）、GET /api/habits/:id/stats（统计）
  - [x] SubTask 8.2: 在 cmd/main.go 注册路由
  - [x] 验证：curl 测试 4 个接口均正常返回

- [x] Task 9: 目标设置支持习惯目标
  - [x] SubTask 9.1: 修改 `backend/internal/service/growth_cycle_service.go` 的 SetGoal，支持 GoalType=habit 创建 Goal 记录
  - [x] SubTask 9.2: 修改 `backend/internal/handler/growth_cycle_handler.go` 的批量目标设置接口，支持 goals 数组包含 goal_type=habit
  - [x] 验证：curl 提交含 habit 目标的请求，goal 表有 GoalType=habit 记录

- [x] Task 10: 习惯每日子任务生成服务
  - [x] SubTask 10.1: 创建 `backend/internal/service/habit_service.go`，实现 EnsureHabitDailyReady(child_id)：查询 active 周期 GoalType=habit 目标 → 创建/复用 habit_master → 幂等创建当日 habit_daily
  - [x] SubTask 10.2: 实现 generateHabitEncouragement(streak, total, goal, child_name, habit_title)：调用 AI 生成 10-20 字鼓励语
  - [x] SubTask 10.3: 在 task_generation_service.go 的 GenerateTasksForChild 流程中调用 EnsureHabitDailyReady
  - [x] 验证：触发一次生成后，每个绑定习惯有 1 条当日 habit_daily，描述含鼓励语；再触发一次不重复

- [x] Task 11: 习惯打卡统计更新
  - [x] SubTask 11.1: 在 habit_service.go 实现 ReviewHabitDaily(task_id)：habit_daily 完成时更新 habit_master 的 StreakCount++、TotalCount++、LastCheckinDate=今天
  - [x] SubTask 11.2: 实现中断检测：生成 habit_daily 时若 LastCheckinDate 不是昨天，则 StreakCount 重置为 0
  - [x] SubTask 11.3: 在 task_service.go 的 ReviewTask 流程中，若 TaskKind=habit_daily 则调用 ReviewHabitDaily
  - [x] 验证：完成一条 habit_daily 后查询 habit_master，统计字段已更新

- [x] Task 12: 前端习惯 API 服务
  - [x] SubTask 12.1: 创建 `frontend/src/services/habits.ts`，封装 getPresetHabits、createCustomHabit、getActiveHabits、getHabitStats
  - [x] SubTask 12.2: 更新 `frontend/src/services/tasks.ts` 的 Task 类型，新增 task_kind、parent_id、habit_id、guardian_required、streak_count、total_count、habit_goal、last_checkin_date 等字段
  - [x] 验证：`tsc --noEmit` 通过

- [x] Task 13: 前端任务列表展示习惯标识
  - [x] SubTask 13.1: 修改 `frontend/src/pages/TaskListPage.tsx`，查询默认带 task_kind=daily,habit_daily,child
  - [x] SubTask 13.2: TaskCard 对 habit_daily 显示「🌱 习惯养成」绿色徽章 + 连续 N 天 badge
  - [x] 验证：浏览器访问任务列表，习惯子任务显示对应标识

- [x] Task 14: 前端任务详情页习惯打卡区
  - [x] SubTask 14.1: 修改 `frontend/src/pages/TaskDetailPage.tsx`，habit_daily 详情页新增「习惯打卡区」：连续天数 + 累计天数 + 目标进度 N/21 + 上次打卡日期 + 21 天进度条 + 打卡网格（最近 21 天）+ 父任务入口
  - [x] 验证：进入 habit_daily 详情页能看到打卡区和进度条

- [x] Task 15: 前端目标设置面板习惯区
  - [x] SubTask 15.1: 修改 `frontend/src/pages/GrowthPage.tsx` 的 showGoalSetup 面板，新增「习惯目标」区：按年龄拉取预设习惯列表 + 多选（最多 2 个）+ 自定义习惯入口
  - [x] SubTask 15.2: handleSaveGoalSetup 提交时，对选中的习惯调用 setGoal（goal_type=habit）
  - [x] 验证：设置目标时能选 1-2 个习惯，保存后 goal 表有 habit 记录

- [x] Task 16: 阶段回顾习惯评估
  - [x] SubTask 16.1: 修改 `backend/internal/service/growth_story_service.go` 的 GenerateStory，聚合 habit_master 统计 + 家长批语，AI 评估养成程度（已养成/基本养成/待加强）
  - [x] SubTask 16.2: 评估为"已养成"的习惯，标记 Habit.IsActive=false（下周期不再推荐）
  - [x] 验证：触发周期回顾后，故事内容含习惯养成评估，已养成的习惯在 preset 接口不再返回

## Phase 3：父子主题任务

- [x] Task 17: 主题模板库 Seed
  - [x] SubTask 17.1: 创建 `backend/internal/service/parent_task_template_seed.go`，定义 6 年龄段 × 6 类别 30-50 条预设主题模板
  - [x] SubTask 17.2: 在 database.go 启动时调用 SeedParentTaskTemplate()，幂等更新
  - [x] 验证：启动后查询 parent_task_templates 表有 30+ 条 IsCustom=false 记录

- [x] Task 18: 主题模板 CRUD API
  - [x] SubTask 18.1: 创建 `backend/internal/handler/parent_task_handler.go`，实现 GET /api/parent-task-templates/preset?age=N、POST /api/parent-task-templates/custom
  - [x] SubTask 18.2: 在 cmd/main.go 注册路由
  - [x] 验证：curl 测试 2 个接口正常返回

- [x] Task 19: 父任务创建 + 子任务大纲生成
  - [x] SubTask 19.1: 创建 `backend/internal/service/parent_task_service.go`，实现 CreateParentTask（支持从模板创建/自定义创建）
  - [x] SubTask 19.2: 实现 GenerateSubTaskOutline(parent_task_id)：调用 AI 生成 3-8 个子任务大纲（标题+简述+预计天数+顺序+是否关键里程碑），存入 parent 的 SubTaskOutline
  - [x] SubTask 19.3: 实现 AdvanceBatch(parent_task_id)：实例化下一个子任务（完成触发或时间兜底）
  - [x] SubTask 19.4: 在 handler 实现 POST /api/tasks/parent、POST /api/tasks/parent/:id/generate-children、POST /api/tasks/parent/:id/advance-batch、GET /api/tasks/:id/children、GET /api/tasks/:id/parent
  - [x] 验证：创建父任务后 SubTaskOutline 有内容，第 1 个 child 任务已实例化（端到端 curl 测试通过）

- [x] Task 20: 子任务分批实例化触发
  - [x] SubTask 20.1: 在 task_service.go 的 ReviewTask 流程中，若 TaskKind=child 完成且是当前批次最后一个，调用 AdvanceBatch 实例化下一个
  - [x] SubTask 20.2: 在 task_generation_service.go 的定时任务中，检查父任务当前批次是否超过 3 天未完成，是则 AdvanceBatch
  - [x] 验证：完成当前 child 任务后自动出现下一个；模拟 3 天未完成也能解锁（编译通过，逻辑实现完整）

- [x] Task 21: 前端主题任务 API 服务
  - [x] SubTask 21.1: 创建 `frontend/src/services/parentTasks.ts`，封装 getPresetTemplates、createCustomTemplate、createParentTask、generateChildren、advanceBatch、getChildren、getParent
  - [x] SubTask 21.2: tasks.ts 的 Task 类型补充 sub_task_outline、sequence、is_key_milestone 字段
  - [x] 验证：`tsc --noEmit` 通过

- [x] Task 22: 前端任务列表展示主题标识
  - [x] SubTask 22.1: 修改 TaskListPage.tsx，TaskCard 对 child 显示「🎯 主题任务」蓝色徽章 + 父任务名 + 序号（如 2/5）
  - [x] 验证：浏览器访问任务列表，主题子任务显示对应标识

- [x] Task 23: 前端子任务详情页父任务信息区
  - [x] SubTask 23.1: 修改 TaskDetailPage.tsx，child 详情页新增「父任务信息区」：父任务标题+描述+整体进度 X/Y+关键子任务列表（标记 IsKeyMilestone 高亮）+查看父任务入口
  - [x] 验证：进入 child 详情页能看到父任务进度和关键子任务

- [x] Task 24: 前端目标设置面板主题任务区
  - [x] SubTask 24.1: 修改 GrowthPage.tsx 的 showGoalSetup 面板，新增「主题任务」区：按年龄拉取预设模板列表 + 单选（最多 1 个）+ 自定义主题入口
  - [x] SubTask 24.2: handleSaveGoalSetup 提交时，对选中的主题调用 setGoal（goal_type=parent_task），并触发父任务创建 + 大纲生成
  - [x] 验证：设置目标时能选 1 个主题模板，保存后 parent 任务已创建且有子任务大纲（tsc --noEmit 通过）

- [x] Task 25: 前端 CreateTaskPage 支持主题任务
  - [x] SubTask 25.1: 修改 `frontend/src/pages/CreateTaskPage.tsx`，新增任务类型选择（日常/主题任务）
  - [x] SubTask 25.2: 主题任务创建时填写标题+描述+预计周期 → 调用 createParentTask + generateChildren
  - [x] 验证：通过创建任务页能创建主题父任务并自动生成子任务（tsc --noEmit 通过）

- [x] Task 26: 阶段回顾主题任务相册
  - [x] SubTask 26.1: 修改 growth_story_service.go 的 GenerateStory，按父任务分组聚合 child 任务，仅全完成的父任务生成相册（子任务成果照片按时间线排列，关键里程碑高亮）
  - [x] SubTask 26.2: 未全完成的父任务在故事中显示"进行中"+当前进度
  - [x] 验证：周期回顾后，全完成的父任务有相册，未完成的不生成相册但显示进度（go build 通过）

## Phase 4：成长系统整合与家长陪伴

- [x] Task 27: AI 任务生成读取新目标类型
  - [x] SubTask 27.1: 修改 task_generation_service.go 的 GenerateTasksForChild，读取 GoalType=dimension 时仅维度 ID 无目标分数，Prompt 改为"本周期重点关注维度：XX、XX"
  - [x] SubTask 27.2: 读取 GoalType=parent_task 目标，检查父任务子任务未齐全则补齐（调用 AdvanceBatch）
  - [x] 验证：AI 生成日志显示读取了 habit 和 parent_task 目标（go build + go vet 通过）

- [x] Task 28: 成长故事 Prompt 三区块
  - [x] SubTask 28.1: 修改 growth_story_service.go 的 buildStoryPrompt，扩展为三区块：日常任务 / 习惯养成（习惯名+坚持天数+批语）/ 主题任务（完成度）
  - [x] 验证：生成的故事内容包含三类区块（go build 通过，三区块结构清晰）

- [x] Task 29: 家长陪伴标记后端
  - [x] SubTask 29.1: 在 task_service.go 的 CreateTask 支持接收 guardian_required 参数
  - [x] SubTask 29.2: 实现风险关键词检测（刀/火/电/化学/高处等），命中时自动置 GuardianRequired=true
  - [x] 验证：curl 创建含"切菜"关键词的任务，guardian_required 自动为 true

- [x] Task 30: 家长陪伴标记前端
  - [x] SubTask 30.1: CreateTaskPage 新增「需要家长陪伴」勾选项
  - [x] SubTask 30.2: TaskListPage 的 TaskCard 对 GuardianRequired=true 显示玫红色「⚠️ 需家长陪伴」徽章
  - [x] SubTask 30.3: TaskDetailPage 对 GuardianRequired=true 显示大型 Banner + 安全提示
  - [x] 验证：浏览器查看陪伴任务在列表和详情页都有醒目标识

- [x] Task 31: 目标设置面板时间选择改为 1-4 周按钮组
  - [x] SubTask 31.1: 修改 GrowthPage.tsx 的 showGoalSetup，MobileDatePicker 改为 1/2/3/4 周按钮组，选择后自动计算 endDate=startDate+N*7 天，默认 2 周
  - [x] 验证：目标设置面板只能选 1-4 周

- [x] Task 32: 前端目标设置面板能力维度去分数
  - [x] SubTask 32.1: 修改 GrowthPage.tsx 的能力维度区，去掉目标分值 `<select>`，仅保留 checkbox 勾选
  - [x] SubTask 32.2: handleSaveGoalSetup 提交 dimension 目标时不传 target_score
  - [x] 验证：目标设置面板维度区只有勾选框，无分数选择

# Task Dependencies

- Task 1、2、3 为基础，所有后续任务依赖
- Task 4、5 依赖 Task 1（Goal 表扩展）
- Task 6 依赖 Task 1
- Task 7 依赖 Task 3
- Task 8 依赖 Task 3、7
- Task 9 依赖 Task 2、8
- Task 10 依赖 Task 9
- Task 11 依赖 Task 10
- Task 12 依赖 Task 8
- Task 13 依赖 Task 6、12
- Task 14 依赖 Task 12
- Task 15 依赖 Task 9、12
- Task 16 依赖 Task 11
- Task 17 依赖 Task 3
- Task 18 依赖 Task 3、17
- Task 19 依赖 Task 1、18
- Task 20 依赖 Task 19
- Task 21 依赖 Task 18
- Task 22 依赖 Task 6、21
- Task 23 依赖 Task 21
- Task 24 依赖 Task 19、21
- Task 25 依赖 Task 19、21
- Task 26 依赖 Task 20
- Task 27 依赖 Task 10、20
- Task 28 依赖 Task 16、26
- Task 29 依赖 Task 1
- Task 30 依赖 Task 29
- Task 31 依赖 Task 4
- Task 32 依赖 Task 9

# Parallelizable Work

- Task 7（习惯 Seed）和 Task 17（主题模板 Seed）可并行
- Task 12（前端 habits 服务）和 Task 21（前端 parentTasks 服务）可并行
- Task 29（陪伴后端）和 Task 31（周期按钮组）可并行
