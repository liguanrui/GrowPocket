# GrowPocket「成长」模块 PRD（细化版 V2）

> 版本：V2 · 日期：2026-08-01
> 范围：仅「成长」Tab 模块的产品需求与 UI/数据规格
> 关联：本 PRD 在 V3 总 PRD 基础上对「成长」模块做进一步细化

---

## 一、模块定位

「成长」是 GrowPocket 的核心价值呈现模块，以**阶段回顾**为节奏单位，帮助家长看见孩子在不同能力维度上的成长轨迹，并通过积分兑换激励持续行动。

### 核心理念
- **能力指数 ≠ 任务实时累加**：能力指数是阶段性总结评定，只在「阶段回顾」时由 AI 基于本阶段任务完成情况重新评定（修复历史 BUG）。
- **成长故事历史是主单元**：每个阶段回顾生成一条不可变记录，聚合该阶段的目标、子任务时间线、图集、能力提升与故事正文，形成可回看的成长档案。
- **GrowthPage 是总览页**：只展示当前态（能力雷达、阶段目标进度、积分入口），历史细节全部收进成长故事详情页。

---

## 二、功能清单

| # | 功能 | 说明 | 状态 |
|---|------|------|------|
| F1 | 能力指数 | 六维能力得分（0-100），阶段回顾时 AI 重新评定 | BUG 待修 |
| F2 | 阶段目标 | 多维度目标 + 时间区间，驱动 AI 每日生成任务 | 已实现，UI 保留 |
| F3 | 积分兑换 | 入口卡片，跳转商城 | 已实现，UI 保留 |
| F4 | 成长故事历史 | 历史时间轴 + 详情页（回顾主单元） | 后端已实现，前端待补 |
| F5 | GrowthPage UI 调整 | 去掉图集/任务时间线，新增历史时间轴 | 待实施 |

---

## 三、F1 · 能力指数（BUG 修复 + 评定重构）

### 3.1 BUG 描述
- **现状**：任务完成时 `task_service.go` 调用 `AwardTaskCompletion`，按难度（easy=+1/medium=+2/hard=+3）实时累加六维得分。
- **问题**：能力得分随单次任务波动，无法体现"阶段性总结评定"语义；累加无上限、无回退机制；与阶段目标进度脱节。
- **期望**：能力指数只在「阶段回顾」时由 AI 基于本阶段任务完成情况整体重新评定。

### 3.2 评定时序（修复后）

```
问卷提交 → 写入初始基线得分（AddScoreForDimension，保留）
   ↓
日常完成任务 → 仅发放积分，不改动能力得分
   ↓
阶段回顾触发 → AI 读取周期内全部已完成任务
   ↓
AI 按维度输出 0-100 新得分（覆盖写入，非累加）
   ↓
计算各维度 Δ（新 - 旧）→ 存入 GrowthStory.ability_summary
   ↓
成长指数 = 六维得分均值 → 驱动 IP 形态进化
```

### 3.3 AI 重新评定规格
- **输入**：周期内已完成任务列表（按维度分组：任务数、难度分布、完成率）+ 问卷基线得分
- **输出**：`[{dimension_id, dimension_name, old_score, new_score, delta}]`
- **约束**：每个维度 new_score ∈ [0, 100]；覆盖写入 `ChildAbilityScore`
- **实现**：`ability_service.go` 的 `ReassessScores` 方法（已实现）

### 3.4 验收标准
- [x] 任务完成后，能力雷达图得分**不变化**（仅积分增加）
- [ ] 触发阶段回顾后，能力得分被 AI 重新评定（可升/降/持平）
- [ ] 成长指数 = 六维均值，随评定结果更新
- [ ] 成长故事详情页展示各维度 Δ

---

## 四、F2 · 阶段目标

### 4.1 功能说明
家长为当前成长阶段设置：
1. **时间区间**：start_date ~ end_date（用于触发回顾节奏）
2. **多维度目标**：为每个能力维度设置 target_score（0-100）

### 4.2 数据流
- 目标 + 累计完成情况 → 驱动 AI 每日 08:00 自动生成任务
- 阶段结束（到达 end_date 或手动触发回顾）→ 生成阶段回顾

### 4.3 UI 规格（GrowthPage 内保留）
- 卡片标题：「阶段目标」+ 时间区间角标
- 每个维度一行：维度名 + `current_score / target_score` + 进度条
- 进度条颜色：≥100% 绿色 / ≥60% 主色 / <60% 琥珀色
- 家长可见「调整阶段目标」按钮 → 弹出设置面板（时间区间 + 多维度目标输入）

### 4.4 验收标准
- [x] 支持创建周期（含时间区间）
- [x] 支持为多个维度设置目标
- [x] 进度条正确反映 current/target
- [x] 家长可调整目标

---

## 五、F3 · 积分兑换

### 5.1 功能说明
GrowthPage 保留积分兑换入口卡片，点击跳转 `/mall`，不在成长模块内嵌兑换区。

### 5.2 UI 规格
- 卡片：奖杯图标 + 「积分兑换」+ 「用积分兑换奖励」+ 右箭头
- 顶部统计区保留「累计积分」展示

### 5.3 验收标准
- [x] 入口卡片正常跳转商城
- [x] 累计积分正确展示

---

## 六、F4 · 成长故事历史（核心：回顾主单元）

### 6.1 概念定义：回顾主单元
每条成长故事记录 = 一个阶段的完整回顾档案，包含：

| 组成部分 | 数据来源 | 展示形式 |
|---------|---------|---------|
| 阶段目标达成 | 周期 goals + 最终得分 | 进度条对比（目标 vs 实际） |
| 子任务时间线 | 周期内已完成任务（`GetCycleTasks`） | 按时间正序列表 |
| 能力提升摘要 | `ability_summary` JSON | 各维度 Δ 标签 |
| 回顾总结故事 | AI 生成的 title + content | 故事正文 |
| 故事图集 | `photo_urls` JSON（周期内精选） | 横向滑动图集 |

### 6.2 历史列表（GrowthPage 内）
- **数据源**：`listStories(childId, page, pageSize)`
- **排序**：按 created_at 倒序
- **卡片展示**：故事标题 + 周期日期 + 前 2 个维度 Δ 标签
- **交互**：点击 → 跳转 `/growth/story?cycle_id=xxx`
- **空态**：「还没有成长回顾记录」提示

### 6.3 详情页（GrowthStoryPage）增强

#### 6.3.1 进入方式
| 场景 | 参数 | 行为 |
|------|------|------|
| 家长触发阶段回顾 | `?child_id=xxx` | 查当前 active 周期 → 生成新故事 |
| 历史回看 | `?cycle_id=xxx` | 直接读取已有故事，不重新生成 |

#### 6.3.2 页面结构（自上而下）
```
1. 顶部 Header（紫色渐变）
   - 返回按钮 + 「成长故事」标题
2. 故事卡片
   - 标题 + 生成日期 + 儿童名 + IP 头像（按成长指数阶段）
3. 【新增】阶段目标达成情况
   - 各维度：目标分 vs 最终分（进度条 + 百分比）
4. 【新增】能力提升摘要
   - 各维度 Δ 标签（+X 分，绿色 / -X 分，红色 / 持平，灰色）
5. 【新增】子任务时间线
   - 周期内任务列表（标题 + 积分 + 完成日期），按时间正序
6. 故事正文（AI 生成的回顾总结）
7. 精彩瞬间图集（横向滑动）
8. 底部分享按钮（仅家长可见）
```

#### 6.3.3 类型对齐修复
- `GrowthStoryPage.tsx:225` 使用 `item.dimension`，但 `AbilityDelta` 接口字段为 `dimension_name` → **需修复为 `item.dimension_name`**

### 6.4 验收标准
- [ ] 历史列表正确展示已生成的故事（倒序）
- [ ] 点击历史卡片可进入详情页回看
- [ ] 详情页展示阶段目标达成进度条
- [ ] 详情页展示能力提升 Δ 标签
- [ ] 详情页展示子任务时间线
- [ ] 详情页展示故事正文 + 图集
- [ ] 分享到社区功能正常
- [ ] `item.dimension` → `item.dimension_name` 类型修复

---

## 七、F5 · GrowthPage UI 调整

### 7.1 移除清单
| 区块 | 代码位置 | 移除内容 |
|------|---------|---------|
| 图集 Section | 647-675 行 | Camera 图标区块 + album 展示 |
| 任务时间线 Section | 677-713 行 | Calendar 图标区块 + timeline 展示 |

### 7.2 移除的 state 与加载逻辑
- `album`、`albumExpanded`、`DEFAULT_ALBUM_COUNT`
- `timeline`、`timelineExpanded`、`DEFAULT_TIMELINE_COUNT`
- `displayAlbum`、`displayTimeline`
- `Promise.all` 中的 `getAlbum`、`getTimeline` 调用
- `ShareModal` 中的 `album` 依赖（图文分享的图片选择需改为从任务列表取 photo）

### 7.3 统计卡片调整
| 原指标 | 新指标 | 数据来源 |
|--------|--------|---------|
| 成长指数 | 成长指数（保留） | `getGrowthIndex` |
| 图集数 | 累计任务数 | `tasksResult.total` |
| 天数 | 阶段天数 | 周期 start_date ~ end_date 计算或保留天数 |

### 7.4 新增：成长回顾历史时间轴
- 位置：阶段回顾入口下方
- 数据：`listStories(childId, 1, 20)`
- 展示：卡片列表（标题 + 日期 + 维度 Δ 标签预览）
- 交互：点击跳转 `/growth/story?cycle_id=xxx`

### 7.5 调整后区块顺序
```
Header（绿色渐变：标题 + 分享按钮）
→ ChildTabs
→ 统计卡片（成长指数 + 累计任务数 + 阶段天数）
→ 能力雷达图（+ IP 形态）
→ 阶段目标（进度条 + 调整入口）
→ 积分兑换入口卡片
→ 阶段回顾入口（仅家长）
→ 【新增】成长回顾历史时间轴
→ 悬浮分享按钮
```

### 7.6 验收标准
- [ ] 无图集区块、无任务时间线区块
- [ ] 统计卡片展示「累计任务数」而非「图集数」
- [ ] 成长回顾历史时间轴正确展示
- [ ] 历史卡片点击跳转正常
- [ ] ShareModal 不因移除 album 而崩溃

---

## 八、数据模型与 API

### 8.1 核心数据模型
```
GrowthCycle       周期（id, child_id, start_date, end_date, status）
GrowthCycleGoal   周期目标（cycle_id, dimension_id, target_score）
ChildAbilityScore 能力得分（child_id, dimension_id, score）
GrowthStory       成长故事（cycle_id, title, content, ability_summary, photo_urls）
```

### 8.2 API 清单
| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/api/abilities` | 能力维度列表 | ✅ |
| GET | `/api/abilities/scores/:child_id` | 儿童能力得分 | ✅ |
| GET | `/api/abilities/growth-index/:child_id` | 成长指数 | ✅ |
| POST | `/api/growth-cycles` | 创建周期 | ✅ |
| PUT | `/api/growth-cycles/:id` | 更新周期 | ✅ |
| POST | `/api/growth-cycles/:id/goals` | 设置维度目标 | ✅ |
| GET | `/api/growth-cycles/current/:child_id` | 当前周期+进度 | ✅ |
| GET | `/api/growth-stories` | **历史列表** | ✅ 已实现 |
| POST | `/api/growth-stories/:cycle_id` | 生成故事（含 AI 重新评定） | ✅ 已实现 |
| GET | `/api/growth-stories/:cycle_id` | 查单个故事 | ✅ |
| GET | `/api/growth-stories/:cycle_id/tasks` | **周期内任务时间线** | ✅ 已实现 |

---

## 九、实施任务清单

### 后端（已完成）
- [x] T1: `task_service.go` 移除 `AwardTaskCompletion` 调用
- [x] T2: `ability_service.go` 新增 `ReassessScores` 方法
- [x] T3: `growth_story_service.go` 改造 `GenerateStory` + 新增 `ListStories`/`GetCycleTasks`
- [x] T4: `growth_story_handler.go` 新增 `ListStories`/`GetCycleTasks` handler
- [x] T5: `main.go` 注册新路由

### 前端（已完成）
- [x] T6: `GrowthPage.tsx` 移除图集/时间线区块，新增历史时间轴
  - T6.1: 删除图集 Section（647-675 行）及相关 state/加载逻辑
  - T6.2: 删除任务时间线 Section（677-713 行）及相关 state/加载逻辑
  - T6.3: 调整统计卡片（图集数 → 累计任务数）
  - T6.4: 新增「成长回顾历史」时间轴区块
  - T6.5: 处理 ShareModal 对 album 的依赖（改为从 task.photo 取）
- [x] T7: `GrowthStoryPage.tsx` 详情页增强
  - T7.1: 修复 `item.dimension` → `item.dimension_name`（同步修复 CommunityPage.tsx）
  - T7.2: 展示阶段目标达成情况（进度条）
  - T7.3: 展示能力提升摘要（Δ 标签，支持升/降/持平颜色）
  - T7.4: 展示子任务时间线（调用 `getCycleTasks`）
  - T7.5: 整合故事正文 + 图集（已有）
- [x] T8: 编译验证
  - T8.1: `cd backend && go build ./...` 通过
  - T8.2: `cd frontend && npx tsc --noEmit` 通过

---

## 十、风险与边界

1. **ShareModal 依赖 album**：移除 album 后，图文分享模式的图片选择需改为从已完成任务的 `task.photo` 中选取，否则分享弹窗会因无图片可选而失效。
2. **历史回看不重新生成**：通过 `cycle_id` 进入详情页时只读取已有故事，不触发 `generateStory`，避免覆盖历史记录。
3. **能力得分覆盖写入**：`ReassessScores` 是覆盖而非累加，AI 评定波动可能导致得分下降——这是预期行为（体现真实成长曲线）。
4. **成长指数实时性**：成长指数依赖能力得分均值，在阶段回顾前不会变化，需在 UI 上向用户说明"指数在阶段回顾后更新"。
