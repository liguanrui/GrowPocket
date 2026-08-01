# 新手指引 PRD 细化方案（V2）

> 基于 2026-08-01 探索结果，针对用户提出的 4 个问题进行方案确认。

## 1. 用户需求

1. 进入"问什么名字"步骤时，没有体现是输入儿童的名字还是家长的名字
2. 问卷结束之后，应该显示能力维度的雷达图
3. 进一步让家长设置阶段区间和目标
4. 以上结束后，根据儿童基础信息、现阶段能力维度、目标，生成任务列表

## 2. 现状分析

| 环节 | 现状 | 问题 |
|------|------|------|
| Onboarding Step 2 | IP 气泡"你叫什么名字呀？"，placeholder"请输入你的名字" | 语义模糊，分不清是儿童还是家长 |
| 问卷提交后 | Toast 提示积分 → 1.5s 后跳 `/growth` | 缺少能力维度雷达图展示环节 |
| 阶段目标设置 | 在 GrowthPage 内通过"设置目标"按钮触发 `showGoalSetup` 面板 | 新用户首次进入 GrowthPage 需手动触发，无引导 |
| 任务生成 | 后端 `GenerateTasksForChild` 已支持综合儿童信息/能力/目标生成 | 新用户问卷后未自动触发，需家长手动点"AI 生成" |

## 3. 方案设计（PRD 确认）

### 3.1 Onboarding 步骤重构（5步 → 6步）

将原 Onboarding 5 步扩展为 6 步，把"问卷完成后的能力展示 + 阶段目标设置"纳入 Onboarding 流程，让新用户一次性完成完整初始化。

| 步骤 | 内容 | 改动 |
|------|------|------|
| Step 1 | 欢迎页（不变） | — |
| Step 2 | 姓名收集 → **改为明确收集儿童姓名** | 文案改为"小朋友叫什么名字呀？"，placeholder"请输入宝宝的名字" |
| Step 3 | 年龄年级收集（不变） | — |
| Step 4 | 爱好收集（不变） | — |
| Step 5 | 问卷预告 → 跳转问卷（不变） | — |
| Step 6（新增） | 问卷完成后**返回 Onboarding** 展示雷达图 + 设置阶段目标 + 生成任务 | 新增 |

**流程链路**：
```
注册 → Onboarding(1-5步) → 问卷页 → 问卷提交后返回 Onboarding Step 6
→ 展示雷达图 → 设置阶段目标 → 生成任务 → 进入 /growth
```

**关键跳转改造**：
- Onboarding Step 5 跳问卷：`navigate('/questionnaire?stage=register&level=Lx&child_id=N&return=onboarding')`
- 问卷页检测 `return=onboarding` 参数，提交后不跳 `/growth`，而是 `navigate('/onboarding?step=6&child_id=N')`
- Onboarding 检测 `step=6` 参数直接进入 Step 6

### 3.2 Step 2 文案明确化

| 元素 | 改前 | 改后 |
|------|------|------|
| IP 气泡 | "你叫什么名字呀？" | "小朋友叫什么名字呀？" |
| 输入反馈 | "{名字}，真好听！" | "{名字}，真好听的名字！" |
| placeholder | "请输入你的名字" | "请输入宝宝的名字" |

### 3.3 Step 6 新增：能力雷达图 + 阶段目标 + 任务生成

**Step 6 三阶段子流程**（同一页面内分段展示）：

#### 6A. 能力维度雷达图展示
- 调用 `getChildScores(childId)` 获取问卷提交后的能力得分
- 复用 GrowthPage 中的 `RadarChartSVG` 组件（需提取为独立组件或直接内联）
- IP 形象 expression=proud，气泡"这是你的能力小档案~"
- 展示各维度得分文字列表

#### 6B. 阶段目标设置
- 调用 `getAbilities()` 获取维度列表，`getCurrentCycle(childId)` 获取当前周期
- 复用 GrowthPage 的目标设置逻辑：日期区间选择 + 维度目标分设置
- 简化版 UI：默认今天起 30 天，6 个维度可勾选并设置目标分
- 点击"保存目标"调用 `createCycle` + 多次 `setGoal`

#### 6C. 生成任务列表
- 目标保存成功后，调用 `generateAITasks(childId)` 触发后端 AI 生成
- 后端 `GenerateTasksForChild` 已支持综合儿童信息/能力/目标
- 展示生成的任务列表（标题 + 积分 + 维度标签）
- IP 气泡"小萌芽为你准备了这些任务，开始成长吧！"
- 底部按钮"进入成长主页"→ `navigate('/growth', { replace: true })`

### 3.4 问卷页跳转逻辑改造

**QuestionnairePage.tsx `handleSubmit` 改造**：
```tsx
// 检测是否从 onboarding 进入
const returnTo = searchParams.get('return');
if (returnTo === 'onboarding') {
  navigate(`/onboarding?step=6&child_id=${childId}`, { replace: true });
} else {
  toast.success(`问卷完成！获得 ${res.reward} 积分`);
  setTimeout(() => navigate('/growth'), 1500);
}
```

## 4. 具体改动文件

### 4.1 OnboardingPage.tsx（主要改动）
- Step 2 文案明确化（"小朋友" / "宝宝"）
- 新增 Step 6：雷达图 + 目标设置 + 任务生成
- 顶部进度圆点从 5 个改为 6 个
- 支持 URL 参数 `step=6&child_id=N` 直接进入 Step 6
- Step 5 跳转问卷 URL 增加 `return=onboarding` 参数

### 4.2 QuestionnairePage.tsx（小改动）
- `handleSubmit` 中检测 `return=onboarding` 参数，跳回 Onboarding Step 6

### 4.3 提取 RadarChartSVG 组件（可选）
- 将 GrowthPage.tsx 中的 `RadarChartSVG` 提取为 `components/RadarChartSVG.tsx`，供 Onboarding 和 GrowthPage 共用
- 或直接在 OnboardingPage 内联复制（简化改动）

## 5. 决策点

本方案的**核心决策**是：把问卷完成后的"能力展示 + 目标设置 + 任务生成"纳入 Onboarding 流程（Step 6），而不是让用户进入 GrowthPage 后自己摸索。这样保证新用户一次走完完整初始化，体验更连贯。

## 6. 验证步骤

1. 注册新账号 → Onboarding Step 1-5 文案正确（Step 2 明确是儿童姓名）
2. 问卷提交后返回 Onboarding Step 6（不跳 /growth）
3. Step 6 雷达图正确显示 6 维能力得分
4. 设置阶段目标（日期 + 维度分）保存成功
5. 自动触发 AI 任务生成，展示任务列表
6. 点击"进入成长主页"跳转 /growth，可见刚生成的任务
7. `go build` + `tsc --noEmit` 编译通过

## 7. 不做的事

- 不改后端逻辑（雷达图数据、目标设置、任务生成的 API 均已存在）
- 不改 GrowthPage 现有功能
- 不改问卷题目内容
