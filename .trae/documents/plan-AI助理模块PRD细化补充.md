# AI 助理模块 PRD 细化补充 — 实施计划

## Summary

基于已完成的 5 个 AI 助理 UI 设计页面（空状态/对话/抽屉/儿童切换/语音输入），为 `PRD-童劳童得-v3.md` 第 4.1 节补充一份独立的 UI 交互层细化 PRD 文档。PRD-v3 现有 FR-AI-001~008 仅 8 条高层功能定义，缺失状态机、组件规格、交互流程、设计 token、数据接口缺口等细节。本计划产出一份可指导前端按设计图 1:1 还原的权威文档。

## Current State Analysis

### 现有 PRD 基础

`/Users/Admin1/Workhome/GrowPocket/.trae/documents/PRD-童劳童得-v3.md` 第 4.1 节已定义：
- 助手 Tab 作为默认首页（FR-AI-001）
- IP 形象作为对话头像（FR-AI-002，规格"80x80"）
- 对话上下文构造（FR-AI-003）
- 查询/提交任务/积分/能力意图（FR-AI-004~006）
- 对话历史保存（FR-AI-007）
- 角色权限区分（FR-AI-008）

### 已完成 UI 设计（5 个状态页面）

| 设计图 | 路径 | 核心内容 |
|--------|------|---------|
| 空状态 | `ai-assistant-ui-design/pages/assistant-empty.html` | IP 形象 + 问候语 + 4 快捷短语 |
| 对话中 | `ai-assistant-ui-design/pages/assistant-chat.html` | AI 气泡左/儿童气泡右 + Loading + 富文本 |
| 历史抽屉 | `ai-assistant-ui-design/pages/assistant-drawer.html` | 左滑 85% 抽屉 + 搜索 + 按时间分组会话列表 |
| 儿童切换 | `ai-assistant-ui-design/pages/assistant-child-switch.html` | 页眉右侧 popover 列表 + 积分 + 添加入口 |
| 语音输入 | `ai-assistant-ui-design/pages/assistant-voice.html` | 波形动画 + 大麦克风 + 取消/键盘切换 |

### 3 处 PRD-v3 与设计图的冲突

| 冲突点 | PRD-v3 原文 | 设计图口径 | 修正方向 |
|--------|------------|-----------|---------|
| IP 名称 | "小芽"（2.1 节，全文使用） | "小萌芽"（5 张设计图统一） | 以设计图"小萌芽"为准 |
| 语音输入 | NG-v3-4 "不实现 AI 语音对话" | 已设计完整语音输入 UI | 撤销 NG-v3-4，语音转文字纳入 MVP |
| IP 头像规格 | "对话窗口顶部 80x80" | 页眉右侧 36x36 + 气泡旁 32x32 | 以设计图为准，双位置头像 |

## Proposed Changes

### 产出文件

**新建**：`/Users/Admin1/Workhome/GrowPocket/.trae/documents/AI助理模块PRD细化-v3.md`

与主 PRD 同目录，命名沿用现有先例（`成长模块PRD细化与重构计划.md`）。文档定位为 PRD-v3 第 4.1 节的 UI 交互层细化补充，遇冲突以本文与设计图为准。

### 文档结构（9 节 + 附录）

```
# AI 助理模块 PRD 细化（v3 补充）
> 版本 / 依据 / 与主 PRD 关系 / 冲突声明

## 1. 概述与范围
  1.1 文档目的
  1.2 适用范围（AI 助理 Tab 全部界面状态）
  1.3 与 PRD-v3 的关系及冲突修正清单（3 处冲突）

## 2. 设计 Token 基线
  2.1 色彩 token（gp 前缀，暖橙 #F59E6B 主色，奶油 #FFFAF4 背景）
  2.2 圆角 / 字体 / 阴影 / 状态色 token
  2.3 响应式容器（max-w 448px 移动框架）

## 3. 页面状态机
  3.1 状态总览（5 态 + 转移条件）
  3.2 状态定义表（空状态/对话态/抽屉态/切换态/语音态）
  3.3 状态转移规则（互斥规则、遮罩层级关系）

## 4. 全局布局骨架
  4.1 三段式骨架（Header 56px / Body flex-1 / InputBar sticky）
  4.2 固定页眉规格（sticky top z-50 毛玻璃 + border-bottom）
  4.3 底部输入栏规格（sticky bottom z-40 + safe-area 适配）
  4.4 安全区适配（env(safe-area-inset-bottom)）

## 5. 组件规格清单（逐组件）
  5.1 页眉按钮组
      - 抽屉切换按钮（40x40, panel-left 图标）
      - 新建会话按钮（40x40, square-pen 图标, 仅有聊天记录时显示）
      - 儿童头像（36x36 圆形, 首字, 右下角切换徽标, ring-2 选中态）
      - 语音开关按钮（40x40, volume-2 图标）
  5.2 空状态区
      - IP 形象图（128x128 rounded-2xl shadow-md）
      - 问候语（text-2xl font-bold "下午好，我是小萌芽"）
      - 4 快捷短语按钮（star/check-square/trending-up/gift 图标, 映射意图）
  5.3 对话消息列表
      - AI 气泡（左, 32x32 IP 头像, bg-card border shadow, rounded-tl-sm, max-w 75%）
      - 儿童气泡（右, bg-primary text-primary-foreground, rounded-tr-sm, max-w 75%）
      - Loading 态（3 个 8x8 圆点 animate-bounce, delay 0/150/300ms）
      - 富文本高亮（积分数字 font-bold text-primary）
      - 消息间距 space-y-3, whitespace-pre-wrap 保留换行
  5.4 历史抽屉
      - Scrim（absolute inset-0, rgba(0,0,0,0.4), backdrop-blur(4px), z-50）
      - Panel（absolute left:0, width 85% max 340px, z-50, bg-card, box-shadow）
      - 头部（标题 + 关闭按钮 + 搜索栏 + 新会话按钮）
      - 会话列表分组（今天/昨天/7天内/更早, sticky 分组标题）
      - 会话条目（message-circle 图标 + 标题 + 最后消息预览 + 时间戳 + 选中态）
  5.5 儿童切换 Popover
      - 定位（absolute top:64px right:16px, width 240px, z-50, 箭头指针）
      - 遮罩（top:56px, rgba(0,0,0,0.3), z-40）
      - 儿童条目（36x36 头像 + 姓名 + 积分 + 选中态 border-l-2 + check 图标）
      - 添加孩子入口（虚线头像 + user-plus 图标）
  5.6 语音输入栏
      - 录音提示（红色脉冲点 + "正在录音"）
      - 识别预览区（min-h 40px bg-muted "正在聆听..."）
      - 波形动画（7 根 6px 柱条, bg-primary, 高度递变, anim-waveform 0.8s）
      - 大麦克风（64x64 bg-primary, anim-mic-pulse 2s, anim-ping-ring 1.6s）
      - 控制组（取消 48x48 + 麦克风 + 键盘切换 48x48）
      - 降级（prefers-reduced-motion 关闭所有动画）

## 6. 交互流程规格
  6.1 首次进入 → 空状态迎宾流程
  6.2 发送消息 → 对话往返流程（含 Loading 与异常）
  6.3 历史会话管理流程（打开/搜索/切换/新建/关闭）
  6.4 儿童切换流程（切换后上下文重建：重载会话历史/能力数据/IP 阶段）
  6.5 语音输入流程（录音/识别/取消/回填到输入框待确认）
  6.6 输入模式切换流程（键盘 ⇄ 语音, 状态保持）

## 7. 数据与接口缺口
  7.1 现有数据模型盘点（ChatSession 当前仅 child_id/context_json/created_at）
  7.2 新增/修改字段
      - ChatSession 新增: title, last_message, last_message_at, message_count
  7.3 新增接口清单
      - GET /chat/sessions?child_id=（会话列表, 按时间分组）
      - GET /chat/sessions/search?q=（会话搜索）
      - POST /chat/sessions（主动新建会话）
      - DELETE /chat/sessions/:id（删除会话, 标注 P2 交互待定）
      - PATCH /chat/sessions/:id（重命名, 标注 P2 交互待定）
      - POST /chat/voice（语音转文字）
  7.4 会话标题生成策略（建议 AI 摘要, 非首条消息截断）

## 8. 细化功能需求清单（UI 层）
  FR-AI-UI-001 ~ FR-AI-UI-012（逐条映射组件与交互, 含验收标准）
  与 PRD-v3 FR-AI-001~008 形成"高层→UI 层"对照

## 9. 无障碍与动效规范
  9.1 ARIA 标签 / 键盘可达性 / role 属性
  9.2 动效规范与 prefers-reduced-motion 降级策略

## 附录
  A. 设计图与状态映射表（5 张设计图 → 5 个状态 → 对应 FR-AI-UI 编号）
  B. 与 PRD-v3 FR-AI-001~008 的对照关系表
  C. 现状偏差说明（现有 AssistantPage.tsx 绿色渐变页眉与"小芽"文案, 需以设计图重做）
```

### 各章节核心内容要点

**第 2 节 — 设计 Token 基线**：从 `colors_and_type.css` 提取完整 gp 前缀 token 表（primary #F59E6B, background #FFFAF4, card #FFFFFF, muted #FFF1E6, muted-foreground #7A7168, border #F5E6D3, radius 8/12/16/999px, 状态色 success/warning/error/info）。

**第 3 节 — 页面状态机**：PRD-v3 完全缺失。定义 5 态及转移规则：空状态↔对话态（发送消息/新建会话）、对话态+抽屉态（点击页眉左侧）、对话态+切换态（点击页眉右侧）、对话态+语音态（点击输入模式切换）。互斥规则：抽屉态与切换态不可并存。

**第 5 节 — 组件规格**：PRD-v3 最核心缺口。逐组件从设计图 HTML 提取尺寸/颜色/z-index/动效/边界条件。关键补缺口：新建会话按钮条件显隐、4 快捷短语意图映射、气泡削尖方向、Loading 三点动画、抽屉分组规则、Popover 定位与箭头、波形参数。

**第 6 节 — 交互流程**：PRD-v3 仅 6.1 一条线性流程。补 6 条含异常分支的流程，重点：儿童切换后上下文重建、语音识别回填策略（建议回填输入框待确认，因有预览区）、新建会话清空当前消息回到空状态。

**第 7 节 — 数据接口缺口**：PRD-v3 第 5.1 节 ChatSession 模型过于粗略。补 title/last_message/last_message_at/message_count 字段缺口，列 6 个缺失接口。删除/重命名接口标注 P2（设计图无明确入口）。

**第 8 节 — FR-AI-UI 需求清单**：约 12 条，每条含验收标准，与 FR-AI-001~008 映射。例：FR-AI-UI-001 固定页眉含 4 功能区且新建按钮空态隐藏；FR-AI-UI-004 历史抽屉按 4 段时间分组可搜索可切换。

### 关键决策点（文档须明确）

1. 语音识别完成后：回填输入框待确认（建议，因有预览区）
2. 会话标题生成：AI 摘要（建议，贴合设计图精炼标题如"整理房间相关问答"）
3. 儿童切换后未发送草稿：清空并提示（建议）

## Assumptions & Decisions

- 以 5 张设计图为权威 UI 基线，不引入设计图不存在的组件（避免范围蔓延）
- 语音转文字纳入 MVP；语音双向对话（AI 语音播报）仍为非目标
- 多会话删除/重命名在设计图中无明确入口（无长按/滑动指示），标注 P2 交互待定
- 现有 AssistantPage.tsx（绿色渐变页眉 + "小芽"文案）与设计图不符，文档附录列为现状偏差，以设计图为重做基线
- 文档不重复 PRD-v3 已定义的 IP 进化机制、能力维度评分、问卷系统等内容

## Verification Steps

1. 逐组件对照 5 张设计图 HTML，确认尺寸/颜色/z-index/动效参数无遗漏
2. 3 处冲突修正清单均含"PRD-v3 原文 → 设计图口径 → 修正方向"双向引用
3. FR-AI-UI 需求条目可逐条映射到设计图具体 `data-dom-id` 元素
4. 文档结构 9 节 + 附录完整，每节内容可独立指导开发
5. 附录 B 的 FR-AI-001~008 对照关系表覆盖 PRD-v3 全部 8 条高层需求
