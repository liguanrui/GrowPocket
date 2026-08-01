# AI 助理模块 PRD 细化（v3 补充）

> **版本**：v3.1（UI 交互层细化）
> **更新日期**：2026-08-01
> **依据**：5 张 AI 助理 UI 设计图（`ai-assistant-ui-design/pages/assistant-*.html`）
> **与主 PRD 关系**：本文为 `PRD-童劳童得-v3.md` 第 4.1 节的 UI 交互层细化补充。遇冲突以本文与设计图为准。

---

## 1. 概述与范围

### 1.1 文档目的

PRD-v3 第 4.1 节已定义 AI 助理 Tab 的 8 条高层功能需求（FR-AI-001~008），但缺少 UI 交互层面的细化规格。本文将高层需求下沉到可指导前端按设计图 1:1 还原的粒度，补齐：页面状态机、逐组件规格、交互流程、设计 Token 基线、数据接口缺口。

### 1.2 适用范围

AI 助理 Tab 的全部界面状态，覆盖 5 个状态页面：

| 状态 | 设计图 | 触发条件 |
|------|--------|---------|
| 空状态 | `assistant-empty.html` | 无历史会话进入 / 新建会话 |
| 对话态 | `assistant-chat.html` | 有消息 / 发送消息 |
| 抽屉态 | `assistant-drawer.html` | 点击页眉左侧抽屉按钮 |
| 切换态 | `assistant-child-switch.html` | 点击页眉右侧儿童头像 |
| 语音态 | `assistant-voice.html` | 点击输入栏模式切换为语音 |

### 1.3 与 PRD-v3 的关系及冲突修正清单

本文不重复 PRD-v3 已定义的 IP 进化机制（第 2 节）、能力维度评分（第 3 节）、问卷系统（第 4.5 节）等内容，仅补 AI 助理 Tab 自身的 UI 交互层。

以下 3 处 PRD-v3 原文与设计图存在冲突，以设计图为准：

| 编号 | 冲突点 | PRD-v3 原文 | 设计图口径 | 修正方向 |
|------|--------|------------|-----------|---------|
| C-01 | IP 名称 | 2.1 节"小芽（候选…暂用小芽）"；4.1 / 6.1 全文用"小芽" | 5 张设计图均用"小萌芽" | **以"小萌芽"为准**，PRD 全文及后端 system prompt 同步修正 |
| C-02 | 语音输入 | NG-v3-4"不实现 AI 语音对话（MVP 仅文字）" | `assistant-voice.html` 已设计完整语音输入 UI | **撤销 NG-v3-4**，语音转文字纳入 MVP；语音双向对话（AI 语音播报）仍为非目标 |
| C-03 | IP 头像规格 | 4.1.4"对话窗口顶部展示 IP 头像（80x80）" | 页眉右侧 36x36 + AI 气泡旁 32x32 | **以设计图为准**，删除"80x80 顶部头像"，改为页眉头像 + 气泡头像双位置 |

---

## 2. 设计 Token 基线

### 2.1 色彩 Token

品牌前缀 `gp`，单一暖橙主色系。取自 `ai-assistant-ui-design/colors_and_type.css`。

| Token | 值 | 用途 |
|------|-----|------|
| `--gp-background` | `#FFFAF4` | 页面奶油背景 |
| `--gp-foreground` | `#2D2A26` | 主文字色 |
| `--gp-card` | `#FFFFFF` | 卡片/气泡底色 |
| `--gp-card-foreground` | `#2D2A26` | 卡片文字 |
| `--gp-popover` | `#FFFFFF` | 弹层底色 |
| `--gp-muted` | `#FFF1E6` | 输入框/次要底色 |
| `--gp-muted-foreground` | `#7A7168` | 次要文字 |
| `--gp-primary` | `#F59E6B` | 暖橙主色，气泡/按钮/IP 容器 |
| `--gp-primary-foreground` | `#FFFFFF` | 主色上的文字 |
| `--gp-border` | `#F5E6D3` | 描边/分割线 |
| `--gp-input` | `#F5E6D3` | 输入框边框 |
| `--gp-ring` | `#F59E6B` | 焦点环 |

### 2.2 状态色（语义色，非品牌色）

| Token | 值 | 用途 |
|------|-----|------|
| `--gp-state-success` | `#6DBF7B` | 成功提示 |
| `--gp-state-warning` | `#F0B848` | 警告提示 |
| `--gp-state-error` | `#E87461` | 录音红点/错误 |
| `--gp-state-info` | `#5B9BD5` | 信息提示 |

### 2.3 圆角阶梯

| Token | 值 | 用途 |
|------|-----|------|
| `--gp-radius-sm` | `8px` | 小控件（按钮） |
| `--gp-radius-md` | `12px` | 卡片/气泡 |
| `--gp-radius-lg` | `16px` | 大卡片/IP 形象 |
| `--gp-radius-pill` | `999px` | 头像/标签/胶囊按钮 |

### 2.4 字体

```
--gp-font-sans: "Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
```

### 2.5 响应式容器

所有页面采用移动端居中框架：`max-width: 448px; margin: 0 auto; min-height: 100vh`。小屏（`max-width: 380px`）时对话气泡 `max-width` 从 75% 放宽至 82%。

---

## 3. 页面状态机

### 3.1 状态总览

```
                    ┌──────────────┐
                    │   空状态 Empty │
                    └──────┬───────┘
                           │ 发送消息 / 点击快捷短语
                           ▼
                    ┌──────────────┐
         ┌─────────│   对话态 Chat  │─────────┐
         │         └──────┬───────┘         │
         │                │                 │
    点击页眉左侧      点击页眉右侧      点击输入模式切换
         │                │                 │
         ▼                ▼                 ▼
  ┌────────────┐  ┌──────────────┐  ┌────────────┐
  │ 抽屉态 Drawer│  │ 切换态 Switch │  │ 语音态 Voice│
  └────────────┘  └──────────────┘  └────────────┘
```

### 3.2 状态定义

| 状态 | 标识 | 描述 | 遮罩 | z-index |
|------|------|------|------|---------|
| 空状态 Empty | `assistant-empty` | 无聊天记录，居中展示 IP 形象 + 问候语 + 快捷短语 | 无 | — |
| 对话态 Chat | `assistant-chat` | 有聊天记录，可滚动消息列表 + 输入栏 | 无 | — |
| 抽屉态 Drawer | `assistant-drawer` | 对话态叠加左滑抽屉 | Scrim `rgba(0,0,0,0.4)` + `blur(4px)` | 50 |
| 切换态 Switch | `assistant-child-switch` | 对话态/空态叠加儿童切换 Popover | Scrim `rgba(0,0,0,0.3)` | 40（遮罩）/ 50（Popover） |
| 语音态 Voice | `assistant-voice` | 底部输入栏替换为语音输入面板 | 无（底部面板替换） | 40 |

### 3.3 状态转移规则

**互斥规则**：
- 抽屉态与切换态不可并存。打开抽屉时自动关闭 Popover，反之亦然。
- 语音态可与对话态叠加（底部输入栏替换为语音面板，上方消息列表保留）。
- 抽屉态/切换态打开时，底部输入栏不可交互（被遮罩覆盖或 `opacity-60` 降透明度）。

**关闭规则**：
- 抽屉态：点击 Scrim 或点击关闭按钮（`x`）关闭。
- 切换态：点击 Scrim 或选择儿童后自动关闭。
- 语音态：点击键盘切换按钮或取消按钮退出。

**新建会话转移**：
- 从对话态点击"新建会话"（页眉左侧或抽屉内），清空当前消息列表，回到空状态。当前会话保存到历史列表。

---

## 4. 全局布局骨架

### 4.1 三段式骨架

```
┌─────────────────────────────────┐
│  固定页眉 Header (56px, sticky)  │  z-50
├─────────────────────────────────┤
│                                 │
│  消息区 Body (flex-1, 可滚动)    │
│                                 │
├─────────────────────────────────┤
│  底部输入栏 InputBar (sticky)    │  z-40
└─────────────────────────────────┘
```

容器为 `display: flex; flex-direction: column; min-height: 100vh`，三段纵向排列。

### 4.2 固定页眉规格

| 属性 | 值 |
|------|-----|
| `position` | `sticky; top: 0` |
| `z-index` | `50` |
| `height` | `56px`（`h-14`） |
| 背景 | `rgba(255, 255, 255, 0.85)` + `backdrop-filter: blur(8px)` |
| 底边框 | `1px solid var(--gp-border)` |
| 内边距 | `0 16px`（`px-4`） |
| 布局 | `flex; justify-content: space-between; align-items: center` |

**左侧按钮组**与**右侧按钮组**分别紧贴左右边缘，中间为弹性空间。

### 4.3 底部输入栏规格

| 属性 | 值 |
|------|-----|
| `position` | `sticky; bottom: 0` |
| `z-index` | `40` |
| 背景 | `rgba(255, 255, 255, 0.95)` + `backdrop-filter: blur(8px)` |
| 顶边框 | `1px solid var(--gp-border)` |
| 内边距 | `12px 16px` + `padding-bottom: max(12px, env(safe-area-inset-bottom))` |
| 布局 | `flex; align-items: center; gap: 8px` |

### 4.4 安全区适配

底部输入栏使用 `padding-bottom: max(12px, env(safe-area-inset-bottom))` 适配刘海屏/底部安全区。页眉不需要顶部安全区适配（`sticky top: 0` 已固定在视口顶部）。

---

## 5. 组件规格清单

### 5.1 页眉按钮组

#### 5.1.1 抽屉切换按钮

| 属性 | 值 |
|------|-----|
| 尺寸 | `40x40`（`w-10 h-10`） |
| 圆角 | `8px`（`rounded-lg`） |
| 背景 | `bg-muted/50` |
| 图标 | `panel-left`（Lucide），`20x20` |
| 图标色 | `text-muted-foreground` |
| 交互 | hover `bg-muted`；`active:scale-95` |
| `data-dom-id` | `drawer-toggle` |
| `aria-label` | "打开侧边栏" |
| 行为 | 点击打开历史抽屉（→ 抽屉态） |

#### 5.1.2 新建会话按钮

| 属性 | 值 |
|------|-----|
| 尺寸 | `40x40`（`w-10 h-10`） |
| 圆角 | `8px` |
| 背景 | `bg-muted/50` |
| 图标 | `square-pen`（Lucide），`20x20` |
| `data-dom-id` | `new-session` |
| `aria-label` | "新建对话" |
| **显隐规则** | **仅当存在聊天记录时显示**。空状态下隐藏（设计图 `assistant-empty.html` 中此按钮不存在）。 |
| 行为 | 点击清空当前消息，回到空状态，当前会话存入历史 |

#### 5.1.3 儿童头像切换

| 属性 | 值 |
|------|-----|
| 头像尺寸 | `36x36`（`w-9 h-9`）圆形 |
| 头像背景 | `bg-primary/15` |
| 头像文字 | 儿童姓名首字（如"明"），`font-bold text-primary text-sm` |
| 切换徽标 | 右下角 `16x16`（`w-4 h-4`）圆形，`bg-card border border-border`，内含 `chevron-down` 图标 `10x10`（`icon-10`） |
| 选中态 | `ring-2 ring-primary ring-offset-2 ring-offset-card` |
| `data-dom-id` | `child-switch` |
| `aria-label` | "切换孩子" |
| 行为 | 点击弹出儿童切换 Popover（→ 切换态） |

**注意**：抽屉态下的儿童头像显示完整样式（头像 + 姓名文字 + 箭头），如 `assistant-drawer.html` 所示。空状态和对话态下仅显示头像 + 徽标。

#### 5.1.4 语音开关按钮

| 属性 | 值 |
|------|-----|
| 尺寸 | `40x40`（`w-10 h-10`） |
| 圆角 | `8px` |
| 背景 | `bg-muted/50` |
| 图标 | `volume-2`（Lucide），`20x20` |
| `data-dom-id` | `voice-toggle` |
| `aria-label` | "语音" |
| 行为 | 点击切换语音模式（→ 语音态或退出语音态） |

---

### 5.2 空状态区

#### 5.2.1 IP 形象图

| 属性 | 值 |
|------|-----|
| 尺寸 | `128x128`（`w-32 h-32`） |
| 圆角 | `16px`（`rounded-2xl`） |
| 填充 | `object-cover` |
| 阴影 | `shadow-md` |
| 底边距 | `24px`（`mb-6`） |
| 资源 | `../assets/ip-sprouty-hero.jpg` |
| `alt` | "小萌芽" |

#### 5.2.2 问候语

| 元素 | 规格 | 文案 |
|------|------|------|
| 主标题 | `text-2xl font-bold text-foreground` | "下午好，我是小萌芽" |
| 副标题 | `text-sm text-muted-foreground` | "有什么我可以帮你的吗？" |

**时段动态**：问候语前缀应根据当前时段切换："上午好"/"下午好"/"晚上好"。

#### 5.2.3 快捷短语按钮

4 个按钮纵向排列，`flex flex-col gap-3 w-full max-w-xs`。

| 序号 | 图标 | 图标容器 | 文案 | 映射意图 | `data-dom-id` |
|------|------|---------|------|---------|---------------|
| 1 | `star` | `36x36 bg-primary/10 text-primary rounded-lg` | 我的积分是多少？ | `query_points` | `quick-phrase-1` |
| 2 | `check-square` | 同上 | 今日任务是什么？ | `query_task` | `quick-phrase-2` |
| 3 | `trending-up` | 同上 | 帮我看看成长报告 | `query_ability` | `quick-phrase-3` |
| 4 | `gift` | 同上 | 最近有什么奖励？ | `query_reward`（新意图） | `quick-phrase-4` |

**按钮规格**：`bg-card border border-border rounded-lg px-4 py-3`，`flex items-center gap-3 text-left`，hover `bg-muted/50`。文字 `text-sm text-foreground font-medium`。图标容器 `shrink-0`。

**行为**：点击即发送该文案作为用户消息，进入对话态。

---

### 5.3 对话消息列表

#### 5.3.1 AI 消息气泡（左侧）

```
┌──────────────────────────┐
│ [IP头像] ┌─────────────┐  │
│  32x32   │ AI 气泡内容   │  │
│          └─────────────┘  │
└──────────────────────────┘
```

| 属性 | 值 |
|------|-----|
| 布局 | `flex justify-start items-start gap-2` |
| IP 头像 | `32x32`（`w-8 h-8`）圆形，`rounded-full`，外层 `bg-primary/10` 容器，`overflow-hidden` |
| 头像图片 | `../assets/ip-sprouty-hero.jpg`，`object-cover` |
| 气泡背景 | `bg-card` |
| 气泡边框 | `border border-border` |
| 气泡圆角 | `rounded-lg rounded-tl-sm`（左上角削尖） |
| 气泡阴影 | `shadow-sm` |
| 气泡最大宽度 | `75%`（小屏 `≤380px` 放宽至 `82%`） |
| 内边距 | `px-4 py-2.5` |
| 文字 | `text-sm text-foreground`，`whitespace-pre-wrap`（保留换行） |
| 文字断行 | `word-break: break-word; overflow-wrap: anywhere` |

#### 5.3.2 儿童消息气泡（右侧）

```
                  ┌─────────────┐
                  │ 儿童气泡内容  │
                  └─────────────┘
```

| 属性 | 值 |
|------|-----|
| 布局 | `flex justify-end items-start` |
| 头像 | 无（右侧不显示头像） |
| 气泡背景 | `bg-primary` |
| 气泡文字色 | `text-primary-foreground` |
| 气泡圆角 | `rounded-lg rounded-tr-sm`（右上角削尖） |
| 气泡最大宽度 | `75%`（小屏放宽至 `82%`） |
| 内边距 | `px-4 py-2.5` |
| 文字 | `text-sm` |

#### 5.3.3 Loading 态

AI 正在回复时的加载动画。

| 属性 | 值 |
|------|-----|
| 布局 | 同 AI 气泡（左侧 + IP 头像） |
| 气泡内 | 3 个圆点 `flex gap-1 items-center` |
| 圆点尺寸 | `8x8`（`w-2 h-2`） |
| 圆点颜色 | `bg-muted-foreground/40` |
| 圆角 | `rounded-full` |
| 动画 | `animate-bounce`，`animation-delay` 分别为 `0ms`、`150ms`、`300ms` |

#### 5.3.4 富文本高亮

AI 回复中的关键数值（如积分、任务数）使用富文本高亮：

| 场景 | 样式 | 示例 |
|------|------|------|
| 数值高亮 | `font-bold text-primary` | "你当前有 **2850** 积分" |
| 数值高亮（变体） | `font-semibold text-primary` | "**2850 积分**" |

#### 5.3.5 消息间距

消息列表 `space-y-3`（条目间距 `12px`）。消息列表容器 `px-4 py-4`。

---

### 5.4 历史抽屉

#### 5.4.1 遮罩 Scrim

| 属性 | 值 |
|------|-----|
| `position` | `absolute; inset: 0` |
| 背景 | `rgba(0, 0, 0, 0.4)` |
| 模糊 | `backdrop-filter: blur(4px)` |
| `z-index` | `50` |
| `data-dom-id` | `drawer-scrim` |
| 行为 | 点击关闭抽屉 |

#### 5.4.2 抽屉面板

| 属性 | 值 |
|------|-----|
| `position` | `absolute; top: 0; bottom: 0; left: 0` |
| 宽度 | `85%`，`max-width: 340px` |
| `z-index` | `50` |
| 背景 | `bg-card` |
| 阴影 | `box-shadow: 0 10px 30px rgba(0,0,0,0.18)` |
| 布局 | `flex flex-direction: column; height: 100%` |
| `data-region` | `drawer-panel` |

#### 5.4.3 抽屉头部

由标题行 + 搜索栏 + 新建按钮三部分组成，`border-b border-border px-4 pb-3 pt-4`。

**标题行**：
- 标题："历史会话"，`text-base font-bold text-foreground`
- 关闭按钮：`32x32`（`w-8 h-8`），`bg-muted/50 text-muted-foreground`，`x` 图标 `18x18`，`data-dom-id="drawer-close"`

**搜索栏**：
- 容器：`h-10 bg-muted rounded-lg px-3`，`flex items-center gap-2`
- 搜索图标：`search`，`16x16`，`text-muted-foreground`
- 输入框：`bg-transparent text-sm`，`placeholder: "搜索会话..."`

**新建会话按钮**：
- 全宽 `h-10`，`rounded-lg bg-primary/10 text-sm font-medium text-primary`
- 图标：`plus`，`16x16`
- 文案："新会话"
- `data-dom-id="drawer-new-session"`

#### 5.4.4 会话列表分组

按时间分组，分组标题为 sticky 顶部小标题：

| 分组 | 标题文字 | 条件 |
|------|---------|------|
| 1 | 今天 | 当日会话 |
| 2 | 昨天 | 前一日会话 |
| 3 | 7天内 | 本周内（不含今天/昨天） |
| 4 | 更早 | 超过 7 天 |

分组标题样式：`sticky top-0 z-10 bg-card px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground`。

#### 5.4.5 会话条目

| 属性 | 值 |
|------|-----|
| 布局 | `flex items-start gap-3 rounded-lg px-3 py-3` |
| 交互 | hover `bg-muted/50`；cursor-pointer |
| 选中态 | `bg-primary/5`（背景高亮） |
| 图标 | `message-circle`，`28x28`（`w-7 h-7`）容器 `bg-primary/10 rounded-lg`，图标 `14x14` `text-primary` |
| 标题 | `truncate text-sm font-medium text-foreground` |
| 最后消息预览 | `truncate text-xs text-muted-foreground`，`mt-0.5` |
| 时间戳 | `text-xs text-muted-foreground`，`flex-shrink-0` |
| 列表滚动 | `overflow-y: auto`，4px 细滚动条（`::-webkit-scrollbar-thumb: bg-border rounded-full`） |

**时间戳格式**：今天显示 `HH:MM`（如"14:32"），昨天显示"昨天"，7天内显示星期几（如"周三"），更早显示日期。

---

### 5.5 儿童切换 Popover

#### 5.5.1 Popover 定位

| 属性 | 值 |
|------|-----|
| `position` | `absolute; top: 64px; right: 16px` |
| 宽度 | `240px` |
| `z-index` | `50` |
| 背景 | `bg-card` |
| 圆角 | `rounded-lg` |
| 边框 | `border border-border` |
| 阴影 | `box-shadow: 0 12px 32px rgba(45,42,38,0.18), 0 4px 8px rgba(45,42,38,0.08)` |
| 箭头指针 | 伪元素 `::before`，`12x12`，`bg-card`，`border-top + border-left`，`transform: rotate(45deg)`，定位 `top: -6px; right: 22px` |
| `data-dom-id` | `child-switch-popover` |
| `role` | `listbox` |
| `aria-label` | "选择儿童" |

#### 5.5.2 遮罩

| 属性 | 值 |
|------|-----|
| `position` | `absolute; top: 56px; bottom: 0; left: 0; right: 0` |
| 背景 | `rgba(0, 0, 0, 0.3)` |
| `z-index` | `40` |
| `data-dom-id` | `switch-scrim` |

**注意**：遮罩从页眉下方（`top: 56px`）开始，页眉本身不被遮罩覆盖。

#### 5.5.3 Popover 头部

`px-4 py-2.5 border-b border-border bg-muted/50`，含小标题"选择儿童"，`text-xs font-semibold text-muted-foreground`。

#### 5.5.4 儿童条目

| 属性 | 值 |
|------|-----|
| 布局 | `flex items-center gap-3 w-full px-3 py-2.5 text-left` |
| 头像 | `36x36`（`w-9 h-9`）圆形 |
| 当前儿童头像 | `bg-primary/15 text-primary font-bold text-sm` |
| 其他儿童头像 | `bg-muted text-muted-foreground font-bold text-sm` |
| 姓名 | `text-sm font-medium text-foreground` |
| 积分 | `text-xs text-muted-foreground`（如"2850 积分"） |
| 选中态 | `bg-primary/5 border-l-2 border-primary` + 右侧 `check` 图标 `18x18 text-primary` |
| 未选中态 | hover `bg-muted/50`，无边框 |
| `role` | `option` |
| `aria-selected` | `true` / `false` |

#### 5.5.5 分割线与添加入口

- 分割线：`h-px bg-border my-0.5`
- 添加孩子：`flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50`
  - 头像位：`36x36` 圆形，`border-2 border-dashed border-border`，`text-muted-foreground`
  - 图标：`user-plus`，`16x16`
  - 文案："添加孩子"，`text-sm text-muted-foreground`
  - `data-dom-id="add-child"`
  - 行为：跳转儿童档案创建页（`/settings/family`）

---

### 5.6 语音输入栏

替换底部输入栏的语音输入模式。

#### 5.6.1 录音状态提示

聊天区底部显示录音状态指示器（非输入栏内）：

| 属性 | 值 |
|------|-----|
| 布局 | `flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground` |
| 红点 | `h-1.5 w-1.5 animate-pulse rounded-full bg-state-error` |
| 文案 | "正在录音" |

#### 5.6.2 语音输入栏结构

`voice-bar border-t border-border bg-card/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur`，`flex flex-col items-center gap-3`。

三层结构（从上到下）：

**第一层 — 识别预览区**：

| 属性 | 值 |
|------|-----|
| 尺寸 | `min-h-[40px] w-full` |
| 背景 | `bg-muted` |
| 圆角 | `rounded-lg` |
| 内边距 | `px-4 py-2` |
| 对齐 | `text-center` |
| 文字 | `text-sm text-muted-foreground` |
| 默认文案 | "正在聆听..." |

**第二层 — 波形可视化**：

7 根柱条，`flex h-10 items-center justify-center gap-1`。

| 柱条序号 | 宽度 | 高度 | `animation-delay` |
|---------|------|------|-------------------|
| 1 | `6px`（`w-1.5`） | `12px` | `0s` |
| 2 | `6px` | `24px` | `0.1s` |
| 3 | `6px` | `16px` | `0.2s` |
| 4 | `6px` | `32px` | `0.3s` |
| 5 | `6px` | `20px` | `0.4s` |
| 6 | `6px` | `28px` | `0.5s` |
| 7 | `6px` | `12px` | `0.6s` |

柱条样式：`rounded-full bg-primary`，`transform-origin: center`，动画 `anim-waveform 0.8s ease-in-out infinite`。

`@keyframes waveform`: `0%, 100% { transform: scaleY(0.4) }` → `50% { transform: scaleY(1) }`。

**第三层 — 控制组**：

`flex items-center justify-center gap-6`。

| 控件 | 尺寸 | 背景 | 图标 | 图标尺寸 | `data-dom-id` | `aria-label` |
|------|------|------|------|---------|---------------|-------------|
| 取消 | `48x48`（`w-12 h-12`） | `bg-muted text-muted-foreground` | `x` | `22x22` | `voice-cancel` | "取消录音" |
| 麦克风 | `64x64`（`w-16 h-16`） | `bg-primary text-primary-foreground shadow-lg` | `mic` | `28x28`（`w-7 h-7`） | `voice-mic` | "麦克风" |
| 键盘切换 | `48x48` | `bg-muted text-muted-foreground` | `keyboard` | `22x22` | `input-mode-toggle` | "切换到键盘输入" |

**麦克风动画**：
- `anim-mic-pulse`: `2s ease-in-out infinite`，`0%, 100% { transform: scale(1); opacity: 1 }` → `50% { transform: scale(1.1); opacity: 0.8 }`
- 外圈 `anim-ping-ring`: `1.6s ease-out infinite`，`absolute inset-0 rounded-full border-2 border-primary/40`，`0% { transform: scale(1); opacity: 0.6 }` → `100% { transform: scale(1.5); opacity: 0 }`

**按钮交互**：`active:scale-95`，hover `bg-border`（取消/键盘切换）。

#### 5.6.3 降级策略

`@media (prefers-reduced-motion: reduce)` 时，`anim-mic-pulse`、`anim-waveform`、`anim-ping-ring` 全部 `animation: none !important`。

---

## 6. 交互流程规格

### 6.1 首次进入 → 空状态迎宾流程

```
用户进入助手 Tab
  → 检查当前儿童是否有历史会话
    → 无会话：显示空状态（IP 形象 + 问候语 + 4 快捷短语）
    → 有会话：加载最近会话，进入对话态
```

**空状态迎宾**：
- IP 形象图片加载完成后显示
- 问候语根据当前时段动态生成（上午好/下午好/晚上好）
- 4 个快捷短语按钮固定展示
- 页眉左侧"新建会话"按钮隐藏（无聊天记录）

### 6.2 发送消息 → 对话往返流程

```
用户在输入框输入文字 / 点击快捷短语
  → 消息添加到列表右侧（儿童气泡）
  → 清空输入框
  → 立即显示 AI Loading 态（左侧 3 点动画）
  → 调用 AI 接口（携带对话上下文）
    → 成功：替换 Loading 为 AI 回复气泡（含富文本高亮）
    → 失败：替换 Loading 为错误提示气泡，支持重试
  → 消息列表自动滚动到底部
```

**异常处理**：
- 网络超时（>3s）：显示"网络不太好，请重试"
- AI 服务异常：显示"小萌芽暂时无法回复，请稍后再试"
- 错误气泡内含"重试"按钮

**空状态 → 对话态转移**：首次发送消息后，空状态区域消失，页眉左侧"新建会话"按钮出现。

### 6.3 历史会话管理流程

```
点击页眉左侧抽屉按钮
  → 对话态叠加抽屉态（Scrim + Panel 从左滑入）
  → 加载该儿童的历史会话列表
    → 按今天/昨天/7天内/更早分组展示
  → 用户可：
    a) 点击搜索栏 → 输入关键词 → 过滤会话列表
    b) 点击会话条目 → 关闭抽屉，加载该会话消息到对话区
    c) 点击"新会话" → 关闭抽屉，清空当前消息，回到空状态
    d) 点击 Scrim / 关闭按钮 → 关闭抽屉，回到对话态
```

### 6.4 儿童切换流程

```
点击页眉右侧儿童头像
  → 叠加切换态（Scrim + Popover 弹出）
  → 显示儿童列表（含姓名/积分/选中态）
  → 用户选择目标儿童
    → 关闭 Popover
    → 页眉头像更新为目标儿童
    → 重新加载该儿童的会话历史
    → 重新加载该儿童的能力数据/IP 阶段
    → 若有未发送草稿：清空并提示"已切换到 XX"
    → 若目标儿童无会话：进入空状态
    → 若目标儿童有会话：进入对话态（显示最近会话）
  → 用户点击"添加孩子"
    → 跳转 /settings/family
```

### 6.5 语音输入流程

```
点击输入栏右侧"输入模式切换"按钮
  → 底部输入栏替换为语音输入面板
  → 显示识别预览区（"正在聆听..."）
  → 显示波形动画
  → 显示大麦克风按钮（脉冲动画）
  → 显示录音状态提示（红点 + "正在录音"）

用户说话
  → 语音识别中，预览区实时显示识别文字
  → 识别完成
    → 识别文字回填到输入框（非直接发送）
    → 自动切换回键盘输入模式
    → 用户可编辑后点击发送

用户点击取消
  → 停止录音，丢弃识别结果
  → 切换回键盘输入模式

用户点击键盘切换
  → 停止录音，丢弃识别结果
  → 切换回键盘输入模式
```

**关键决策**：语音识别完成后回填到输入框待用户确认，而非直接发送。原因：设计图中有"正在聆听..."预览区，暗示识别结果需要用户检视。

### 6.6 输入模式切换流程

```
键盘模式 → 语音模式：
  → 点击输入栏右侧 keyboard 图标
  → 底部输入栏替换为语音面板
  → 输入框内容保留（切回时仍存在）

语音模式 → 键盘模式：
  → 点击语音面板右侧 keyboard 图标
  → 语音面板替换回输入栏
  → 若有识别结果，回填到输入框
```

**状态保持**：切换模式不改变当前会话状态，消息列表不受影响。

---

## 7. 数据与接口缺口

### 7.1 现有数据模型盘点

PRD-v3 第 5.1 节定义的 `ChatSession` 模型：

| 字段 | 说明 |
|------|------|
| `child_id` | 关联儿童 |
| `context_json` | 对话上下文 |
| `created_at` | 创建时间 |

当前后端实现（`chat_session.go`）仅支持单会话取最近一条，无法支撑抽屉的多会话列表、分组、搜索功能。

### 7.2 新增/修改字段

| 模型 | 新增字段 | 类型 | 用途 |
|------|---------|------|------|
| `ChatSession` | `title` | `string` | 抽屉列表标题（如"整理房间相关问答"） |
| `ChatSession` | `last_message` | `string` | 最后一条消息预览（抽屉列表副标题） |
| `ChatSession` | `last_message_at` | `timestamp` | 最后消息时间（排序与分组依据） |
| `ChatSession` | `message_count` | `int` | 消息计数（可选，用于显示） |

### 7.3 新增接口清单

| 接口 | 方法 | 用途 | 对应组件 | 优先级 |
|------|------|------|---------|--------|
| `/chat/sessions` | `GET` | 获取儿童会话列表（`?child_id=`，按时间分组返回） | 抽屉列表 | P0 |
| `/chat/sessions/search` | `GET` | 搜索会话（`?child_id=&q=`，匹配标题/消息内容） | 抽屉搜索栏 | P1 |
| `/chat/sessions` | `POST` | 主动新建会话（`?child_id=`） | 抽屉/页眉"新会话" | P0 |
| `/chat/sessions/:id` | `DELETE` | 删除会话 | 抽屉（长按/滑动） | P2 |
| `/chat/sessions/:id` | `PATCH` | 重命名会话 | 抽屉（长按/滑动） | P2 |
| `/chat/voice` | `POST` | 语音转文字（上传音频，返回识别文本） | 语音输入栏 | P1 |

**P2 说明**：删除/重命名接口在当前设计图中无明确入口（无长按/滑动指示），标注为 P2 待交互设计确认后实现。

### 7.4 会话标题生成策略

**建议方案**：AI 自动摘要生成标题。

首次 AI 回复后，提取对话主题生成精炼标题（如"积分查询""整理房间相关问答""今日任务咨询"），写入 `ChatSession.title`。而非简单截取首条用户消息，因为设计图中的标题（如"整理房间相关问答"）明显比首条消息（如"我的积分是多少？"）更概括。

**兜底方案**：若 AI 摘要失败，回退为首条用户消息截断（前 20 字符）。

### 7.5 上下文重建（儿童切换后）

切换儿童后需重新加载以下数据：

| 数据 | 来源 | 用途 |
|------|------|------|
| 会话历史 | `GET /chat/sessions?child_id=` | 抽屉列表 |
| 最近会话消息 | `GET /chat/sessions/:id/messages` | 对话区 |
| 儿童能力数据 | `GET /abilities?child_id=` | 对话上下文构造 |
| IP 阶段 | 由能力数据派生 | IP 形象展示 |
| 儿童积分 | `GET /users/:id/balance` | Popover 显示 |

---

## 8. 细化功能需求清单（UI 层）

以下需求编号为 `FR-AI-UI-xxx`，与 PRD-v3 的 `FR-AI-001~008` 形成"高层 → UI 层"映射。完整对照关系见附录 B。

| 编号 | 功能 | 描述 | 验收标准 | 映射 PRD-v3 |
|------|------|------|---------|------------|
| FR-AI-UI-001 | 固定页眉 | 页眉 sticky 固定在顶部，含 4 个功能区 | 抽屉切换/新建会话/儿童头像/语音开关齐备；新建会话按钮空态隐藏 | FR-AI-001 |
| FR-AI-UI-002 | IP 头像双位置 | 页眉右侧 36x36 + AI 气泡旁 32x32 | 两处头像均使用 IP 形象图片 | FR-AI-002 |
| FR-AI-UI-003 | 空状态迎宾 | IP 形象 + 时段问候语 + 副标题 | 问候语随时段切换；IP 图 128x128 | FR-AI-001 |
| FR-AI-UI-004 | 快捷短语 | 4 个快捷短语按钮，点击发送对应意图消息 | 4 按钮文案/图标/意图映射正确；点击进入对话态 | FR-AI-004/005 |
| FR-AI-UI-005 | AI 气泡样式 | 左侧 IP 头像 + 白底气泡，左上角削尖 | 气泡 max-w 75%，`rounded-tl-sm`，含阴影边框 | — |
| FR-AI-UI-006 | 儿童气泡样式 | 右侧主色气泡，右上角削尖 | `bg-primary text-primary-foreground`，`rounded-tr-sm` | — |
| FR-AI-UI-007 | Loading 动画 | AI 回复前显示 3 点弹跳动画 | 3 圆点 8x8，delay 0/150/300ms | — |
| FR-AI-UI-008 | 富文本高亮 | AI 回复中数值用主色加粗 | 积分/数量等关键值 `font-bold text-primary` | — |
| FR-AI-UI-009 | 历史抽屉 | 左滑抽屉，含搜索/新建/分组列表 | 按今天/昨天/7天内/更早分组；可搜索可切换 | FR-AI-007 |
| FR-AI-UI-010 | 儿童切换 Popover | 点击头像弹出列表，含积分/选中态/添加入口 | Popover 定位 top:64px right:16px；切换后上下文重建 | FR-AI-008 |
| FR-AI-UI-011 | 语音输入模式 | 波形+麦克风+取消+键盘切换 | 波形 7 柱条动画；麦克风 64x64 脉冲；支持 reduced-motion | — |
| FR-AI-UI-012 | 输入模式切换 | 键盘 ⇄ 语音互切，状态保持 | 切换不丢失输入内容；语音识别结果回填输入框 | — |
| FR-AI-UI-013 | 多会话管理 | 新建/切换会话 | 新建回到空状态并保存当前到历史；切换加载目标会话 | FR-AI-007 |
| FR-AI-UI-014 | 安全区适配 | 底部输入栏适配刘海屏 | `padding-bottom: max(12px, env(safe-area-inset-bottom))` | — |

---

## 9. 无障碍与动效规范

### 9.1 ARIA 标签与键盘可达性

| 组件 | ARIA 属性 | 键盘操作 |
|------|----------|---------|
| 抽屉切换按钮 | `aria-label="打开侧边栏"` | Tab 聚焦 → Enter 打开 |
| 新建会话按钮 | `aria-label="新建对话"` | Tab → Enter |
| 儿童头像 | `aria-label="切换孩子"`；展开时 `aria-expanded="true"` | Tab → Enter 展开 |
| 语音开关 | `aria-label="语音"` | Tab → Enter |
| 儿童切换 Popover | `role="listbox"`；条目 `role="option"`，`aria-selected` | 上下键导航 → Enter 选择 |
| 抽屉关闭 | `aria-label="关闭抽屉"` | Tab → Enter / Esc 关闭 |
| 麦克风 | `aria-label="麦克风"` | Tab → Enter 开始/停止 |
| 取消录音 | `aria-label="取消录音"` | Tab → Enter |
| 波形可视化 | `aria-hidden="true"` | — |

### 9.2 动效规范

| 动效 | 用途 | 参数 | 降级 |
|------|------|------|------|
| `animate-bounce` | AI Loading 三点 | Tailwind 默认 | `prefers-reduced-motion` 仍可用（轻微） |
| `anim-waveform` | 语音波形 | `0.8s ease-in-out infinite`，`scaleY(0.4)↔scaleY(1)` | `animation: none` |
| `anim-mic-pulse` | 麦克风脉冲 | `2s ease-in-out infinite`，`scale(1)↔scale(1.1)` | `animation: none` |
| `anim-ping-ring` | 麦克风外圈扩散 | `1.6s ease-out infinite`，`scale(1)→scale(1.5) opacity 0.6→0` | `animation: none` |
| `animate-pulse` | 录音红点 | Tailwind 默认 | `prefers-reduced-motion` 仍可用 |

**降级规则**：`@media (prefers-reduced-motion: reduce)` 时，`anim-waveform`、`anim-mic-pulse`、`anim-ping-ring` 全部设为 `animation: none !important`。`animate-bounce` 和 `animate-pulse` 为 Tailwind 内置，`prefers-reduced-motion` 下自动降级。

---

## 附录

### 附录 A：设计图与状态映射表

| 设计图 | 状态 | 触发条件 | 覆盖 FR-AI-UI 编号 |
|--------|------|---------|-------------------|
| `assistant-empty.html` | 空状态 Empty | 无会话进入 / 新建会话 | 001, 002, 003, 004, 014 |
| `assistant-chat.html` | 对话态 Chat | 有消息 / 发送消息 | 001, 002, 005, 006, 007, 008, 012, 014 |
| `assistant-drawer.html` | 抽屉态 Drawer | 点击页眉左侧抽屉按钮 | 001, 009, 013 |
| `assistant-child-switch.html` | 切换态 Switch | 点击页眉右侧儿童头像 | 001, 010 |
| `assistant-voice.html` | 语音态 Voice | 点击输入模式切换 | 011, 012, 014 |

### 附录 B：与 PRD-v3 FR-AI-001~008 对照关系

| PRD-v3 编号 | PRD-v3 描述 | 本文细化编号 | 细化内容 |
|------------|------------|------------|---------|
| FR-AI-001 | 助手 Tab 作为默认首页 | FR-AI-UI-001, 003 | 页眉 4 功能区规格 + 空状态迎宾 |
| FR-AI-002 | IP 形象作为对话头像 | FR-AI-UI-002 | 双位置头像（页眉 36x36 + 气泡 32x32），修正 C-03 冲突 |
| FR-AI-003 | 对话上下文自动构造 | 第 7.5 节 | 上下文重建数据清单（儿童切换后） |
| FR-AI-004 | 查询/提交任务意图 | FR-AI-UI-004 | 快捷短语 → 意图映射 |
| FR-AI-005 | 查询积分/能力意图 | FR-AI-UI-004, 008 | 快捷短语 + 富文本高亮 |
| FR-AI-006 | 家长设置阶段目标 | — | 保留 PRD-v3 定义，UI 层暂不细化（通过对话触发） |
| FR-AI-007 | 对话历史保存 | FR-AI-UI-009, 013 | 抽屉分组列表 + 多会话管理 |
| FR-AI-008 | 角色权限区分 | FR-AI-UI-010 | 儿童切换 Popover（切换上下文） |

### 附录 C：现状偏差说明

现有前端实现 `frontend/src/pages/AssistantPage.tsx` 与设计图存在以下偏差，需以设计图为基线重做：

| 偏差项 | 现状 | 设计图口径 |
|--------|------|-----------|
| 页眉配色 | 绿色渐变 `from-emerald-500 to-green-600` | 暖橙奶油体系（`--gp-primary: #F59E6B`） |
| IP 名称 | "小芽" | "小萌芽" |
| 页眉布局 | 单行标题式 | 左右按钮组（抽屉/新建 + 头像/语音） |
| 历史会话 | 单会话，无抽屉 | 左滑抽屉 + 分组列表 + 搜索 |
| 儿童切换 | 无 | Popover 列表 + 积分显示 |
| 语音输入 | 无 | 完整语音输入面板 |
| 底部输入栏 | 基础输入框 | 输入框 + 模式切换 + 发送按钮 |

后端 `chat_service.go` 中 system prompt 硬编码"小芽"，需同步修正为"小萌芽"。
