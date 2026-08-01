# Tasks

- [x] Task 1: OnboardingPage Step 2 文案明确化（儿童姓名）
  - [x] SubTask 1.1: IP 气泡文案改为"小朋友叫什么名字呀？"，输入反馈改为"{名字}，真好听的名字！"
  - [x] SubTask 1.2: placeholder 改为"请输入宝宝的名字"
  - [x] SubTask 1.3: Step 3/4/5 文案统一改为"小朋友"称呼，避免歧义

- [x] Task 2: OnboardingPage 顶部进度圆点 5→6 + URL 参数支持
  - [x] SubTask 2.1: 进度圆点数组从 [1,2,3,4,5] 改为 [1,2,3,4,5,6]
  - [x] SubTask 2.2: 支持 `?step=6&child_id=N` URL 参数，initialStep 根据参数初始化
  - [x] SubTask 2.3: step===6 时返回按钮禁用（不可返回 Step 1-5）

- [x] Task 3: OnboardingPage Step 5 跳转问卷增加 return 参数
  - [x] SubTask 3.1: handleStartQuestionnaire 跳转 URL 增加 `&return=onboarding`

- [x] Task 4: OnboardingPage 新增 Step 6（雷达图 + 目标设置 + 任务生成）
  - [x] SubTask 4.1: 新增状态：scores、dimensions、setupStartDate、setupEndDate、setupGoals、goalSaved、generatedTasks
  - [x] SubTask 4.2: 内联 RadarChartSVG 组件（暖橙填充色，复用 GrowthPage 实现）
  - [x] SubTask 4.3: Step 6 useEffect 加载 getChildScores + getAbilities，默认日期区间今天起 30 天
  - [x] SubTask 4.4: 6A 雷达图展示区（IP 头像 + 气泡 + RadarChartSVG）
  - [x] SubTask 4.5: 6B 阶段目标设置（日期区间 + 维度勾选 + 目标分下拉 + 保存按钮）
  - [x] SubTask 4.6: 6C 任务生成（保存目标后显示生成按钮 + 调用 generateAITasks + 任务列表展示）
  - [x] SubTask 4.7: 底部按钮区：step===6 且 goalSaved 且 tasks.length>0 时显示"进入成长主页"

- [x] Task 5: QuestionnairePage handleSubmit 跳转分支
  - [x] SubTask 5.1: 检测 `return=onboarding` 参数
  - [x] SubTask 5.2: 是 → `navigate('/onboarding?step=6&child_id=N', { replace: true })`
  - [x] SubTask 5.3: 否 → 维持原逻辑（Toast 积分 + 1.5s 后跳 /growth）

- [x] Task 6: 编译验证
  - [x] SubTask 6.1: `npx tsc --noEmit` 通过（exit code 0）

# Task Dependencies
- Task 4 依赖 Task 2（进度圆点和 URL 参数支持需先就位）
- Task 5 独立，可与 Task 4 并行
- Task 6 依赖所有任务完成
