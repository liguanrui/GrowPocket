# 新手指引 Onboarding V2 Spec

## Why
新手指引流程存在三个体验问题：① Step 2 姓名收集语义模糊，分不清是儿童还是家长；② 问卷提交后直接跳转成长页，缺少能力维度雷达图展示环节；③ 新用户首次进入成长页需手动触发阶段目标设置和任务生成，无引导。需要把"能力展示 + 目标设置 + 任务生成"纳入 Onboarding 流程，让新用户一次走完完整初始化。

## What Changes
- **OnboardingPage Step 2 文案明确化**：IP 气泡改为"小朋友叫什么名字呀？"，placeholder 改为"请输入宝宝的名字"
- **Onboarding 步骤从 5 步扩展为 6 步**：新增 Step 6（能力雷达图 + 阶段目标设置 + AI 任务生成）
- **Step 6A 能力雷达图**：调用 `getChildScores` 展示 6 维能力得分，复用 `RadarChartSVG` 组件
- **Step 6B 阶段目标设置**：日期区间选择 + 6 维度勾选 + 目标分下拉，调用 `createCycle` + `setGoal`
- **Step 6C 生成任务列表**：目标保存后调用 `generateAITasks`，展示任务列表，底部"进入成长主页"按钮
- **Onboarding 顶部进度圆点**：从 5 个改为 6 个
- **Onboarding 支持 URL 参数**：`?step=6&child_id=N` 直接进入 Step 6
- **Step 5 跳转问卷增加参数**：URL 增加 `return=onboarding`
- **QuestionnairePage 跳转逻辑改造**：检测 `return=onboarding` 参数，提交后跳回 Onboarding Step 6（而非 `/growth`）

## Impact
- Affected specs: 无（独立功能模块）
- Affected code:
  - `frontend/src/pages/OnboardingPage.tsx`（主要改动：新增 Step 6、Step 2 文案、进度圆点、URL 参数支持）
  - `frontend/src/pages/QuestionnairePage.tsx`（小改动：handleSubmit 跳转分支）
  - 复用现有 service：`getChildScores`、`getAbilities`、`createCycle`、`setGoal`、`generateAITasks`

## ADDED Requirements

### Requirement: Onboarding Step 6 能力雷达图展示
系统 SHALL 在问卷提交后返回 Onboarding Step 6，展示儿童的能力维度雷达图。

#### Scenario: 问卷提交后展示雷达图
- **WHEN** 用户从 Onboarding 进入问卷并提交
- **THEN** 跳转回 `/onboarding?step=6&child_id=N`
- **AND** 调用 `getChildScores(childId)` 获取能力得分
- **AND** 渲染 6 维雷达图（复用 RadarChartSVG 组件，暖橙填充）
- **AND** IP 形象 expression=proud，气泡"这是小朋友的能力小档案~"

#### Scenario: 能力分数加载中
- **WHEN** 进入 Step 6 但能力分数尚未返回
- **THEN** 雷达图区域显示"加载中..."占位文字

### Requirement: Onboarding Step 6 阶段目标设置
系统 SHALL 在雷达图展示后，引导家长设置阶段区间和维度目标。

#### Scenario: 设置阶段目标
- **WHEN** Step 6 雷达图展示完成，进入目标设置环节
- **THEN** 显示日期区间选择器（默认今天起 30 天）
- **AND** 显示 6 个能力维度列表，每个维度可勾选并设置目标分（10/20/30/40/50/60/80/100）
- **AND** 点击"保存目标"调用 `createCycle` 创建周期 + 逐个 `setGoal` 设置维度目标
- **AND** 保存成功后隐藏目标设置卡片，显示任务生成环节

#### Scenario: 目标校验失败
- **WHEN** 用户未选择时间区间或未勾选任何维度
- **THEN** Toast 提示"请选择时间区间"或"请至少为一个维度设置目标"
- **AND** 不发起保存请求

### Requirement: Onboarding Step 6 生成任务列表
系统 SHALL 在阶段目标保存成功后，引导用户触发 AI 任务生成。

#### Scenario: 生成专属任务
- **WHEN** 阶段目标保存成功，进入任务生成环节
- **THEN** 显示"点击生成任务"按钮
- **AND** 点击后调用 `generateAITasks(childId)` 触发后端 AI 生成
- **AND** 生成完成后展示任务列表（标题 + 积分）
- **AND** 底部出现"进入成长主页"按钮

#### Scenario: 任务生成失败
- **WHEN** AI 生成返回空列表或报错
- **THEN** Toast 提示"暂未生成任务，请稍后重试或检查 AI 配置"
- **AND** 允许重试

### Requirement: Onboarding Step 6 进入成长主页
系统 SHALL 在任务生成完成后，允许用户进入成长主页。

#### Scenario: 进入成长主页
- **WHEN** 任务生成完成且列表非空
- **THEN** 底部显示"进入成长主页"按钮
- **AND** 点击后 `navigate('/growth', { replace: true })`（replace 避免返回到 Onboarding）

## MODIFIED Requirements

### Requirement: Onboarding Step 2 姓名收集文案
Step 2 姓名收集环节 SHALL 明确是收集儿童姓名，避免与家长姓名混淆。

#### Scenario: 空输入状态
- **WHEN** 用户进入 Step 2 且输入框为空
- **THEN** IP 气泡显示"小朋友叫什么名字呀？"
- **AND** 输入框 placeholder 显示"请输入宝宝的名字"
- **AND** IP 表情为 think

#### Scenario: 输入后反馈
- **WHEN** 用户输入姓名（≥1 字符）
- **THEN** IP 气泡变为"{名字}，真好听的名字！"
- **AND** IP 表情切换为 encourage

### Requirement: Onboarding 顶部进度指示器
Onboarding 顶部进度圆点 SHALL 从 5 个扩展为 6 个，反映新增的 Step 6。

#### Scenario: 进度圆点展示
- **WHEN** 用户处于任意步骤
- **THEN** 顶部显示 6 个圆点
- **AND** 当前步骤圆点放大 + 脉冲动画
- **AND** 已完成步骤填充暖橙 `#F59E6B`
- **AND** 未完成步骤灰色 `#F5E6D3`

### Requirement: Onboarding URL 参数支持
Onboarding SHALL 支持 `?step=6&child_id=N` URL 参数直接进入 Step 6。

#### Scenario: 从问卷返回 Step 6
- **WHEN** 访问 `/onboarding?step=6&child_id=N`
- **THEN** 直接进入 Step 6（跳过 Step 1-5）
- **AND** 使用 URL 中的 `child_id` 加载能力分数和维度数据
- **AND** 顶部返回按钮禁用（step === 6 时不可返回）

### Requirement: Onboarding Step 5 跳转问卷参数
Onboarding Step 5 创建儿童档案后跳转问卷 SHALL 携带 `return=onboarding` 参数。

#### Scenario: 跳转问卷
- **WHEN** 用户在 Step 5 点击"准备好了，开始！"
- **THEN** 创建儿童档案
- **AND** 跳转 `/questionnaire?stage=register&level=Lx&child_id=N&return=onboarding`

### Requirement: QuestionnairePage 提交跳转分支
问卷提交 SHALL 根据 `return` 参数决定跳转目标。

#### Scenario: 从 Onboarding 进入的问卷
- **WHEN** 问卷 URL 含 `return=onboarding` 参数
- **AND** 用户提交问卷
- **THEN** 跳转 `/onboarding?step=6&child_id=N`（返回 Onboarding 展示雷达图）
- **AND** 不显示积分 Toast，不跳 `/growth`

#### Scenario: 非 Onboarding 进入的问卷
- **WHEN** 问卷 URL 不含 `return=onboarding` 参数
- **AND** 用户提交问卷
- **THEN** Toast 显示"问卷完成！获得 X 积分"
- **AND** 1.5 秒后跳转 `/growth`（维持原逻辑）
