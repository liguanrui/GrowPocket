# Checklist

## Step 2 文案明确化
- [x] OnboardingPage Step 2 IP 气泡空状态显示"小朋友叫什么名字呀？"
- [x] OnboardingPage Step 2 输入反馈显示"{名字}，真好听的名字！"
- [x] OnboardingPage Step 2 placeholder 显示"请输入宝宝的名字"
- [x] OnboardingPage Step 3/4/5 文案使用"小朋友"称呼

## 进度圆点与 URL 参数
- [x] OnboardingPage 顶部显示 6 个进度圆点
- [x] 当前步骤圆点放大 + 脉冲动画
- [x] 已完成步骤填充暖橙，未完成灰色
- [x] 访问 `/onboarding?step=6&child_id=N` 直接进入 Step 6
- [x] Step 6 时返回按钮禁用

## Step 5 跳转问卷
- [x] Step 5 点击"准备好了，开始！"后创建儿童档案
- [x] 跳转 URL 包含 `stage=register&level=Lx&child_id=N&return=onboarding`

## Step 6 雷达图
- [x] Step 6 显示 IP 头像（proud 表情）+ 气泡"这是小朋友的能力小档案~"
- [x] Step 6 调用 getChildScores 加载能力得分
- [x] 雷达图正确渲染 6 维能力（暖橙填充 + 描边 + 数据点）
- [x] 能力分数加载中显示"加载中..."占位

## Step 6 阶段目标设置
- [x] 显示日期区间选择器（默认今天起 30 天）
- [x] 显示 6 个能力维度列表，可勾选
- [x] 勾选维度后可选择目标分（10/20/30/40/50/60/80/100）
- [x] 未选时间区间或未勾选维度时 Toast 提示
- [x] 保存成功调用 createCycle + setGoal
- [x] 保存成功后隐藏目标设置卡片

## Step 6 生成任务
- [x] 目标保存后显示"点击生成任务"按钮
- [x] 点击后调用 generateAITasks
- [x] 生成中按钮显示"小萌芽正在设计任务..."
- [x] 生成成功展示任务列表（标题 + 积分）
- [x] 生成失败 Toast 提示并允许重试
- [x] 任务列表非空时底部显示"进入成长主页"按钮

## 问卷页跳转分支
- [x] 问卷 URL 含 return=onboarding 时提交后跳回 `/onboarding?step=6&child_id=N`
- [x] 问卷 URL 不含 return=onboarding 时维持原逻辑（Toast + 1.5s 跳 /growth）

## 编译验证
- [x] `npx tsc --noEmit` 通过（exit code 0，无类型错误）
