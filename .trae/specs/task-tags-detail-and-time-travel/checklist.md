# Checklist

## Phase 1：任务标签系统统一
- [x] `getTaskTags(task)` 工具函数实现，覆盖 6 种标签规则
- [x] 标签顺序稳定：家长陪伴 > 关键里程碑 > 主题任务 > 习惯养成 > AI 生成 > 手动创建
- [x] TaskCard 集成统一标签，移除原有「AI 生成」单独展示
- [x] TaskCard 标签最多显示 3 个，超出折叠为「+N」
- [x] TaskDetailPage 顶部集成统一标签（详情页全部展示不折叠）
- [x] 标签颜色遵循 spec：violet/emerald/blue/amber/rose/gray
- [x] `npx tsc --noEmit` 通过

## Phase 2：主题任务详情阶段流水
- [x] parent 任务详情页（task_kind='parent'）显示阶段流水区块
- [x] 主题头部含标题、描述、类别徽章、总预计周期
- [x] 时间线纵向展示所有子任务大纲（已实例化 + 虚拟）
- [x] 已完成节点：绿色实心圆 + 完成日期 + 🌟 关键里程碑标记
- [x] 进行中节点：橙色脉冲圆 + 「进行中」徽章
- [x] 未开始节点：灰色空心圆 + 「未开始」徽章
- [x] 整体进度条显示 X/Y 完成数和百分比
- [x] 关键里程碑专区（金色卡片）展示所有 is_key_milestone=true 子任务
- [x] `npx tsc --noEmit` 通过

## Phase 3：每日任务详情累计统计
- [x] 后端新增 `GET /api/growth-cycles/cycle-stats?child_id=N` 接口
- [x] 返回结构含 completed_task_count、total_points_earned、focus_dim_names、days_remaining
- [x] 路由注册并鉴权（仅家长可访问）
- [x] 前端 `getCycleStats(childId)` API 封装
- [x] daily 任务详情页显示「本周期累计：X 个任务 · Y 积分」
- [x] 显示关联能力维度（维度名 + 当前分数）
- [x] 显示周期目标提示（本周期重点关注：XX、XX）
- [x] `go build` 通过
- [x] `npx tsc --noEmit` 通过

## Phase 4：时间穿越测试功能
- [x] 新建 `backend/internal/util/timeutil/timeutil.go` 包
- [x] `Now()` 函数默认返回 time.Now()，设置后返回虚拟时间
- [x] `SetVirtualTime` / `AdvanceTime` / `ResetTime` / `IsVirtual` / `GetVirtualTime` 函数实现
- [x] 使用 sync.RWMutex 保证线程安全
- [x] habit_service.go 中 time.Now() 替换为 timeutil.Now()（约 3 处）
- [x] task_generation_service.go 中 time.Now() 替换（约 6 处，StartDailyScheduler 保留 time.Now）
- [x] task_service.go ReviewTask 中时间判断替换（不适用：ReviewTask 无 time.Now() 调用，已确认）
- [x] growth_story_handler.go 中时间替换（如需）（不适用：无 time.Now() 调用，已确认）
- [x] 新建 debug_handler.go，实现 advance-time / reset-time / get-time 三个接口
- [x] advance-time 接口主动触发 GenerateForAllChildren + CheckStaleParentTasks
- [x] 路由仅当 APP_ENV=development 时注册
- [x] 前端新建 `services/debug.ts` 封装 3 个 API
- [x] SettingsPage 新增调试入口，仅 `import.meta.env.DEV` 时显示
- [x] 调试面板显示当前虚拟时间
- [x] 「快进 1 天」「快进 7 天」按钮触发后任务列表刷新
- [x] 「重置时间」按钮可恢复真实时间
- [x] 生产环境（APP_ENV != development）debug API 返回 404
- [x] `go build` 通过
- [x] `npx tsc --noEmit` 通过

## Phase 5：集成验证
- [x] e2e_test_flow.sh 扩展含时间穿越测试段
- [x] 快进 1 天后验证新 habit_daily 生成
- [x] 快进 4 天后验证主题子任务兜底推进
- [x] reset-time 后验证恢复真实时间
- [x] 浏览器中验证 TaskCard 标签显示正确（需运行时验证）
- [x] 浏览器中验证 parent 阶段流水显示正确（需运行时验证）
- [x] 浏览器中验证 daily 累计统计显示正确（需运行时验证）
