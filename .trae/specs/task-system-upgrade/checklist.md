# Checklist

## Phase 1：数据模型与基础 API
- [x] Task 表新增 11 个字段（TaskKind/ParentID/HabitID/GuardianRequired/StreakCount/TotalCount/HabitGoal/LastCheckinDate/SubTaskOutline/Sequence/IsKeyMilestone）并迁移生效
- [x] Goal 表新增 3 个字段（GoalType/HabitID/ParentTaskID）并迁移生效
- [x] Habit 表和 ParentTaskTemplate 表已创建并迁移生效
- [x] Task 表新增索引 task_kind/parent_id/habit_id/last_checkin_date
- [x] CreateCycle 校验周期长度 1-4 周（<7 或 >28 返回 400）
- [x] UpdateCycle 同样校验周期长度
- [x] GetCycleProgress 改为任务完成度计算（已完成/已生成）
- [x] ListTasks 支持 task_kind 查询参数，默认只返回 daily,habit_daily,child

## Phase 2：习惯养成系统
- [x] Habit 预设库 Seed 60+ 条，6 年龄段 × 9 类别，幂等更新
- [x] GET /api/habits/preset?age=N 按年龄过滤返回
- [x] POST /api/habits/custom 创建自定义习惯（IsCustom=true）
- [x] GET /api/habits/active?child_id=N 返回当前周期绑定的习惯
- [x] GET /api/habits/:id/stats 返回连续/累计/目标/打卡日历
- [x] SetGoal 支持 GoalType=habit 创建 Goal 记录
- [x] 批量目标设置接口支持 goals 数组含 goal_type=habit
- [x] EnsureHabitDailyReady 幂等生成当日 habit_daily（同一天同 HabitID 不重复）
- [x] habit_daily 描述由 AI 生成 10-20 字鼓励语（基于坚持天数）
- [x] ReviewHabitDaily 完成时更新 habit_master 的 StreakCount+1/TotalCount+1/LastCheckinDate
- [x] 中断检测：LastCheckinDate 非昨天时 StreakCount 重置为 0
- [x] ReviewTask 流程对 TaskKind=habit_daily 调用 ReviewHabitDaily
- [x] 前端 habits.ts 封装 4 个 API
- [x] 前端 tasks.ts Task 类型含新字段
- [x] TaskListPage 查询默认带 task_kind=daily,habit_daily,child
- [x] TaskCard 对 habit_daily 显示「🌱 习惯养成」绿色徽章 + 连续 N 天 badge
- [x] TaskDetailPage habit_daily 显示习惯打卡区（连续/累计/目标/进度条/打卡网格/父任务入口）
- [x] GrowthPage 目标设置面板含「习惯目标」区（按年龄推荐 + 多选最多 2 个 + 自定义入口）
- [x] handleSaveGoalSetup 对习惯调用 setGoal（goal_type=habit）
- [x] GenerateStory 聚合 habit 统计 + 家长批语，AI 评估养成程度
- [x] 评估为"已养成"的习惯 IsActive=false，下周期 preset 不返回

## Phase 3：父子主题任务
- [x] ParentTaskTemplate 预设库 Seed 30-50 条，6 年龄段 × 6 类别，幂等更新
- [x] GET /api/parent-task-templates/preset?age=N 按年龄过滤
- [x] POST /api/parent-task-templates/custom 创建自定义模板
- [x] CreateParentTask 支持从模板创建/自定义创建
- [x] GenerateSubTaskOutline AI 生成 3-8 个子任务大纲存入 parent 的 SubTaskOutline
- [x] 首批实例化：大纲生成后立即创建第 1 个 child（Sequence=1, Status=1）
- [x] AdvanceBatch 实例化下一个子任务
- [x] POST /api/tasks/parent、/api/tasks/parent/:id/generate-children、/api/tasks/parent/:id/advance-batch 接口可用
- [x] GET /api/tasks/:id/children 返回子任务列表（含已实例化 + 大纲未实例化）
- [x] GET /api/tasks/:id/parent 返回父任务详情
- [x] ReviewTask 对 TaskKind=child 完成且为当前批次最后时调用 AdvanceBatch
- [x] 定时任务检查父任务当前批次超过 3 天未完成则 AdvanceBatch
- [x] 前端 parentTasks.ts 封装 7 个 API
- [x] tasks.ts Task 类型含 sub_task_outline/sequence/is_key_milestone
- [x] TaskCard 对 child 显示「🎯 主题任务」蓝色徽章 + 父任务名 + 序号（2/5）
- [x] TaskDetailPage child 显示父任务信息区（标题/描述/进度/关键子任务/查看入口）
- [x] GrowthPage 目标设置面板含「主题任务」区（按年龄推荐 + 单选最多 1 个 + 自定义）
- [x] handleSaveGoalSetup 对主题调用 setGoal 并触发父任务创建 + 大纲生成
- [x] CreateTaskPage 新增任务类型选择（日常/主题任务）
- [x] 主题任务创建流程：填写主题 → createParentTask → generateChildren
- [x] GenerateStory 按父任务分组聚合 child，仅全完成父任务生成相册
- [x] 相册按时间线排列子任务成果照片，关键里程碑高亮
- [x] 未全完成父任务在故事中显示"进行中"+当前进度

## Phase 4：成长系统整合与家长陪伴
- [x] AI 任务生成读取 GoalType=dimension 仅维度 ID 无目标分数
- [x] AI Prompt 改为"本周期重点关注维度：XX、XX"
- [x] AI 任务生成读取 GoalType=parent_task 目标并补齐子任务
- [x] buildStoryPrompt 扩展为三区块（日常/习惯/主题）
- [x] CreateTask 接收 guardian_required 参数
- [x] 风险关键词检测（刀/火/电/化学/高处等）自动置 GuardianRequired=true
- [x] CreateTaskPage 新增「需要家长陪伴」勾选项
- [x] TaskCard 对 GuardianRequired=true 显示玫红色「⚠️ 需家长陪伴」徽章
- [x] TaskDetailPage 对 GuardianRequired=true 显示大型 Banner + 安全提示
- [x] GrowthPage 目标设置时间选择改为 1-4 周按钮组（默认 2 周）
- [x] 选择周数后自动计算 endDate=startDate+N*7 天
- [x] 能力维度区去掉目标分值 select，仅保留 checkbox 勾选
- [x] handleSaveGoalSetup 提交 dimension 目标时不传 target_score

## 构建与编译验证
- [x] `go build ./...` 通过
- [x] `tsc --noEmit` 通过
- [ ] 服务启动无 panic，AutoMigrate 成功（需运行时验证）
- [ ] Habit Seed 和 ParentTaskTemplate Seed 执行成功（需运行时验证）
