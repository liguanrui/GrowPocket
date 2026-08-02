# Tasks

> 基于 V3.1 PRD 的 4 大模块，按依赖关系排序。推荐上线顺序：第 1 期 A+C → 第 2 期 D → 第 3 期 B。

## 第 1 期：模块 A + 模块 C（MVP）

### 模块 A：分阶段能力增长

- [x] Task A1: 数据模型与矩阵 Seed
  - [x] SubTask A1.1: 新增 `backend/internal/model/grade_dimension_guide.go`（GradeDimensionGuide 模型：grade/dimension_id/weight/cap/focus_level）
  - [x] SubTask A1.2: 修改 `backend/internal/model/child_ability_score.go` 新增 3 字段（consecutive_cycles_on_track / hard_tasks_completed / mastery_stars）
  - [x] SubTask A1.3: 在 `backend/internal/database/database.go` AutoMigrate 注册 GradeDimensionGuide
  - [x] SubTask A1.4: 在 `database.go` 新增 `seedGradeDimensionGuides(db)` 函数，seed 36 行矩阵数据（6 年级 × 6 维，含 weight/cap/focus_level）
  - **验证**：启动后端，`grade_dimension_guides` 表存在且 36 行数据可查询

- [x] Task A2: 问卷基线压低过滤器
  - [x] SubTask A2.1: 在 `backend/internal/service/ability_service.go` 新增 `GetGradeGuide(grade, dimID)` 查询函数
  - [x] SubTask A2.2: 修改 `AddScoreForDimension`，蓄势维基线 delta 压低到不超过年级 Cap 的 85%
  - **验证**：一年级问卷社交情感全部选 A，基线 ≤30 分

- [x] Task A3: ReassessScores 年级规则注入 + 硬 clamp
  - [x] SubTask A3.1: 修改 `ReassessScores` 的 AI Prompt，新增 3 段话：主轴/次轴/蓄势分类 + 各维 Cap 值 + 加分幅度引导
  - [x] SubTask A3.2: 在 AI 返回后新增 `ClampWithDevelopmentalCap(grade, dimID, newScore)` 硬 clamp 后处理
  - [x] SubTask A3.3: clamp 触发时记录 `DEVELOPMENT_CAP_APPLIED` 结构化日志
  - **验证**：AI 返回一年级社交情感 90 分，最终保存被 clamp 到 35

- [x] Task A4: children handler 派生字段
  - [x] SubTask A4.1: 修改 `backend/internal/handler/children.go::enrichChild`，根据当前 grade 查矩阵，为每个维度响应追加 `focus_level / cap / mastery_ready` 派生字段
  - **验证**：GET /api/children 响应中每个维度含 focus_level 和 cap

- [x] Task A5: 任务生成蓄势维探索配额
  - [x] SubTask A5.1: 修改 `task_generation_service.go::GenerateTasksForChild`，统计近 7 天蓄势维任务数，超过 1 次则不再生成蓄势维任务
  - **验证**：一年级孩子 7 天内蓄势维任务 ≤1 次

- [x] Task A6: GrowthPage 前端 UI
  - [x] SubTask A6.1: 雷达图主轴维角上加「🌟 本阶段重点」徽标
  - [x] SubTask A6.2: 能力详情页顶部加「本阶段可冲刺精通：X/6 项」进度提示
  - [x] SubTask A6.3: 蓄势维详情页加「🔒 成长中」图标 + 问号小贴士（100 字儿童发展说明）
  - [x] SubTask A6.4: 能力详情页加「专家模式」开关（默认关，开启后显示原始 0-100 分）
  - **验证**：1 年级雷达图显示 3 个主轴徽标，4 年级显示不同的主轴

### 模块 C：任务生成三段式混合

- [x] Task C1: Task 模型 + 召回阶段
  - [x] SubTask C1.1: 修改 `backend/internal/model/task.go` 新增 `RuleSanitized BOOL` 字段
  - [x] SubTask C1.2: 在 `task_generation_service.go` 新增 `recallCandidateTemplates(child, grade, scores, recentTasks)` 函数：从 TaskTemplate 按年级主轴/适龄/去重召回 top 20
  - [x] SubTask C1.3: 实现 Jaccard 相似度去重函数（近 7 天标题相似度 >0.4 排除）
  - **验证**：构造同名任务 case，召回阶段正确排除

- [x] Task C2: 三段式 Prompt + 守门员
  - [x] SubTask C2.1: 重写 `buildGenerationPrompt`，注入 20 条候选模板 + 近 14 天已完成任务 + 年级主轴重点 + 蓄势维限制
  - [x] SubTask C2.2: 新增 `sanitizeTaskSuggestion(task, grade, recentTasks, candidates)` 守门员函数：适龄 clamp / 积分 clamp / 维度白名单 / Jaccard 顶替 / 标题长度 + 黑名单词
  - [x] SubTask C2.3: 重写 `GenerateTasksForChild` 主流程为：召回 → Prompt → LLM → 守门员 → 写库（RuleSanitized=true）
  - [x] SubTask C2.4: JSON 解析失败 3 次 fallback：直接从召回 top 3 出任务
  - **验证**：hard 300 分被 clamp 到 200；dimension_id=999 fallback 到最弱维度

- [x] Task C3: 结构化日志 + 回归
  - [x] SubTask C3.1: `GenerateTasksForChild` 末尾输出结构化日志（召回 30→20、LLM 返回 3、守门员丢弃/顶替了哪些）
  - [x] SubTask C3.2: 确保每日 08:00 scheduler 调用不变 + hasTodayAITask 幂等逻辑不冲突
  - **验证**：go build 通过，日志可见召回数据，scheduler 不中断

## 第 2 期：模块 D（学业双层）

- [x] Task D1: 学业数据模型
  - [x] SubTask D1.1: 新增 `backend/internal/model/academic_milestone.go`（学业奖励池：type/occurred_at/description/points_awarded/parent_note/attachments）
  - [x] SubTask D1.2: 新增 `backend/internal/model/academic_trend_entry.go`（学业趋势：subject/metric_type/value_abc/occurred_week）
  - [x] SubTask D1.3: 在 `database.go` AutoMigrate 注册两个新模型
  - **验证**：两个新表正确创建

- [x] Task D2: 学业服务 + 积分守卫
  - [x] SubTask D2.1: 新建 `backend/internal/service/academic_service.go`，实现 `RecordMilestone`（含每月 3 次上限 + 单次 200 积分上限守卫）
  - [x] SubTask D2.2: `RecordMilestone` 内部调积分发放（RelatedType='academic'）
  - [x] SubTask D2.3: 修改 `backend/internal/model/transaction.go` 白名单新增 `"academic"` + 禁止关键词加"考试满分奖励/期末满分奖励"
  - **验证**：第 4 次/月被拦；500 积分被切 200；禁止词 Reason 被拒

- [x] Task D3: 年级解锁规则 + AI 协同
  - [x] SubTask D3.1: 在 `academic_service.go` 实现年级事件类型解锁规则（1 年级仅作业习惯类，2 年级加单元练习全对，3 年级加进步类...）
  - [x] SubTask D3.2: 修改 `ability_service.go::ReassessScores` Prompt，注入学业趋势软参考语句
  - [x] SubTask D3.3: 修改 `task_generation_service.go` 召回：作业档 C/B 时学习认知模板偏重错题订正类
  - **验证**：一年级 UI 不显示进步/荣誉类入口；ReassessScores Prompt 含趋势语句

- [x] Task D4: 学业前端
  - [x] SubTask D4.1: 新增 `AcademicMilestoneModal` 组件（📚 录好事弹窗，按年级过滤事件类型）
  - [x] SubTask D4.2: 学习认知详情面板新增 4 条趋势折线（最近 6 次）+ 里程碑历史列表
  - [x] SubTask D4.3: `AchievementListPage` 新增「学业成就」tab
  - **验证**：录入进步类里程碑后 6 维分数不变；趋势折线正常绘制

## 第 3 期：模块 B（能力进阶后玩法）

- [x] Task B1: 大师挑战数据模型
  - [x] SubTask B1.1: 新增 4 个模型文件：`master_challenge_template.go` / `master_challenge_instance.go` / `master_challenge_stage.go` / `master_challenge_submission.go`
  - [x] SubTask B1.2: 修改 `growth_story.go` 新增 type('cycle'|'project') + master_challenge_instance_id
  - [x] SubTask B1.3: 在 `database.go` AutoMigrate 注册 4 个新模型 + seed 30 条大师挑战模板
  - **验证**：4 个新表创建，30 条模板可查询

- [x] Task B2: 大师挑战后端服务
  - [x] SubTask B2.1: 新建 `master_challenge_service.go`：GenerateStages（AI 拆阶段 + 数量硬约束 fallback）+ 阶段打卡 + 验收（3 维打分 ≥2 星通过）+ 发奖励（稀有积分 + mastery_stars +1）
  - [x] SubTask B2.2: 新增 `growth_story_service.go::GenerateProjectStory` 分支
  - [x] SubTask B2.3: 新增 `ability_service.go::AwardMasteryStar`（ReassessScores 后星数重算逻辑为模块 B 后续优化预留）
  - [x] SubTask B2.4: 新建 handler + 在 main.go 注册路由
  - **验证**：L1 阶段数固定 3；验收 2 星以下不发奖励；mastery_stars +1 不超 5

- [x] Task B3: 精通等级 + 5 星展示
  - [x] SubTask B3.1: 前端 ability service 接口新增 mastery_stars 可选字段 + fallback
  - [x] SubTask B3.2: 前端雷达图 5 档等级 icon 替换数值 + 精通星环（≥1 项精通时外圈 6 组 5 星点）
  - [x] SubTask B3.3: 成长指数 <95 显示数字，≥95 替换精通徽章（单项/三项/全面/小萌芽成长大师）
  - [x] SubTask B3.4: 全精通金色描边正六边形 + 头像框金色藤叶
  - **验证**：94 分显示 🌻、95 分显示 ⭐；全精通金色六边形 + 星环

- [x] Task B4: 大师挑战前端
  - [x] SubTask B4.1: 新增 `MasterChallengePoolPage`（挑战池列表，按年级过滤）
  - [x] SubTask B4.2: 新增 `MasterChallengeDetailPage`（阶段打卡 + 提交 + 验收）
  - [x] SubTask B4.3: `GrowthPage` 顶部加大师挑战横幅（≥1 项精通时显示）
  - [x] SubTask B4.4: `GrowthStoryListPage` 加 segment「全部/阶段回顾/大师挑战」
  - **验证**：未精通用户不显示横幅；segment 筛选正确

## 全局回归

- [x] Task V1: 编译与测试
  - [x] SubTask V1.1: `go build ./...` 通过
  - [x] SubTask V1.2: `tsc --noEmit` 通过
  - [x] SubTask V1.3: `vitest run` 所有现有单元测试不回退
  - [x] SubTask V1.4: 全量删库后重新注册，birthday 必填、grade 推算正确、A 矩阵规则生效
  - [x] SubTask V1.5: Transaction 白名单守卫验证（onboarding/问卷奖励/新手指引关键词 Reason 被拒）
  - [x] SubTask V1.6: FamilySettingsPage 新加孩子走 Onboarding?mode=add_child 端到端验证

# Task Dependencies

- Task A2 依赖 Task A1（矩阵数据）
- Task A3 依赖 Task A1（矩阵数据）
- Task A5 依赖 Task A3（Cap 规则）
- Task C1 依赖 Task A1（年级主轴/蓄势分类用于召回过滤）
- Task C2 依赖 Task C1（召回函数）
- Task C3 依赖 Task C2
- Task D2 依赖 Task D1（模型）
- Task D3 依赖 Task A3（ReassessScores 改造）+ Task C1（召回改造）
- Task D4 依赖 Task D2 + Task D3
- Task B1 依赖 Task A1（ChildAbilityScore 新字段已就绪）
- Task B2 依赖 Task B1
- Task B3 依赖 Task B2（AwardMasteryStar）
- Task B4 依赖 Task B2 + Task B3

## 可并行任务

- Task A（模块 A）与 Task C（模块 C）可部分并行（C 的召回依赖 A 的矩阵数据，但召回函数可先用 hardcode 矩阵开发）
- Task D（模块 D）的模型层（D1）可与 Task C 并行
- Task B（模块 B）的视觉资源制作可与后端 B1/B2 并行
