# Tasks

## Phase 1：任务标签系统统一（前端为主，可并行）

- [x] Task 1: 抽取任务标签计算工具函数
  - [x]SubTask 1.1: 在 `frontend/src/components/TaskCard.tsx` 顶部（或新增 `frontend/src/utils/taskTags.ts`）实现 `getTaskTags(task: Task): {label, color}[]`，按规则返回标签数组：AI 生成/习惯养成/主题任务/关键里程碑/家长陪伴/手动创建
  - [x]SubTask 1.2: 标签最多展示 3 个，超出折叠为「+N」（点击展开显示全部，可选实现）
  - [x]验证：单元覆盖 6 种标签规则，多种属性组合时顺序稳定（推荐顺序：家长陪伴 > 关键里程碑 > 主题任务 > 习惯养成 > AI 生成 > 手动创建）

- [x] Task 2: TaskCard 集成统一标签
  - [x]SubTask 2.1: 修改 `frontend/src/components/TaskCard.tsx`，移除原有「AI 生成」单独展示逻辑，改为调用 `getTaskTags(task)` 渲染标签列表
  - [x]SubTask 2.2: 标签样式遵循 spec 中定义的 Tailwind 类名（violet/emerald/blue/amber/rose/gray）
  - [x]验证：TaskCard 在 habit_daily/parent/child/daily + guardian_required 等组合下标签显示正确

- [x] Task 3: TaskDetailPage 顶部集成统一标签
  - [x]SubTask 3.1: 修改 `frontend/src/pages/TaskDetailPage.tsx`，在任务标题下方调用 `getTaskTags(task)` 展示完整标签列表（详情页不折叠，全部展示）
  - [x]验证：详情页顶部标签与卡片一致

## Phase 2：主题任务详情阶段流水（前端为主）

- [x] Task 4: parent 任务详情新增「阶段流水」区块
  - [x]SubTask 4.1: 修改 `frontend/src/pages/TaskDetailPage.tsx`，当 `task.task_kind === 'parent'` 时渲染阶段流水区块（替代/补充默认任务信息）
  - [x]SubTask 4.2: 主题头部：标题、描述、类别徽章、总预计周期（来自 parent_task_template 或 task 自身字段）
  - [x]SubTask 4.3: 时间线纵向列表：遍历 `getChildren(parent_id)` 返回的「已实例化 + 大纲虚拟」子任务，按 sequence 排序
    - 已完成（status=3）：绿色实心圆 + 完成日期（updated_at）+ 标题 + 🌟 关键里程碑标记
    - 进行中（status≠3 且 id≠0）：橙色脉冲圆 + 标题 + 「进行中」徽章
    - 未开始（id=0 虚拟）：灰色空心圆 + 大纲标题 + 「未开始」徽章
  - [x]SubTask 4.4: 整体进度条：已完成 X/Y，带百分比和颜色渐变
  - [x]SubTask 4.5: 关键里程碑专区：所有 `is_key_milestone=true` 的子任务金色卡片，含完成状态
  - [x]验证：打开 parent 任务详情能看到 5-7 个阶段的时间线，进行中节点有脉冲动画

## Phase 3：每日任务详情累计统计（前后端协同）

- [x] Task 5: 后端新增「周期累计」查询接口
  - [x]SubTask 5.1: 在 `backend/internal/handler/growth_cycle_handler.go`（或 task_handler）新增 `GET /api/growth-cycles/cycle-stats?child_id=N` 接口
  - [x]SubTask 5.2: 返回结构：`{completed_task_count, total_points_earned, focus_dim_names: [], days_remaining}`
    - completed_task_count：本周期内 status=3 且 task_kind=daily 的任务数
    - total_points_earned：上述任务的 points 之和
    - focus_dim_names：从 GoalType=dimension 的 Goal 关联 AbilityDimension 取名称列表
    - days_remaining：周期剩余天数（end_date - now）
  - [x]SubTask 5.3: 在 `cmd/main.go` 注册路由（需鉴权）
  - [x]验证：curl 调用返回正确统计数据

- [x] Task 6: 前端 daily 任务详情新增「本周期累计」区块
  - [x]SubTask 6.1: 在 `frontend/src/services/growthCycle.ts` 封装 `getCycleStats(childId)` API
  - [x]SubTask 6.2: 修改 `frontend/src/pages/TaskDetailPage.tsx`，当 `task.task_kind === 'daily'`（或为空且非 habit/parent/child）时渲染「本周期累计」区块
    - 累计完成任务数 · 累计获得积分
    - 关联能力维度（若 task.ability_dimension_id 有值，显示维度名 + 当前分数，需调用 getChildScores）
    - 周期目标提示（focus_dim_names 不为空时显示「本周期重点关注：XX、XX」）
  - [x]验证：daily 任务详情底部显示累计统计

## Phase 4：时间穿越测试功能（前后端协同）

- [x] Task 7: 后端虚拟时钟包
  - [x]SubTask 7.1: 新建 `backend/internal/util/timeutil/timeutil.go`
    - 包级变量 `virtualTime *time.Time`（nil 表示用真实时间）
    - `Now() time.Time`：若 virtualTime 为 nil 返回 `time.Now()`，否则返回 *virtualTime
    - `SetVirtualTime(t time.Time)`：设置虚拟时间
    - `AdvanceTime(days int)`：推进 N 天（同时触发 `CheckStaleParentTasks` 等兜底逻辑？由调用方决定）
    - `ResetTime()`：清除虚拟时间
    - `IsVirtual() bool`：是否处于虚拟时间模式
    - `GetVirtualTime() time.Time`：返回当前虚拟时间（IsVirtual=false 时返回 time.Now()）
  - [x]SubTask 7.2: 线程安全：使用 sync.RWMutex 保护 virtualTime 读写
  - [x]验证：单元测试或 main 中临时调用验证

- [x] Task 8: 关键服务替换 time.Now() 为 timeutil.Now()
  - [x]SubTask 8.1: `backend/internal/service/habit_service.go` 中所有 `time.Now()` 替换为 `timeutil.Now()`（约 3 处：EnsureHabitDailyReady 中的 now/today/tomorrow、ReviewHabitDaily 中的 now）
  - [x]SubTask 8.2: `backend/internal/service/task_generation_service.go` 替换 `time.Now()`（约 6 处：hasTodayAITask、CheckStaleParentTasks、StartDailyScheduler 的 next 计算可保留 time.Now 避免影响定时器）
  - [x]SubTask 8.3: `backend/internal/service/task_service.go` ReviewTask 中的时间判断替换（若有）
  - [x]SubTask 8.4: `backend/internal/handler/growth_story_handler.go` GenerateStory 触发逻辑中的时间替换（若有）
  - [x]验证：go build 通过，正常功能不受影响

- [x] Task 9: 后端 debug API
  - [x]SubTask 9.1: 新建 `backend/internal/handler/debug_handler.go`
    - `POST /api/debug/advance-time` body `{"days":1}`：调用 `timeutil.AdvanceTime(days)`，并主动触发 `GenerateForAllChildren()` + `CheckStaleParentTasks(all children)` 让快进立即生效
    - `POST /api/debug/reset-time`：调用 `timeutil.ResetTime()`
    - `GET /api/debug/time`：返回 `{current_time, is_virtual, real_time}`
  - [x]SubTask 9.2: 在 `cmd/main.go` 注册路由，仅当 `os.Getenv("APP_ENV") == "development"` 时注册（生产环境不暴露）
  - [x]验证：curl 调用 advance-time 后查询 time 返回正确虚拟时间

- [x] Task 10: 前端调试入口
  - [x]SubTask 10.1: 新建 `frontend/src/services/debug.ts` 封装 3 个 API
  - [x]SubTask 10.2: 修改 `frontend/src/pages/SettingsPage.tsx`（或新增 `DebugPanel.tsx` 组件），仅当 `import.meta.env.DEV` 为 true 时显示「调试工具」区块
    - 显示当前虚拟时间（调用 get-time API）
    - 「快进 1 天」「快进 7 天」按钮：调用 advance-time 后触发 `useUiStore.setNeedRefreshTasks(true)` 或主动刷新当前页
    - 「重置时间」按钮
  - [x]SubTask 10.3: 在 SettingsPage 顶部加入口（仅 DEV），点击展开调试面板
  - [x]验证：开发环境打开设置页能看到调试工具，点击快进后任务列表刷新

## Phase 5：集成验证

- [x] Task 11: 端到端验证脚本
  - [x]SubTask 11.1: 扩展 `scripts/e2e_test_flow.sh`，在生成任务后增加：
    - 调用 advance-time 1 天 → 验证新 habit_daily 生成
    - 调用 advance-time 4 天 → 验证主题子任务兜底推进
    - 调用 reset-time → 验证恢复真实时间
  - [x]SubTask 11.2: 验证 TaskCard 标签、parent 阶段流水、daily 累计统计在浏览器中显示正确
  - [x]验证：完整流程跑通

# Task Dependencies
- Task 2、Task 3 依赖 Task 1
- Task 4 独立（仅前端，依赖现有 getChildren API）
- Task 6 依赖 Task 5（后端接口）
- Task 8 依赖 Task 7
- Task 9 依赖 Task 7、Task 8
- Task 10 依赖 Task 9
- Task 11 依赖所有前置任务
- 可并行：Task 1-3（标签）/ Task 4（阶段流水）/ Task 5-6（累计统计）/ Task 7-9（虚拟时钟后端）
