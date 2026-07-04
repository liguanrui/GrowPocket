# 任务模板与积分调整改进计划

## Summary

针对用户提出的 4 项需求进行改进：
1. 为每个家庭初始化任务模板；创建任务页面的「常见任务」改为从任务模板列表 API 获取。
2. 确认完成任务图片的来源（`https://picsum.photos/400/300?random=${Date.now()}`）。
3. 加减积分改为二级页面，图片不需要实际上传，使用类似完成任务的随机图片。
4. 修复加减积分后任务看板不刷新的 BUG。

## Current State Analysis

### 任务模板（TaskTemplate）
- 数据模型在 [achievement.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/backend/internal/model/achievement.go#L73-L88)，按 family 维度存储，分类：学习/家务/行为习惯/运动/其他。
- 后端 CRUD 服务在 [task_template_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/backend/internal/service/task_template_service.go)，路由 `GET/POST/PUT/DELETE /api/task-templates`。
- 前端服务 [taskTemplates.ts](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/services/taskTemplates.ts) 已有 `listTaskTemplates()`，但创建任务页面未使用。
- **无任何 seed 数据**：[database.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/backend/internal/database/database.go) 只有 `seedCommunityData`（公益项目），家庭在 [auth_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/backend/internal/service/auth_service.go#L52-L71) Register 中动态创建，未初始化模板。

### 创建任务页面的「常见任务」
- [CreateTaskPage.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/pages/CreateTaskPage.tsx#L129-L162) 的 `TaskTemplates` 组件使用**硬编码的 6 个任务**，未调用 API。
- 选择后只设置表单的 `title/description/points`，未调用 `createTaskFromTemplate`，未关联 `template_id`。

### 完成任务图片来源
- [TaskDetailPage.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/pages/TaskDetailPage.tsx#L15-L47) 的 `PhotoUploader` 使用 `https://picsum.photos/400/300?random=${Date.now()}`（picsum.photos 随机图片），**非真实上传**。
- 后端 [tasks.go SubmitTask](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/backend/internal/handler/tasks.go) 同时支持 multipart 文件上传和 JSON `{ photo: "url" }`，前端走 JSON 路径。

### 加减积分（当前为弹窗）
- [HomePage.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/pages/HomePage.tsx#L57-L182) 的 `ScoreAdjustModal` 是底部弹窗，由 `scoreModalMode` 状态控制。
- 图片上传使用 `FileReader.readAsDataURL` 转 base64（[L73-L82](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/pages/HomePage.tsx#L73-L82)）。
- 后端 [score_service.go Adjust](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/backend/internal/service/score_service.go#L72-L160) 接受 `photo` 字符串字段。
- `/score` 路由的 [ScorePage.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/pages/ScorePage.tsx) 是只读的历史/趋势页。

### 任务看板刷新 BUG
- [HomePage.tsx handleScoreAdjust](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/pages/HomePage.tsx#L418-L430) 加减积分后只更新 `balance` 和 `childStore.updateBalance`，**未重新加载任务列表**。
- 后端 `Adjust` 会创建一条 `status=3` 的任务记录，这条记录不会出现在看板中，直到重新挂载或切换孩子触发 `loadData()`。

## Proposed Changes

### 变更 1：任务模板初始化（后端）

**目标**：每个家庭创建时获得初始任务模板；已有家庭补齐。

**文件**：[backend/internal/service/task_template_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/backend/internal/service/task_template_service.go)

新增 `SeedInitialTemplates(familyID, createdBy uint) error` 方法：
- 先查询该 family 是否已有模板（`Count == 0` 才 seed，保证幂等）。
- 插入以下 6 个默认模板（与当前硬编码一致，覆盖各类别）：
  - 整理房间 / 整理床铺、叠好衣物 / 50 / 🏠 / 家务
  - 洗碗 / 洗完饭后所有碗筷 / 30 / 🍽️ / 家务
  - 阅读30分钟 / 阅读课外书籍30分钟 / 60 / 📚 / 学习
  - 倒垃圾 / 把家里的垃圾倒到楼下 / 15 / 🗑️ / 家务
  - 完成作业 / 认真完成当日作业 / 80 / ✏️ / 学习
  - 户外运动 / 户外活动1小时 / 60 / ⚽ / 运动

**文件**：[backend/internal/service/auth_service.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/backend/internal/service/auth_service.go#L52-L71)

在 `Register` 的 `tx.Commit()` 之后，调用 `NewTaskTemplateService().SeedInitialTemplates(family.ID, user.ID)`，失败仅记日志不阻断注册流程。

**文件**：[backend/internal/database/database.go](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/backend/internal/database/database.go#L54-L79)

新增 `seedTaskTemplatesForExistingFamilies(db)`，在 `Init` 中 `seedCommunityData` 之后调用：
- 查询所有 `TaskTemplate` 数为 0 的 `Family`。
- 对每个家庭调用 `NewTaskTemplateService().SeedInitialTemplates(family.ID, family.CreatedBy)`（`created_by` 用 0 或家庭创建者，由于 Family 模型无 CreatedBy 字段，统一用 0 表示系统初始化）。

> 注：`Family` 模型无 `CreatedBy`，已有家庭的 `created_by` 填 0（系统）；新注册家庭的 `created_by` 填家长 user.ID。

### 变更 2：创建任务页「常见任务」改为拉取模板列表（前端）

**文件**：[frontend/src/pages/CreateTaskPage.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/pages/CreateTaskPage.tsx#L129-L162)

重写 `TaskTemplates` 组件：
- 移除硬编码数组。
- 在 `CreateTaskPage` 顶层 `useEffect` 中调用 `listTaskTemplates()` 获取模板列表，过滤 `is_active === true`，存入 state（如 `templates`）。
- 传给 `TaskTemplates` 组件渲染：显示 `icon` + `title` + `+{points} 积分`。
- 选择模板后 `onPick(template.title, template.description, template.points)`，保持现有表单回填逻辑（不调用 `createTaskFromTemplate`，因为创建任务页本身会提交）。
- 加载中显示骨架/占位；为空时隐藏该区块或提示「暂无模板，去设置页添加」。

**文件**：[frontend/src/pages/CreateTaskPage.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/pages/CreateTaskPage.tsx#L176-L202)

`loadData` 中并行调用 `listTaskTemplates()` 并设置 state。

> 说明：本变更只让「常见任务」展示来自后端的模板，不在选择时直接创建任务。选择仍只回填表单字段，最终由 `handleSubmit` 统一创建任务（与现有交互一致，避免一次创建多个任务）。

### 变更 3：完成任务图片来源（确认，无代码改动）

**确认**：完成任务图片来源为 `https://picsum.photos/400/300?random=${Date.now()}`（picsum.photos 随机图），非真实上传。变更 4 的积分页图片将复用此来源。

### 变更 4：加减积分改为二级页面 + 随机图片（前端）

**新增文件**：`frontend/src/pages/ScoreAdjustPage.tsx`

- 路由：`/score/adjust?mode=add|deduct&child_id=xxx`（在 [App.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/App.tsx#L62-L75) 增加 Route）。
- 页面结构参考 `CreateTaskPage` 顶部渐变 header + 表单卡片 + 底部 sticky 提交按钮。
- 字段：金额（预设 10/50/100/200 + 自定义）、标题、备注、图片。
- 图片使用随机 picsum：点击「上传图片」按钮生成 `https://picsum.photos/400/300?random=${Date.now()}` 并展示，可重新生成。移除 `FileReader/base64` 逻辑。
- 提交调用 `scoreService.addPoints` / `deductPoints`，成功后 `navigate('/home')`（回到首页会重新挂载并 `loadData()`）。
- `deduct` 模式：若金额 > 余额，按钮禁用并提示「余额不足」。
- 从 `useChildStore` / URL `child_id` 获取当前孩子 ID 和余额。

**文件**：[frontend/src/App.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/App.tsx#L11)

- import `ScoreAdjustPage`。
- 在 MainLayout 子路由中增加 `<Route path="score/adjust" element={<ScoreAdjustPage />} />`。

**文件**：[frontend/src/pages/HomePage.tsx](file:///Users/Admin1/.trae-cn/worktrees/GrowPocket/feat-task-template-and-points-pwQgdl/frontend/src/pages/HomePage.tsx)

- 删除 `ScoreAdjustModal` 组件（L57-L182）及相关 import（`ImagePlus`, `Send`, `X` 若不再使用）。
- 删除 `scoreModalMode` state（L359）和 `{scoreModalMode && <ScoreAdjustModal .../>}` 渲染（L516-L523）。
- `PointsCard` 的 `onAdd` / `onDeduct` 改为 `navigate('/score/adjust?mode=add&child_id=...')` / `mode=deduct`。
- `handleScoreAdjust` 删除（已移到新页面）。

### 变更 5：修复任务看板刷新 BUG（前端，随变更 4 自然解决）

**机制**：加减积分改为二级页面后，提交成功 `navigate('/home')` 会重新挂载 `HomePage`，触发 `useEffect` → `loadData()` 重新拉取任务列表（包括 `Adjust` 创建的 status=3 任务）。

**额外保险**：在 `HomePage` 的 `useEffect` 依赖数组已为 `[selectedChildId]`，挂载即加载，足够覆盖。无需额外代码。

## Assumptions & Decisions

1. **初始模板内容**：复用当前 `CreateTaskPage` 硬编码的 6 个常见任务，新增 emoji 与分类字段。
2. **覆盖范围**：对新注册家庭和已有（模板数为 0 的）家庭都 seed，保证「每个家庭」都有初始模板。`seed` 幂等（已有模板则跳过）。
3. **创建任务页交互不变**：「常见任务」点击仅回填表单，不直接创建任务（与现状一致）。
4. **图片来源**：统一使用 `https://picsum.photos/400/300?random=${Date.now()}`，与完成任务图片一致，不做真实上传。
5. **路由**：新页面路径 `/score/adjust`，与现有 `/score`（只读历史页）区分。
6. **`created_by`**：已有家庭补齐时 `created_by=0`（系统）；新家庭用家长 ID。

## Verification Steps

1. **后端编译**：`cd backend && go build ./...`
2. **前端编译**：`cd frontend && npm run build`
3. **任务模板 seed**：
   - 新注册家庭 → 模板列表应有 6 条。
   - 已有家庭（模板为 0）→ 重启后端后应有 6 条。
   - 已有模板的家庭 → 重启后端模板数量不变（幂等）。
4. **创建任务页常见任务**：进入 `/tasks/new`，「常见任务」区块应展示来自后端的模板；点击后回填标题/描述/积分。
5. **加减积分页面**：
   - 首页点「加积分」/「减积分」→ 跳转 `/score/adjust?mode=...`。
   - 图片按钮点击后显示随机图，可重置。
   - 提交后返回 `/home`，任务看板「已完成」分类应出现刚创建的奖惩任务，余额与统计刷新。
6. **BUG 验证**：加减积分后返回首页，切到「已完成」或「全部」tab，应看到新记录；余额数字正确。
