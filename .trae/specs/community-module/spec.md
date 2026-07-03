# 社区模块 - 产品需求文档

## Overview
- **Summary**: 社区模块是一个多维度的互动板块，允许家庭将孩子的成长回忆分享到公开社区，参与公益项目（捐书、捐衣服、捐玩具等）获取积分奖励，组织和参与公益活动（捡垃圾、老人院服务等线下活动，以及线上招募+线下组织的博弈游戏活动），在活动过程中锻炼孩子的表达能力和逻辑能力。
- **Purpose**: 通过社区化功能扩展 GrowPocket 平台的社交属性和教育价值。让家庭在获取积分奖励的同时，培养孩子的公益意识、团队协作、表达能力和逻辑思维。
- **Target Users**: 家长（发布分享、组织活动、领取奖励）和孩子（参与活动、通过游戏锻炼能力）

## Goals
1. 实现成长回忆分享功能：家庭可以将成长相册中的照片分享到社区，与其他家庭互动
2. 实现公益项目功能：提供捐书、捐衣服、捐玩具等公益项目，完成后获取积分奖励
3. 实现公益活动组织功能：可以发起或参与线下公益活动（包括捡垃圾、老人院服务、植树等），以及线上招募+线下组织的博弈游戏活动，在活动过程中锻炼孩子的表达能力和逻辑能力
4. 将"社区"作为第六个主要导航入口，与首页、任务、商城、成长、家庭并列
5. 所有积分奖励遵循现有 Transaction 系统的机制，与已有积分系统无缝集成

## Non-Goals (Out of Scope)
- 不实现即时聊天/私信功能（社区互动仅通过点赞、评论完成）
- 不实现用户之间的好友/关注关系（社区内容按时间顺序展示）
- 不实现真实的物品物流/配送系统（公益项目以信息登记+系统审核为准）
- 不实现独立的游戏模块（游戏只是公益活动的一种形式，通过活动流程参与）
- 不实现广告、变现系统（社区模块免费使用）
- 不实现复杂的权限/审核系统（内容由创建者自己管理，家长可删除自己发布的内容）

## Background & Context
- 现有系统架构：Go + Gin 后端，GORM + SQLite 数据库；React + Vite + TypeScript 前端，Zustand 状态管理
- 现有模块：家庭注册/登录、孩子档案管理、任务管理、积分系统、兑换商城、成长相册
- 现有数据库模型：`Family`、`User`（parent/child）、`Task`、`Transaction`、`RedeemItem`、`Redeem`
- 现有路由模式：`/api/*` 前缀，使用 JWT 认证中间件，通过 `middleware.GetFamilyID(c)` 获取当前家庭
- 现有积分机制：通过 `Transaction` 记录积分变动，更新 `User.Balance` 字段
- 社区模块新增的数据库表将与现有模型通过 `family_id` 关联，保持数据隔离（每个家庭只能看到自己的发布和操作历史，但社区内容对所有家庭公开）

## Design System（UI 设计系统）

### UI-1: 颜色系统
- **主色（Primary）**: `#FF9500`（橙色，平台品牌色），用于主要按钮、积分显示、标签高亮
- **主色渐变**: `from-primary to-primary-dark`（用于顶部标题栏、积分卡片、快捷按钮）
- **成长页渐变**: `from-emerald-500 to-green-600`（公益活动、成长回忆的主题色参考）
- **背景色**: `#FFF8F0`（`.bg-bg`，页面主背景），`#FFF1E6`（`.bg-bg-secondary`，次要区域背景）
- **卡片背景**: `#FFFFFF`（`.bg-card`，所有内容卡片）
- **文字**: `#1C1C1E`（主要），`#636366`（次要），`#8E8E93`（次要/提示）
- **状态色**: 成功 `#34C759`，危险 `#FF3B30`，紫色 `#AF52DE`

### UI-2: 间距与圆角系统
- **圆角**: 卡片统一使用 `rounded-2xl`（24px），按钮和小元素使用 `rounded-xl`（20px），头像使用 `rounded-full`
- **阴影**: 卡片使用 `shadow-sm`（0 2px 8px rgba(0,0,0,0.06)），主按钮使用 `shadow-md`，重点卡片使用 `shadow-lg`
- **页面宽度约束**: 所有内容区域包裹在 `max-w-lg mx-auto` 内，移动端全宽，桌面端居中显示
- **底部导航空间**: 所有有底部导航的页面留出 `pb-24` 空间，避免内容被底部导航遮挡

### UI-3: 组件设计模式
- **模式 A - 渐变顶栏 + 卡片列表**: 顶部 `bg-gradient-to-br from-primary to-primary-dark`，`pt-6 pb-8 px-4`，内有页面标题、简短描述和关键数据卡片；下方为 `space-y-4` 的卡片列表（参考 HomePage、TaskListPage）
- **模式 B - 卡片网格**: 3 列 grid，卡片内容包括图标、标题、数字（参考 QuickActions、StatsSummary）
- **模式 C - 列表项卡片**: `bg-card rounded-2xl p-4 shadow-sm`，内有标题、副标题/状态、操作区域（参考 TaskListPage 的任务卡片）
- **模式 D - 标签栏/筛选器**: `bg-card rounded-2xl p-1 shadow-sm`，按钮使用 flex 布局，激活态 `bg-primary text-white shadow`，非激活态 `text-text-secondary hover:bg-gray-50`（参考 TaskListPage 的状态筛选器）
- **模式 E - 模态框**: `fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50`，内部 `bg-white rounded-3xl shadow-xl max-w-md w-full p-8`

### UI-4: 图标与视觉元素
- 统一使用 **lucide-react** 图标库
- **社区图标**: `Globe`（Globe 表示社区/全局）
- **成长回忆图标**: `Image`（相册）或 `Camera`（相机）
- **公益项目图标**: `Heart`（爱心）或 `Gift`（礼物）
- **公益活动图标**: `Users`（人群）或 `CalendarHeart`（日历+爱心）
- **博弈游戏图标**: `Brain`（逻辑）或 `MessageSquare`（表达）
- **点赞图标**: `Heart`（空心→实心切换）
- **评论图标**: `MessageCircle`
- **发表按钮**: `Plus` 圆形浮动按钮（类似 TaskListPage 的 `fixed bottom-24 right-4 w-14 h-14 bg-primary text-white rounded-full`）

### UI-5: 通用状态处理
- **加载中**: `min-h-screen bg-bg pb-24 flex items-center justify-center`，内部显示 `加载中...`（参考 HomePage loading state）
- **错误状态**: 居中卡片显示错误信息 + 重试按钮（`mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl`）
- **空状态**: 居中显示大号图标 + 标题 + 描述文字 + 引导操作按钮（圆形图标容器：`w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center`）
- **无孩子档案**: 显示 `"请先添加孩子"` + 跳转按钮

### UI-6: 社区底部导航
- BottomNav 增加第 6 个 tab: `{ id: 'community', label: '社区', icon: Globe }`
- 激活态: `text-primary` + `bg-primary/10` 图标容器 + `strokeWidth=2.5`
- 非激活态: `text-text-tertiary hover:text-text-secondary`

## Functional Requirements

### FR-1: 社区主页（UI 详细规格）
- 社区模块有一个主入口页面，展示社区动态流（feed）
- 动态流按时间倒序展示所有家庭分享的内容
- 每个动态卡片显示：发布者家庭名、内容类型标签、标题、缩略图、积分（如适用）、发布时间、点赞数、评论数
- 顶部提供快捷入口：成长回忆、公益项目、公益活动、博弈游戏四大子模块
- 支持分页加载（点击"加载更多"按钮）

**UI 布局详情（社区主页 - 动态 Tab）**：
1. **顶部渐变区域**（`bg-gradient-to-br from-emerald-500 to-green-600 pt-6 pb-6 px-4`）
   - 左侧标题：`社区广场`（大号 `text-xl font-bold text-white`）
   - 副标题：`与其他家庭一起成长`（`text-white/80 text-sm`）
   - 右上角社区统计数据卡片（`bg-white/15 backdrop-blur rounded-2xl p-3`）：
     - 已发表动态数（大字 `text-white text-xl font-bold`）
     - 今日参与家庭数
2. **4 子模块快捷入口**（`grid grid-cols-4 gap-3`，位于 `max-w-lg mx-auto px-4 -mt-2` 区域）
   - 成长回忆: `bg-primary text-white rounded-2xl p-3 shadow-md` + `Image` 图标 + `"成长回忆"` 文字
   - 公益项目: `bg-green-500 text-white rounded-2xl p-3 shadow-md` + `Heart` 图标 + `"公益项目"` 文字
   - 公益活动: `bg-blue-500 text-white rounded-2xl p-3 shadow-md` + `Calendar` 图标 + `"公益活动"` 文字
   - 博弈游戏: `bg-purple text-white rounded-2xl p-3 shadow-md` + `Brain` 图标 + `"博弈游戏"` 文字
   - 所有卡片: `active:scale-95 transition-all` 点击动画
3. **Tab 切换栏**（模式 D，位于 `max-w-lg mx-auto`）
   - 5 个 Tab: 动态 / 成长回忆 / 公益项目 / 公益活动 / 博弈游戏
   - 默认激活 "动态" tab，对应所有类型的动态 feed
   - 点击其他 Tab 切换到对应类型的列表
4. **动态 Feed 卡片列表**（`space-y-3`，模式 C 的变体）
   - 每张卡片结构（`bg-card rounded-2xl shadow-sm overflow-hidden`）：
     - 顶部发布者信息: `flex items-center gap-2 p-3`
       - 圆形头像容器：`w-8 h-8 rounded-full bg-primary/10` + 首字母（白色文字）
       - 发布者昵称：`text-text-primary text-sm font-medium`
       - 类型标签：`px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs`（显示"回忆"/"活动"/"游戏"）
       - 相对时间：`text-text-tertiary text-xs`（"2 小时前"）
     - 图片区域：`aspect-[4/3] bg-gray-100` 显示分享的照片（无照片则隐藏此区域）
     - 标题与描述：`p-3`
       - 标题：`text-text-primary font-medium`
       - 描述：`text-text-secondary text-sm mt-1`（超出两行显示省略号）
     - 积分信息（如果有）：`p-3 pt-0 flex items-center gap-2 text-primary font-bold text-sm` + 显示 `+XXX 积分`
     - 互动栏：`border-t border-gray-100 p-3 flex items-center justify-between`
       - 点赞区域：点击心形图标 + 数字，已点赞时图标变红，数字加 1
       - 评论区域：点击 `MessageCircle` 图标 + 数字，弹出评论模态框
5. **浮动发表按钮**：右下角 `fixed bottom-24 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-40` + `Plus` 图标
6. **加载状态**：`pb-24 flex items-center justify-center` + 文字 `加载中...`
7. **空状态**：居中 `w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center`（32px Globe 图标）+ `暂无社区动态` + `快来分享第一条吧` 文字描述

### FR-2: 成长回忆分享（UI 详细规格）
- 从成长相册选择照片分享到社区
- 每条回忆包含：照片、标题、简短描述、关联的任务信息（任务标题、获得积分）
- 可以给回忆添加标签（如"阅读时刻"、"运动达人"、"家务小能手"等）
- 可以对他人的回忆进行点赞
- 可以对他人的回忆发表评论
- 可以删除自己发布的回忆
- 回忆列表支持按最新、最热（点赞数）排序

**UI 布局详情**：
1. **选择来源**：从成长页的照片网格进入"分享到社区"
   - 照片网格点击时在右上角显示"分享"按钮（叠加在图片上的小图标）
2. **发表分享模态框**（模式 E 变体，全屏幕大小）：
   - 顶部：关闭按钮 × + 标题"发表成长回忆" + "发布"按钮（右上角，橙色主色）
   - 图片预览：`aspect-square rounded-2xl bg-gray-100` 显示选中的照片
   - 标题输入：`.w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none` + placeholder `"给这段回忆起个标题..."`
   - 描述输入：多行 textarea，placeholder `"分享你和孩子的成长故事..."`
   - 标签选择：一排圆形标签按钮，点击切换激活态（激活态 `bg-primary text-white rounded-full px-3 py-1 text-sm`）
   - 关联任务信息展示：如果来自任务照片则显示小卡片 `bg-bg rounded-xl p-3 text-sm` + 任务标题 + `text-primary font-bold` 的积分数
3. **点赞交互**：心形图标 `Heart`（空心→实心红色切换），数字实时更新
   - 点击后 150ms 内放大到 1.2x 再恢复（视觉反馈）
4. **评论模态框**：
   - 顶部标题：`评论 (12)`（显示评论总数）
   - 评论列表：`space-y-3 max-h-80 overflow-y-auto`
   - 每条评论：圆形头像 + 昵称 + 时间 + 评论内容
   - 评论输入框：固定在底部 `sticky bottom-0`，textarea + "发布"按钮
5. **删除确认**：自己发布的卡片右上角显示 `...` 菜单，点击后弹出"删除"选项
   - 删除确认模态框：标题 `确定要删除这条分享吗？` + 描述 `删除后无法恢复` + 两个按钮：取消（灰）+ 删除（红）
6. **排序筛选**：列表顶部 Tab 栏（模式 D）：最新 / 最热
   - "最新"按 created_at DESC 排序
   - "最热"按 like_count DESC 排序

### FR-3: 公益项目（UI 详细规格）
- 系统预置三类公益项目：捐书、捐衣服、捐玩具
- 每个项目包含：项目名称、图标、描述、所需步骤、完成奖励积分
- **参与对象为孩子**：家长选择一个孩子档案参与项目，积分计入该孩子余额
- 家庭可以"开始"一个公益项目
- 项目流程：选择项目 → **选择参与的孩子** → 填写信息（如捐书数量、书籍名称等）→ 上传完成照片 → 提交 → 系统发放积分到该孩子账户
- 每个家庭对同一类型项目可以多次参与（不同孩子可分别参与）
- 项目完成后生成一条 Transaction 记录，积分计入当前孩子余额
- 提供项目参与记录列表，展示家庭参与过的所有公益项目

**UI 布局详情**（公益项目列表页 + 参与流程页）：

**A. 公益项目列表页（社区 Tab 切换到"公益项目"后显示）**：
1. 顶部渐变区域：`from-green-500 to-emerald-600 pt-6 pb-6 px-4 rounded-b-3xl`
   - 标题：`公益项目`（`text-xl font-bold text-white`）
   - 描述：`参与公益，获得积分奖励`（`text-white/80 text-sm`）
   - 数据卡片：`bg-white/15 rounded-2xl p-3`（累计参与次数 + 累计获得积分）
2. 3 个项目卡片（`grid grid-cols-3 gap-3` 或 `space-y-3` 垂直列表）
   - 每个项目卡片（模式 C 变体）：
     - 左侧圆形图标区：`w-12 h-12 rounded-full` + 图标（捐书=书，捐衣=衣架，玩具=Gift），背景 `bg-primary/10 text-primary`
     - 中间：项目标题（`font-medium text-text-primary`）+ 简短描述（`text-sm text-text-tertiary`）
     - 右侧：`text-primary font-bold` + `+XX 积分` + 下方 "参与" 按钮（`bg-primary text-white rounded-xl px-4 py-2 text-sm`）
3. 我的参与记录（`SectionHeader` 标题 + 列表）
   - 每条记录：`bg-card rounded-2xl p-3 shadow-sm`
   - 项目名、参与时间、获得积分

**B. 参与项目流程**（点击"参与"后打开的模态框）：
1. **步骤 1 - 项目介绍**：
   - 大图标（顶部居中 `w-20 h-20 rounded-full bg-primary/10` + 64px 图标）
   - 项目名称（大号 font-bold）
   - 步骤说明（有序列表 1、2、3）
   - 奖励积分：`+XX 积分`（`text-primary font-bold text-xl`）
   - 底部按钮：`开始填写`（`w-full py-3 bg-primary text-white rounded-xl font-medium`）
2. **步骤 2 - 填写信息 + 上传照片**：
   - 捐书时：书籍名称输入、数量输入（+/- 步进器）
   - 捐衣服时：衣物类型选择（上装/下装/冬装/其他）、数量
   - 捐玩具时：玩具类型、数量、新旧程度描述
   - 上传照片区域：`aspect-[4/3] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2` + `Camera` 图标 + "点击上传完成照片"
   - 底部按钮：`提交并获取积分`（禁用态直到表单填写完整）
3. **步骤 3 - 成功提示**：
   - 居中的大 Check 图标（绿色圆形背景 `bg-success`）
   - `恭喜完成！`（`text-xl font-bold text-text-primary`）
   - `获得 +XX 积分`（`text-primary text-3xl font-bold`）
   - 底部两个按钮：`继续浏览`（返回列表）和 `查看积分记录`（跳转积分明细）

### FR-4: 公益活动组织（线上招募 + 线下组织）
- 家庭可以发起公益活动：活动标题、类型（捡垃圾、老人院、植树、博弈游戏等）、时间、地点、参与人数上限、简要说明
- 活动类型说明：
  - **线下公益活动**：捡垃圾、老人院服务、植树等，需要线下聚集参与
  - **博弈游戏活动**：线上招募成员，线下组织孩子一起参与的小游戏（如逻辑推理游戏、表达能力挑战等），锻炼孩子的表达能力和逻辑能力
- **参与对象为孩子**：报名和完成活动时需要指定参与的孩子，积分计入该孩子余额
- 活动状态：招募中、进行中、已结束
- 其他家庭可以浏览并报名参加活动（报名时选择参与的孩子）
- 活动参与者在活动结束后可以上传成果照片并获取积分
- 活动发起者可以编辑/取消未开始的活动
- 提供按时间和类型筛选的活动列表
- 活动完成后，组织者获得 100 积分，参与者获得 80 积分（积分计入参与孩子的账户）

**UI 布局详情**：

**A. 活动列表页**：
1. 顶部渐变区域（蓝色主题）：`from-blue-500 to-blue-600 pt-6 pb-6 px-4 rounded-b-3xl`
   - 标题：`公益活动`（`text-xl font-bold text-white`）
   - 描述：`组织或参与线下公益活动`
   - 右上：发起活动按钮（`Plus` 图标 + "发起"，`bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl text-white text-sm`）
2. Tab 筛选栏（模式 D）：全部 / 招募中 / 进行中 / 已结束
3. 活动卡片列表（`space-y-3`）：
   - 每张卡片：`bg-card rounded-2xl shadow-sm overflow-hidden`
   - 活动图片/图标区：`aspect-video bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center` + 活动类型图标（Calendar/Users/Tree 等）
   - 状态标签：右上角 `px-2 py-0.5 rounded-full text-xs font-medium`（招募中= bg-green-100 text-green-700，进行中= bg-blue-100 text-blue-700，已结束= bg-gray-100 text-gray-600）
   - 内容区：`p-4`
     - 标题：`font-bold text-text-primary`
     - 描述：`text-sm text-text-secondary mt-1 line-clamp-2`
     - 信息行：`flex items-center gap-4 text-sm text-text-tertiary mt-3`
       - `Calendar` 图标 + 时间
       - `MapPin` 图标 + 地点
       - `Users` 图标 + `5/10 已报名`
   - 底部操作栏：`border-t border-gray-100 p-3 flex items-center justify-between`
     - 积分奖励：`+100 积分`（`text-primary font-bold`）
     - 报名/查看详情按钮：`bg-primary text-white rounded-xl px-4 py-2 text-sm`（未报名=报名，已报名=已报名）

**B. 创建活动表单**（点击"发起活动"后进入）：
- 标题输入：必填，placeholder `"活动标题"`
- 活动类型：下拉选择或按钮组（捡垃圾 / 老人院服务 / 植树 / 公益讲座 / 其他）
- 日期时间选择：`type="datetime-local"`（或平台日期选择组件）
- 地点输入：`"活动地点"`
- 人数上限：数字输入，默认 10 人
- 描述：多行 textarea，`"活动详情..."`
- 底部按钮：取消 + 发布（`bg-primary text-white w-full py-3 rounded-xl font-medium`）

**C. 活动详情页 + 完成流程**：
- 活动信息完整展示（标题、大图、时间、地点、人数、描述、参与者列表）
- 发起者信息卡片（头像、昵称、"发起人"标签）
- 参与者列表（`grid grid-cols-6 gap-2` 的头像网格）
- 报名按钮：未报名显示"我要报名"，已报名显示"已报名"（灰色不可点击）
- 活动结束后：参与者可见"标记完成并获取积分"按钮 → 弹出上传照片模态框 → 提交 → 发放积分

### FR-5: 社区导航与路由
- 在前端 BottomNav 中添加"社区"为第 6 个标签页
- 社区页面内部包含三个子页面：动态（默认）、公益项目、公益活动
- 路由：`/community`（动态）、`/community/shares`（回忆）、`/community/charity-projects`（公益项目）、`/community/charity-activities`（公益活动）、`/community/charity-activities/:id`（活动详情）

### FR-6: 后端 API
- 创建社区分享：`POST /api/community/shares`
- 获取社区动态列表：`GET /api/community/shares?page=1&page_size=20&sort=latest`
- 获取单个分享详情：`GET /api/community/shares/:id`
- 删除分享：`DELETE /api/community/shares/:id`（仅创建者可删）
- 点赞/取消点赞：`POST /api/community/shares/:id/like`、`DELETE /api/community/shares/:id/like`
- 评论：`POST /api/community/shares/:id/comments`、`GET /api/community/shares/:id/comments`
- 获取公益项目列表：`GET /api/community/charity-projects`
- 参与公益项目：`POST /api/community/charity-projects/:id/join`（**必传 child_id**）
- 获取家庭公益项目记录：`GET /api/community/charity-projects/my`
- 获取公益活动列表：`GET /api/community/activities`
- 创建公益活动：`POST /api/community/activities`
- 报名参加活动：`POST /api/community/activities/:id/join?child_id=X`（**必传 child_id**）
- 活动完成并获取积分：`POST /api/community/activities/:id/complete`（**必传 child_id**）
- 获取活动详情：`GET /api/community/activities/:id`
- 获取我的活动参与记录：`GET /api/community/activities/my`

> **关键说明**：公益项目和公益活动的参与对象都是孩子，所有参与/报名/完成操作都需要传入 `child_id` 参数，积分计入该孩子的账户余额。

## Non-Functional Requirements

### NFR-1: 数据一致性
- 所有积分发放必须通过现有 Transaction 机制，确保余额计算准确
- 删除分享时同时删除关联的点赞和评论记录
- 活动状态变更必须原子操作，避免并发报名导致人数超限

### NFR-2: 性能
- 社区动态列表支持分页，单页不超过 20 条
- API 响应时间 < 500ms
- 图片大小限制：单张图片不超过 2MB（前端压缩后上传）

### NFR-3: 安全性
- 所有写操作（创建、删除、点赞、评论）必须通过 JWT 认证
- 删除操作必须校验创建者身份，仅创建者家庭可删除自己的内容
- 用户输入的文本内容进行长度校验（标题 ≤ 100 字，描述 ≤ 1000 字）

### NFR-4: 代码一致性
- 后端遵循现有 Handler + Service 两层架构
- 模型文件放在 `backend/internal/model/`，通过 `database.DB` 的 AutoMigrate 自动建表
- 前端遵循现有页面 → service → store 架构模式
- API 响应统一使用 `util.OK(c, gin.H{...})` 或 `util.FailBadRequest(c, ...)` 包装

### NFR-5: 可维护性
- 常量使用命名常量，避免魔法数字（参考 `model.TaskStatusInProgress = 1` 的模式）
- 数据库模型字段添加 JSON tag，与 API 输出一致
- 所有新增路由在 `backend/cmd/main.go` 的 `authorized` 组中注册

## Constraints
- **Technical**: 必须使用 Go (Gin + GORM + SQLite) 后端，React + TypeScript + Vite 前端，Zustand 状态管理，lucide-react 图标库
- **Integration**: 社区模块必须与现有积分系统（Transaction）和认证系统（JWT）无缝集成
- **Database**: 只能使用 SQLite，通过 GORM AutoMigrate 自动建表，不得引入外部数据库
- **Data Isolation**: 每个家庭的数据通过 `family_id` 隔离，但社区的分享内容对所有登录家庭可见

## Assumptions
- 每个家庭至少有一个孩子档案，否则在社区页面显示提示引导用户先添加孩子
- 公益项目的审核流程简化为"提交即通过"，无需人工审核（MVP 阶段）
- 图片上传沿用现有上传目录机制（`/uploads` 静态目录 + `/uploads/:filename` URL）
- 游戏机制简化为选择题和文本提交，不涉及复杂的游戏引擎或多人实时对战
- 所有用户使用同一份共享的公益项目列表（由系统预置，不按家庭隔离），活动和分享按家庭归属

## Acceptance Criteria

### AC-1: 社区主页显示动态流
- **Given**: 用户已登录并进入 `/community`
- **When**: 页面加载完成
- **Then**: 页面顶部显示 3 个子模块快捷入口（成长回忆、公益项目、公益活动），下方按时间倒序展示社区动态 feed，每条动态显示发布者、内容类型、缩略图、点赞数、评论数
- **Verification**: `programmatic`（前端组件存在，后端 API 返回分页数据）

### AC-2: 成长回忆分享功能
- **Given**: 用户已登录，已有完成任务并带有照片的成长记录
- **When**: 用户选择一张成长照片，填写标题和描述后点击"分享到社区"
- **Then**: 系统创建一条社区分享记录，出现在社区动态流中，显示分享者家庭名、照片、标题、任务积分信息
- **Verification**: `programmatic`（POST 创建成功，GET 列表包含新记录）

### AC-3: 点赞和评论互动
- **Given**: 社区中存在至少一条分享记录
- **When**: 用户点击某条分享的"点赞"按钮，或在评论框输入内容并发布
- **Then**: 该分享的点赞数 +1（再次点击可取消），评论显示在分享下方，包含评论者昵称和评论内容、发布时间
- **Verification**: `programmatic`（API 返回正确计数，列表实时更新）

### AC-4: 公益项目参与并获取积分
- **Given**: 用户已登录，选择了一个孩子，公益项目列表中有"捐书"项目
- **When**: 用户点击"捐书"项目，**选择参与的孩子**，填写书籍名称和数量，上传完成照片，点击"提交"
- **Then**: 系统创建一条公益项目参与记录，生成一条 Transaction（type=0, amount=奖励积分），**该孩子的余额增加相应积分**
- **Verification**: `programmatic`（数据库中存在 Transaction，User.Balance 正确增加）

### AC-5: 公益活动发起与报名
- **Given**: 用户已登录，选择了一个孩子
- **When**: 用户在公益活动页面点击"发起活动"，填写活动标题、类型（可选择"博弈游戏"类型）、时间、地点后提交；另一用户浏览活动列表，**选择参与的孩子**并点击"报名"
- **Then**: 活动出现在列表中，状态为"招募中"；报名后活动参与人数 +1，报名的孩子出现在参与者列表
- **Verification**: `programmatic`

### AC-6: 公益活动完成积分发放
- **Given**: 某公益活动（线下公益活动或博弈游戏活动）已结束，用户已报名参与（指定了孩子）
- **When**: 参与者上传活动成果照片，**选择参与的孩子**并确认完成
- **Then**: **参与的孩子获得 80 积分**，Transaction 记录生成；活动发起者（如果也是孩子参与）获得 100 积分
- **Verification**: `programmatic`

### AC-7: 删除自己发布的分享
- **Given**: 用户发布了一条社区分享，且登录账号是该分享的创建者
- **When**: 用户在自己的分享详情页点击"删除"
- **Then**: 该分享及其所有点赞和评论被删除，动态流不再显示该分享
- **Verification**: `programmatic`

### AC-8: 社区导航集成
- **Given**: 用户已登录
- **When**: 查看底部导航栏
- **Then**: 显示 6 个标签：首页、任务、商城、成长、家庭、社区；点击"社区"可进入社区页面
- **Verification**: `human-judgment`（人工检查 UI 导航是否正确显示和跳转）

### AC-9: 响应式布局
- **Given**: 社区页面在不同屏幕宽度下打开
- **When**: 页面展示
- **Then**: 布局保持与现有页面一致的样式（最大宽度 max-w-lg，卡片风格，圆角，与现有配色一致）
- **Verification**: `human-judgment`

### AC-10: 数据隔离
- **Given**: 两个不同家庭的账号（Family A 和 Family B）都已登录
- **When**: Family A 创建一条分享，Family B 尝试删除该分享；Family B 查看分享列表时能看到所有家庭的分享但只能删除自己的
- **Then**: 删除操作被拒绝（返回 403 Forbidden 或参数错误）；分享列表显示所有家庭的公开分享
- **Verification**: `programmatic`

### AC-11: Seed 数据初始化
- **Given**: 首次部署社区模块，数据库中尚无社区相关数据
- **When**: 后端服务启动，数据库迁移完成后
- **Then**: 系统自动插入预置的公益项目（捐书、捐衣服、捐玩具）数据
- **Verification**: `programmatic`

## Open Questions
- [ ] 公益项目的奖励积分：固定值还是可变？暂定：捐书 50 分，捐衣服 80 分，捐玩具 60 分（MVP 固定值，后续可扩展）
- [ ] 公益活动发起者积分（100分）和参与者积分（80分）是否合适？可后续调整
- [ ] 评论是否需要审核？暂定：MVP 阶段无需审核，家长可自行删除自己的评论
- [ ] 活动人数上限默认值？暂定：每个活动默认上限 10 个家庭，可由发起者自定义
- [ ] 分享内容是否支持多张图片？暂定：MVP 阶段仅支持单张图片，后续扩展
- [ ] 博弈游戏类活动的具体形式有哪些？（如：逻辑推理游戏、成语接龙、故事接龙等），暂定由系统预置题目
