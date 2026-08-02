# GrowPocket V3.1 长期增长优化 Spec

> **来源**：基于 `.trae/documents/growpocket-v3.1-four-modules-prd.md`（已评审通过）
> **前置版本**：`.trae/specs/growpocket-v3/spec.md`（v3，已完成）
> **变更性质**：结构性优化——解决 v3 上线后暴露的 4 条裂缝（能力增长过快、满分后无玩法、任务生成失控、学业场景缺失）

## Why

v3 版本上线后，通过 4 轮产品哲学探讨发现 4 条结构性裂缝：
1. 6 维能力 0-100 线性齐头并进，一年就可能全满分——**反儿童发展规律**
2. 全满分后系统进入"稳态无趣"，没有新成长叙事——**用户流失风险**
3. 每日 AI 任务生成 100% 纯 Prompt，模板库完全没用上——**越级/重复/离谱任务频发**
4. 6 维缺少学业/成绩/作业场景，但直接做第 7 维会把产品做成应试工具——**学业场景缺失**

V3.1 通过 4 个彼此独立、可分阶段上线的模块解决这 4 条裂缝，推荐上线顺序 A→C→D→B。

## What Changes

### 模块 A：分阶段能力增长（年级·维度权重矩阵 + Cap 锁）
- **新增** `GradeDimensionGuide` 模型（6 年级 × 6 维 = 36 行矩阵：weight/cap/focus_level）
- **修改** `ChildAbilityScore` 新增 3 字段（consecutive_cycles_on_track / hard_tasks_completed / mastery_stars，为模块 B 预留）
- **修改** `ability_service.go::AddScoreForDimension` 新增问卷基线压低过滤器（蓄势维基线不超过年级 Cap）
- **修改** `ability_service.go::ReassessScores` 新增 Prompt 注入年级规则 + 后处理硬 clamp 双保险
- **修改** `task_generation_service.go::GenerateTasksForChild` 新增蓄势维探索配额（7 天 1 次）
- **修改** `children handler enrichChild` 派生字段新增 focus_level / cap / mastery_ready
- **修改** `GrowthPage.tsx` 雷达图加「🌟 本阶段重点」徽标 + 精通进度提示 + 蓄势「🔒 成长中」说明 + 专家模式开关

### 模块 C：任务生成三段式混合（RAG 召回 × LLM 扩写 × 规则守门员）
- **修改** `task_generation_service.go::GenerateTasksForChild` 完全重写为三段式：① 从 TaskTemplate 按年级主轴/适龄/去重召回 top 20 → ② LLM 从候选选 2 条 + 自造 1 条 → ③ 规则守门员硬检查（适龄/积分/维度/相似度/黑名单词）
- **修改** `Task` 模型新增 `RuleSanitized BOOL` 字段
- **保留** 现有 TaskTemplate 表 + task_recommend_service 不变（两条腿融合，不互斥）

### 模块 D：学业模块双层结构（学业奖励池 × 学业趋势子指标）
- **新增** `AcademicMilestone` 模型（学业奖励池：作业/进步/荣誉/里程碑 4 大类，每月 3 次上限，单次 200 积分上限）
- **新增** `AcademicTrendEntry` 模型（学业趋势档位：作业/测验/期中期末/自主时长，只存 A+/A/B/C 档不存具体分）
- **新增** `academic_service.go`（RecordMilestone + 限额守卫 + 趋势查询）
- **修改** `ability_service.go::ReassessScores` Prompt 新增学业趋势软参考（不加硬 delta）
- **修改** `transaction.go` 白名单新增 `"academic"` 类型 + 禁止"考试满分奖励"类 Reason
- **修改** `task_generation_service.go` 召回阶段：作业档 C/B 时学习认知模板偏重错题订正类
- **新增** 前端 `AcademicMilestoneModal` 组件 + 学习认知详情面板 4 条趋势折线 + 成就墙学业 tab
- **不新增第 7 个能力维度**（6 维保持不变）

### 模块 B：能力进阶后玩法（大师挑战 PBL × 精通熟练度 5 星）
- **新增** 4 个模型：MasterChallengeTemplate / MasterChallengeInstance / MasterChallengeStage / MasterChallengeSubmission
- **修改** `GrowthStory` 新增 type('cycle'|'project') + master_challenge_instance_id
- **新增** `master_challenge_service.go`（GenerateStages + 阶段打卡 + 验收 + 发奖励）
- **新增** `growth_story_service.go::GenerateProjectStory` 分支
- **新增** `ability_service.go::AwardMasteryStar` + ReassessScores 后星数重算
- **修改** `GrowthPage.tsx` 大师挑战横幅 + 精通徽章体系 + 全精通金色六边形 + 头像框
- **修改** `GrowthStoryListPage.tsx` segment 筛选「全部/阶段回顾/大师挑战」
- **修改** 能力详情面板 5 档等级 icon + 精通星环 + 专家模式
- **新增** 30 条大师挑战模板 seed（4 大类 × L1~L5 分档）

## Impact

- **Affected specs**：
  - `.trae/specs/growpocket-v3/spec.md`（v3 能力维度系统、AI 任务生成、成长模块）
  - `.trae/specs/community-module/spec.md`（成长故事分享类型扩展）
- **Affected code**：
  - 后端模型：新增 `grade_dimension_guide.go` / `academic_milestone.go` / `academic_trend_entry.go` / `master_challenge_*.go`，修改 `child_ability_score.go` / `task.go` / `growth_story.go` / `transaction.go`
  - 后端服务：修改 `ability_service.go` / `task_generation_service.go` / `growth_story_service.go`，新建 `academic_service.go` / `master_challenge_service.go`
  - 后端数据：`database.go` AutoMigrate + seed 矩阵/模板/学业事件
  - 后端 handler：`children.go` 派生字段、新建 academic/master_challenge handler
  - 前端：`GrowthPage.tsx` / `GrowthStoryListPage.tsx` / `TaskListPage.tsx` / `AchievementListPage.tsx` / 能力详情面板
  - 前端新增：`MasterChallengePoolPage` / `MasterChallengeDetailPage` / `AcademicMilestoneModal`

## ADDED Requirements

### Requirement: 分阶段能力增长（模块 A）
系统 SHALL 按 6 个年级 × 6 个能力维度维护一个发展矩阵（weight/cap/focus_level），在问卷基线、AI 阶段评定、任务生成三个环节施加年级约束，确保能力增长贴合 6-12 岁儿童发展规律。

#### Scenario: 一年级问卷基线压低
- **WHEN** 一年级孩子完成注册问卷，社交情感部分全部选 A
- **THEN** 社交情感维度基线不超过 30 分（蓄势维 Cap=35 的 85%）

#### Scenario: AI 评定被硬 clamp
- **WHEN** AI 在阶段回顾中对一年级孩子的独立自主维度返回 90 分
- **THEN** 系统硬 clamp 到 40 分（一年级独立自主 Cap=40），并记录 DEVELOPMENT_CAP_APPLIED 日志

#### Scenario: 蓄势维任务配额
- **WHEN** 一年级孩子的每日任务生成
- **THEN** 7 天内蓄势维（独立自主/社交情感）任务出现次数 ≤ 1

### Requirement: 任务生成三段式混合（模块 C）
系统 SHALL 将每日 AI 任务生成从纯 Prompt 改为 RAG 召回 + LLM 扩写 + 规则守门员三段式，保证至少 66% 任务来自质量受控的模板库。

#### Scenario: 召回去重
- **WHEN** 近 7 天已有标题"跳绳 100 下"的任务
- **THEN** 召回阶段排除该模板（Jaccard 相似度 >0.4）

#### Scenario: 守门员积分 clamp
- **WHEN** AI 返回 easy 难度任务积分 300
- **THEN** 守门员 clamp 到 50（easy 上限）

#### Scenario: 蓄势维 hard 降级
- **WHEN** 一年级"社交情感"hard 模板被 AI 选中
- **THEN** 守门员降级为 easy 或丢弃重取

### Requirement: 学业模块双层结构（模块 D）
系统 SHALL 提供学业趋势子指标（只存档位不存分数）和学业奖励池（独立积分白名单 + 限额），不新增第 7 个能力维度，不将考试分数直接加到能力分上。

#### Scenario: 一年级只解锁作业习惯类
- **WHEN** 一年级家长点击「📚 录好事」
- **THEN** 只显示作业习惯类事件（连续 7 天/14 天），不显示进步/荣誉/里程碑类

#### Scenario: 每月限额
- **WHEN** 本月已录入 3 次学业里程碑
- **THEN** 第 4 次被拦截并提示「本月最多再录 0 次」

#### Scenario: 禁止满分奖励关键词
- **WHEN** Reason 中包含"考 100 分奖励"
- **THEN** Transaction BeforeCreate 拒绝写入

### Requirement: 能力进阶后玩法（模块 B）
系统 SHALL 在能力达到精通（≥95）后，将展示从"0-100 数值"切换为"5 档等级 + 精通 5 星熟练度"，并解锁大师挑战 PBL 项目，提供满级后的新成长叙事。

#### Scenario: 精通等级展示
- **WHEN** 某维度分数达到 95
- **THEN** 雷达图该维数值条消失，替换为 ⭐ 精通 icon + 1 星

#### Scenario: 大师挑战解锁
- **WHEN** 孩子 ≥3 项精通
- **THEN** GrowthPage 顶部出现大师挑战横幅，解锁家庭共创/创造表达类模板

#### Scenario: 全精通金色徽章
- **WHEN** 6 维全部精通 + 每维 ≥⭐⭐
- **THEN** 雷达图变金色描边正六边形 + 外圈 30 颗星星环 + 头像框升级金色藤叶 + 获得「小萌芽成长大师」徽章

## MODIFIED Requirements

### Requirement: 能力维度评定（v3 原有）
v3 中 `ReassessScores` 对 6 维完全平权评定。V3.1 修改为：AI Prompt 中注入年级主轴/次轴/蓄势分类 + 各维 Cap 值；后处理增加硬 clamp 双保险；蓄势维即使任务多也只能 +0~+2。

### Requirement: AI 每日任务生成（v3 原有）
v3 中 `GenerateTasksForChild` 100% 纯 Prompt 生成。V3.1 修改为三段式：RAG 召回 top 20 候选 → LLM 选 2 造 1 → 规则守门员硬检查后入库。

### Requirement: 成长指数展示（v3 原有）
v3 中成长指数 = 6 维平均分，直接显示数字。V3.1 修改为：<95 显示数字，≥95 替换为精通徽章体系（单项/三项/全面/小萌芽成长大师）。
