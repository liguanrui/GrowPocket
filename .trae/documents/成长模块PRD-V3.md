# GrowPocket「成长」模块 PRD（调整版 V3）

> 版本：V3 · 日期：2026-08-01
> 范围：仅「成长」Tab 模块的产品需求与 UI/数据规格
> 关联：在 V2 基础上对齐新 UI 设计图（`growth-main.html`、`growth-points.html`、`growth-story.html`）
> 品牌色：成长模块保持绿色渐变（`from-emerald-500 to-green-600`），与 AI 助理模块橙色系区分

---

## 一、模块定位

「成长」是 GrowPocket 的核心价值呈现模块，以**阶段回顾**为节奏单位，帮助家长看见孩子在不同能力维度上的成长轨迹，并通过积分兑换激励持续行动。

### V3 核心调整方向

1. **页面层级明确化**：成长记录主页 → 积分兑换页 / 成长故事列表页 → 成长故事详情页
2. **统计卡片精简**：移除页头内统计卡片，能力指数和成长值整合到维度图卡片中
3. **阶段目标增强**：从单按钮操作扩展为三按钮（设置/调整/回顾），新增阶段标签和目标文本
4. **积分兑换增强**：入口卡片信息更丰富 + 独立页面增加余额横幅、Tab 切换和兑换记录
5. **成长故事拆分**：从单条详情页拆分为列表页（时间轴）+ 详情页双层结构
6. **绿色渐变保留**：页头保持绿色渐变品牌色不变

### 核心理念（V2 保留）

- **能力指数 ≠ 任务实时累加**：能力指数是阶段性总结评定，只在「阶段回顾」时由 AI 基于本阶段任务完成情况重新评定。
- **成长故事历史是主单元**：每个阶段回顾生成一条不可变记录，聚合该阶段的目标、子任务时间线、图集、能力提升与故事正文，形成可回看的成长档案。
- **GrowthPage 是总览页**：只展示当前态（能力雷达、阶段目标进度、积分入口），历史细节全部收进成长故事列表页和详情页。

---

## 二、功能清单

| # | 功能 | V2 状态 | V3 调整 | 说明 |
|---|------|---------|---------|------|
| F1 | 能力指数 | 已实现 | 雷达图改SVG（绿色填充），新增维度评分列表+IP等级 | UI 增强为主 |
| F2 | 阶段目标 | 已实现 | 三按钮（设置/调整/回顾），单一进度条+阶段标签 | 交互增强 |
| F3 | 积分兑换 | 入口卡片 | 增强入口卡片 + 增强现有 MallPage | 新增余额横幅+Tab+记录 |
| F4 | 成长故事 | 单条详情页 | 拆分为列表页（时间轴）+ 详情页 | 结构性变更 |
| F5 | GrowthPage UI | 已调整 | 移除统计卡片、移除悬浮按钮、区块顺序调整 | 布局优化 |

---

## 三、F1 · 能力指数（UI 增强）

### 3.1 功能说明（V2 保留）

能力指数只在「阶段回顾」时由 AI 基于本阶段任务完成情况整体重新评定，任务完成时仅发放积分，不改动能力得分。

### 3.2 评定时序（V2 保留）

```
问卷提交 → 写入初始基线得分
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

### 3.3 UI 规格（V3 更新）

**成长维度卡片**（参考设计图 `growth-main.html` Section 4）：

- 卡片标题行：「成长维度」（text-sm font-semibold）+ 更新日期（text-xs text-muted-foreground）
- 内容区左侧：原生 SVG 五维雷达图（width 180, height 180）
  - 三层同心五边形网格线（radius 80/53/27），stroke: border 色
  - 五条轴线从中心到外层顶点
  - 数据多边形：绿色填充 `rgba(126, 200, 80, 0.15)` + `#7EC850` 描边 stroke-width 2
  - 五个数据点圆：r=3 fill `#7EC850`
  - 轴标签：维度名+分数，font-size 10，fill muted-foreground
- 内容区右侧：IP 形象区
  - 小萌芽头像（`ip-sprouty-hero.jpg`，w-20 h-20 rounded-2xl）
  - 等级徽章：「Lv.5 萌芽期」（bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full）
  - 成长值：「成长值 1240」（text-xs text-muted-foreground）
- 维度评分列表（卡片底部）：5列网格
  - 每列：彩色圆点（w-2 h-2 rounded-full）+ 分数（text-xs font-semibold）+ 维度名（text-[10px] text-muted-foreground）
  - 颜色映射：语言=primary / 认知=#6DBF7B / 运动=#5B9BD5 / 社交=#F0B848 / 情感=#E87461

### 3.4 技术实现变更

- **现有**：使用 recharts 库的 `RadarChart` 组件
- **V3**：改为原生 SVG 实现，减少依赖，精确控制样式
- 数据来源不变：`getChildScores(childId)` 返回 `ChildAbilityScore[]`

### 3.5 验收标准

- [x] 任务完成后，能力雷达图得分不变化（仅积分增加）（V2 已实现）
- [ ] 雷达图为原生 SVG 渲染，绿色填充
- [ ] 维度评分列表正确展示五维分数和彩色圆点
- [ ] IP 等级徽章和成长值正确展示
- [ ] 触发阶段回顾后，能力得分被 AI 重新评定

---

## 四、F2 · 阶段目标（交互增强）

### 4.1 功能说明（V2 保留）

家长为当前成长阶段设置时间区间和多维度目标，驱动 AI 每日生成任务，阶段结束时触发回顾。

### 4.2 UI 规格（V3 更新）

**阶段目标卡片**（参考设计图 `growth-main.html` Section 3）：

- 顶部行：
  - 左侧：「阶段目标」标题（text-sm font-semibold）+ 阶段标签角标（bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full，如「3-4岁 · 语言爆发期」）
  - 右侧：「查看详情」文字按钮（text-xs text-muted-foreground + chevron-right 图标）
- 目标文本（mt-3）：目标描述文字（text-sm text-muted-foreground，如「提升词汇表达能力，掌握50+日常用语」）
- 进度条（mt-3）：
  - 容器：h-2 rounded-full bg-muted overflow-hidden
  - 填充：h-full rounded-full bg-primary，width 按百分比
  - 底部行：左侧「进度 65%」（text-xs text-muted-foreground），右侧「32/50 词」（text-xs text-primary font-medium）
- 按钮行（mt-4，flex gap-2）：
  - **设置目标**：bg-primary text-primary-foreground，flex-1，py-2.5 rounded-lg text-sm font-medium，target 图标
  - **调整目标**：bg-card border border-border text-foreground，flex-1，py-2.5 rounded-lg text-sm font-medium，sliders 图标
  - **回顾**：bg-card border border-border text-foreground，px-4 py-2.5 rounded-lg text-sm font-medium，history 图标

### 4.3 与 V2 的差异

| 项目 | V2 | V3 |
|------|----|----|
| 按钮数量 | 1个（调整阶段目标） | 3个（设置/调整/回顾） |
| 进度展示 | 每维度独立进度条 | 单一综合进度条 |
| 阶段标签 | 时间区间文字 | 阶段标签角标 |
| 目标文本 | 无 | 新增目标描述文本 |

### 4.4 验收标准

- [x] 支持创建周期（含时间区间）（V2 已实现）
- [x] 支持为多个维度设置目标（V2 已实现）
- [ ] 三按钮正确展示且功能正常（设置=新建/调整=编辑/回顾=跳转故事详情）
- [ ] 阶段标签角标正确展示
- [ ] 单一进度条正确反映综合进度

---

## 五、F3 · 积分兑换（入口增强 + 独立页面增强）

### 5.1 入口卡片（GrowthPage 内）

**参考设计图 `growth-main.html` Section 5**：

- 卡片：bg-card rounded-2xl border border-border p-4，渐变背景 `linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)`
- 左侧区域：
  - 图标行：gift 图标（w-5 h-5 text-primary）+「积分兑换」标题（text-sm font-semibold）
  - 积分显示：「2,850」（text-2xl font-bold text-primary）+「积分」（text-sm text-muted-foreground）
  - 提示：「本周已兑换 2 件」（text-xs text-muted-foreground）
- 右侧：进入按钮
  - bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium
  - 「进入兑换」+ arrow-right 图标
  - 点击跳转 `/mall`

### 5.2 独立页面增强（MallPage.tsx）

**参考设计图 `growth-points.html`，在现有 MallPage 基础上增强**：

#### 5.2.1 新增：积分余额横幅
- 位置：页面顶部，Header 下方
- 样式：绿色渐变背景 `linear-gradient(135deg, #10b981 0%, #16a34a 100%)`，rounded-2xl p-5 text-white
- 左侧：「我的积分」（text-sm text-white/80）+ 积分数值（text-3xl font-bold text-white）
- 右侧：SVG 圆环进度（56x56）
  - 背景圆：stroke rgba(255,255,255,0.3) stroke-width 4 fill none r=24
  - 进度弧：stroke white stroke-width 4 fill none r=24，stroke-linecap round
  - 中心文字：百分比（text-[10px] font-bold fill white）
  - 下方文字：「本周目标」（text-[10px] text-white/70）
- 底部行：「本周已赚 +320 积分」（text-xs text-white/80 + trending-up 图标）

#### 5.2.2 新增：Tab 切换
- 位置：积分余额横幅下方
- 样式：flex gap-2 bg-muted p-1 rounded-full
- Tab 1「可兑换」：active 状态（bg-card text-primary font-medium）+ shopping-bag 图标
- Tab 2「已兑换」：非 active（text-muted-foreground）+ check-circle 图标
- Tab 3「兑换记录」：非 active（text-muted-foreground）+ receipt 图标

#### 5.2.3 商品网格增强
- 保持现有 2 列网格布局
- 商品卡片增加：
  - 热门徽章：左上角，bg-error text-white text-[10px] font-medium px-1.5 py-0.5 rounded-bl-lg rounded-tr-lg
  - 已兑完状态：按钮变为 bg-muted text-muted-foreground「已兑完」
- 商品图片区域使用渐变背景占位（绿色系）

#### 5.2.4 新增：最近兑换记录
- 位置：商品网格下方
- 标题行：「最近兑换」（text-sm font-semibold）+「查看全部」（text-xs text-primary）
- 列表：bg-card rounded-xl border border-border divide-y
- 每条记录：
  - 左侧：图标容器（w-9 h-9 rounded-lg bg-muted + gift 图标）
  - 中间：商品名（text-sm font-medium）+ 日期（text-xs text-muted-foreground）
  - 右侧：积分消耗（text-sm font-medium text-muted-foreground，如「-800」）

### 5.3 数据来源

- 积分余额：`childStore.currentChild.balance`
- 兑换记录：需调用现有 `redeemService` 获取兑换历史（如 API 不支持则 V3 暂用空态）
- 本周统计：前端计算或后端新增接口（可选）

### 5.4 验收标准

- [x] 入口卡片正常跳转商城（V2 已实现）
- [ ] 入口卡片展示积分数量和已兑换件数
- [ ] 积分余额横幅正确展示积分和圆环进度
- [ ] Tab 切换功能正常
- [ ] 商品卡片展示热门徽章和已兑完状态
- [ ] 最近兑换记录列表正确展示

---

## 六、F4 · 成长故事（拆分为列表页 + 详情页）

### 6.1 结构变更说明

| 层级 | V2 | V3 |
|------|----|----|
| 列表 | GrowthPage 内嵌历史时间轴 | 独立列表页 `GrowthStoryListPage.tsx` |
| 详情 | `GrowthStoryPage.tsx` | 保留，页头颜色调整 |

### 6.2 成长故事列表页（新增）

**参考设计图 `growth-story.html`，路由 `/growth/stories`**：

#### 6.2.1 页面结构

```
1. Header（sticky）
   - 返回按钮 + 「成长故事」标题 + 筛选按钮
2. 摘要横幅
   - IP头像 + 故事集统计 + 五维度分布
3. 维度筛选标签
   - 全部 / 语言 / 认知 / 运动 / 社交 / 情感
4. 垂直时间轴
   - 每条：维度标签 + 日期 + 标题 + 内容 + AI点评 + 能力变化 + 成长值
5. 加载更多按钮
```

#### 6.2.2 摘要横幅
- 背景：绿色系渐变 `linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)`
- 左侧：IP头像（`ip-sprouty-hero.jpg` w-14 h-14 rounded-2xl）
- 右侧：
  - 「小明的故事集」（text-sm font-semibold）
  - 「共记录 42 个成长瞬间」（text-xs text-muted-foreground）
  - 五维度统计行：彩色圆点 + 维度名 + 数量

#### 6.2.3 维度筛选标签
- 横向滚动（no-scrollbar overflow-x-auto flex gap-2）
- 「全部」为 active（bg-primary text-primary-foreground）
- 其他为非 active（bg-card border border-border text-foreground）
- 每个标签：px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap

#### 6.2.4 垂直时间轴
- 每条记录使用 `.timeline-item` CSS 类（左侧竖线 + 圆点）
- 圆点颜色按维度区分：语言=primary / 认知=#6DBF7B / 运动=#5B9BD5 / 社交=#F0B848 / 情感=#E87461
- 卡片内容：
  - 顶部行：维度标签（彩色背景+文字）+ 日期
  - 标题：text-sm font-semibold
  - 内容：text-xs text-muted-foreground leading-relaxed
  - AI点评区：bg-muted rounded-lg p-2.5，IP小头像 + 评论文案
  - 底部行：能力变化（trending-up 图标 + 「维度能力 +X」）+ 成长值（sparkles 图标 + 「+XX 成长值」）

#### 6.2.5 数据来源
- 故事列表：`listStories(childId, page, pageSize)` — 现有 API
- 维度筛选：前端过滤 `ability_summary` 中的维度
- AI点评：从 `story.content` 提取或后端新增字段

### 6.3 成长故事详情页（现有改造）

**现有 `GrowthStoryPage.tsx` 保留以下功能（V2 已实现）**：

1. 顶部 Header（紫色渐变 → 可选改为绿色统一）
2. 故事卡片（标题 + 日期 + 儿童名 + IP头像）
3. 阶段目标达成情况（进度条对比）
4. 能力提升摘要（Δ 标签）
5. 子任务时间线
6. 故事正文
7. 精彩瞬间图集
8. 底部分享按钮

**V3 调整**：
- 页头颜色：保持紫色渐变（`from-purple-500 to-purple-700`）或统一为绿色（待确认）
- 无其他功能变更

### 6.4 GrowthPage 内成长故事预览卡片

**参考设计图 `growth-main.html` Section 6**：

- 卡片：bg-card rounded-2xl border border-border p-4
- 标题行：book-open 图标 +「成长故事」+「查看全部」按钮（跳转 `/growth/stories`）
- 预览 2 条故事：
  - 每条：维度标签 + 日期 + 标题 + 内容预览（line-clamp-1）
- 点击「查看全部」跳转列表页

### 6.5 验收标准

- [ ] 列表页正确展示成长故事时间轴
- [ ] 维度筛选标签功能正常
- [ ] 每条故事展示维度标签、日期、标题、内容、AI点评、能力变化、成长值
- [ ] GrowthPage 预览卡片展示最近 2 条故事
- [ ] 「查看全部」正确跳转列表页
- [ ] 详情页功能不受影响
- [ ] 列表页点击故事可跳转详情页

---

## 七、F5 · GrowthPage UI 调整

### 7.1 页头（保持绿色渐变）

- 渐变色：`from-emerald-500 to-green-600`（保持不变）
- 圆角底部：`rounded-b-3xl`（保持不变）
- 内容：
  - 标题行：「成长记录」（text-xl font-bold text-white）+「记录每一个成长瞬间」（text-white/80 text-sm）+ 分享按钮
  - 儿童切换：`ChildTabs` 组件（已有，胶囊式适配绿色背景）

### 7.2 移除清单

| 区块 | 处理 |
|------|------|
| 页头内统计卡片 | 移除（成长指数/累计任务/阶段天数的半透明卡片） |
| 悬浮分享按钮 | 移除（fixed bottom-24 right-4 的 Plus 按钮） |
| 阶段回顾入口卡片 | 移除（合并进成长故事预览卡片） |
| 成长回顾历史时间轴 | 替换为成长故事预览卡片 |

### 7.3 调整后区块顺序

```
Header（绿色渐变：标题 + 副标题 + 分享按钮 + ChildTabs）
→ 阶段目标（三按钮 + 单一进度条 + 阶段标签）
→ 成长维度图（SVG雷达图 + IP等级 + 维度评分列表）
→ 积分兑换（增强入口卡片）
→ 成长故事预览（2条预览 + 查看全部）
→ BottomNav
```

### 7.4 验收标准

- [ ] 无页头内统计卡片
- [ ] 无悬浮分享按钮
- [ ] 无独立阶段回顾入口卡片
- [ ] 成长故事预览卡片正确展示
- [ ] 区块顺序符合 V3 规格
- [ ] ShareModal 仍可通过页头分享按钮打开

---

## 八、数据模型与 API

### 8.1 核心数据模型（V2 保留，无变化）

```
GrowthCycle       周期（id, child_id, start_date, end_date, status）
GrowthCycleGoal   周期目标（cycle_id, dimension_id, target_score）
ChildAbilityScore 能力得分（child_id, dimension_id, score）
GrowthStory       成长故事（cycle_id, title, content, ability_summary, photo_urls）
```

### 8.2 API 清单（V2 保留，无新增）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/api/abilities` | 能力维度列表 | ✅ |
| GET | `/api/abilities/scores/:child_id` | 儿童能力得分 | ✅ |
| GET | `/api/abilities/growth-index/:child_id` | 成长指数 | ✅ |
| POST | `/api/growth-cycles` | 创建周期 | ✅ |
| PUT | `/api/growth-cycles/:id` | 更新周期 | ✅ |
| POST | `/api/growth-cycles/:id/goals` | 设置维度目标 | ✅ |
| GET | `/api/growth-cycles/current/:child_id` | 当前周期+进度 | ✅ |
| GET | `/api/growth-stories` | 历史列表 | ✅ |
| POST | `/api/growth-stories/:cycle_id` | 生成故事 | ✅ |
| GET | `/api/growth-stories/:cycle_id` | 查单个故事 | ✅ |
| GET | `/api/growth-stories/:cycle_id/tasks` | 周期内任务时间线 | ✅ |

### 8.3 前端 Service 复用

- 成长故事列表页：复用 `listStories(childId, page, pageSize)` + `parseAbilitySummary()`
- 积分兑换记录：复用 `redeemService`（如无兑换历史 API 则 V3 暂用空态）

---

## 九、前端实施任务清单

### UI 设计图颜色回退（已完成）

| 任务 | 文件 | 内容 | 状态 |
|------|------|------|------|
| T0 | `growth-main.html` | 页头从橙色回退为绿色渐变 | ✅ |
| T0b | `growth-points.html` | 横幅从橙色改为绿色渐变 | ✅ |
| T0c | `growth-story.html` | 摘要横幅改为绿色系 | ✅ |

### 前端代码实施

| 任务 | 文件 | 内容 |
|------|------|------|
| T1 | `GrowthPage.tsx` | 移除页头内统计卡片 |
| T2 | `GrowthPage.tsx` | 雷达图从 recharts 改为 SVG 实现（绿色填充 `#7EC850`） |
| T3 | `GrowthPage.tsx` | 阶段目标改三按钮+单一进度条+阶段标签 |
| T4 | `GrowthPage.tsx` | 积分兑换入口卡片增强（积分数量+已兑换件数+进入按钮） |
| T5 | `GrowthPage.tsx` | 历史时间轴改为成长故事预览卡片（2条预览+查看全部） |
| T6 | `GrowthPage.tsx` | 移除悬浮分享按钮，移除独立阶段回顾入口卡片 |
| T7 | `MallPage.tsx` | 新增积分余额横幅（绿色渐变+圆环进度）+ Tab切换 + 最近兑换记录 |
| T8 | 新增 `GrowthStoryListPage.tsx` | 成长故事列表页（摘要横幅+筛选标签+时间轴+AI点评） |
| T9 | `GrowthStoryPage.tsx` | 页头颜色调整（保持紫色或改绿色，待确认） |
| T10 | `App.tsx` 路由配置 | 新增 `/growth/stories` 路由指向 `GrowthStoryListPage` |
| T11 | 编译验证 | `cd frontend && npx tsc --noEmit` + `cd backend && go build ./...` |

---

## 十、风险与边界

1. **雷达图 SVG 实现精度**：从 recharts 改为原生 SVG 需要精确计算五维坐标，需确保不同分数下渲染正确。
2. **成长故事列表页 AI 点评数据**：现有 `GrowthStory.content` 是完整故事正文，列表页的 AI 点评需从 content 提取摘要或后端新增字段。V3 可暂用 content 前 100 字作为预览。
3. **积分兑换记录 API**：现有 `redeemService` 可能不支持查询兑换历史列表，需确认 API 是否已实现。如未实现，V3 暂用空态或 mock 数据。
4. **GrowthStoryPage 页头颜色**：现有紫色渐变是否改为绿色统一，列为可选项，由后续确认。
5. **维度筛选功能**：成长故事列表页的维度筛选依赖 `ability_summary` 中的维度数据，需确保 `parseAbilitySummary()` 正确解析。
6. **ShareModal 兼容性**：移除悬浮分享按钮后，ShareModal 仅通过页头分享按钮触发，需确保功能不受影响。
7. **阶段目标三按钮逻辑**：「设置目标」=新建周期、「调整目标」=编辑现有周期、「回顾」=跳转故事详情页生成回顾，需确保三种入口逻辑正确。

---

## 附录：UI 设计图索引

| 设计图 | 文件路径 | 对应功能 |
|--------|---------|---------|
| 成长记录主页 | `ai-assistant-ui-design/pages/growth-main.html` | F1 + F2 + F3入口 + F4预览 + F5 |
| 积分兑换页 | `ai-assistant-ui-design/pages/growth-points.html` | F3 独立页面 |
| 成长故事列表页 | `ai-assistant-ui-design/pages/growth-story.html` | F4 列表页 |
