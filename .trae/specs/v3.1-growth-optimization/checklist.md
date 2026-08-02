# Checklist

## 模块 A：分阶段能力增长

- [x] `grade_dimension_guide` 表 36 行矩阵数据（6 年级 × 6 维）正确 seed 且可查询
- [x] 一年级问卷基线：社交情感维度即使满分，也 ≤30 分
- [x] 一年级问卷基线：独立自主维度 ≤40 分
- [x] `ReassessScores` prompt 中包含主轴/次轴/蓄势 & Cap 文字
- [x] `ReassessScores` 后处理：蓄势维即使 AI 返回 90，最终保存被 clamp 回 Cap
- [x] 一年级阶段回顾里，社交情感 AI delta 最大不超过 +2
- [x] 每日任务生成：一年级孩子 7 天里蓄势维任务出现次数 ≤1
- [x] 前端：雷达图主轴维显示「🌟 本阶段重点」徽标
- [x] 能力详情页：蓄势维有「🔒 成长中」图标 + 小问号小贴士
- [x] 能力详情页：顶部"本阶段可冲刺精通：X/6"数字正确（1 年级 = 3/6）
- [x] ChildAbilityScore 响应里含 `focus_level / cap / mastery_ready` 派生字段
- [x] 全精通不可能在 3 年级前发生：3 年级前 Cap 叠加的理论最高 6 维平均分 ≤75
- [x] 跨学年（9/1）：grade 滚动后矩阵 grade 也切换
- [x] AI 调用失败时 fallback 仍执行 clamp

## 模块 C：任务生成三段式

- [x] GenerateTasksForChild 走"召回 30→20 + LLM + 守门员"流程
- [x] 召回阶段：一年级蓄势维模板 ≤2 条进入 top 20
- [x] 召回阶段：近 7 天 Jaccard >0.4 标题的模板被排除
- [x] LLM Prompt 明确"从候选选 2 条 + 自造 1 条"
- [x] 守门员：hard 300 分被 clamp 到 200
- [x] 守门员：Jaccard >0.6 时自动顶替为召回池下一条
- [x] 守门员：标题长度 <4 或 >30 丢弃 / 黑名单词丢弃
- [x] dimension_id 不在 1~6 时 fallback 到最弱维度
- [x] 蓄势维 hard 任务降级为 easy
- [x] 每日 08:00 scheduler 不中断 + hasTodayAITask 幂等不冲突
- [x] JSON 解析失败 3 次 fallback 到召回 top 3

## 模块 D：学业双层

- [x] 没新增第 7 个 AbilityDimension（6 维仍 6 条）
- [x] academic_trend_entry 只存 A+/A/B/C 4 档不存具体分
- [x] academic_milestone 存 4 大类 + 发生日期 + 附件图 1~3 张
- [x] RecordMilestone 每月 3 次上限：第 4 次被拦
- [x] RecordMilestone 单次积分上限 200：500 被切 200
- [x] RelatedType='academic' 进 Transaction 白名单
- [x] Reason 含"考 100 分奖励"被 BeforeCreate 拒绝
- [x] 一年级 UI：只显示作业习惯类，不显示进步/荣誉/里程碑类
- [x] 2 年级 UI：新增"单元练习全对"（每月最多 1 次）
- [x] 录入进步类里程碑后不直接加学习认知能力分
- [x] ReassessScores Prompt 中出现学业趋势软参考语句
- [x] 作业档 C/B 时学习认知召回模板偏重错题订正类 ≥30%
- [x] 成长故事学业章节不写具体分数

## 模块 B：能力进阶后玩法

- [x] MasterChallengeTemplate ≥30 条 L1~L5 分档模板已 seed
- [x] 大师挑战第 1 档触发：二年级末或 2 项≥熟练自动赠送 L1 项目
- [x] 大师挑战第 2 档触发：≥3 项精通解锁家庭共创/创造表达类
- [x] GenerateStages：L1 阶段数固定 3，AI 给 4 个时 fallback
- [x] 家长验收 3 维打分，2 星以下不发奖励
- [x] 验收通过：稀有积分入库 + mastery_stars +1（不超 5）
- [x] GrowthStory.type='project' 专题故事可生成并展示
- [x] 成长故事列表 segment「全部/阶段回顾/大师挑战」筛选正确
- [x] 5 档等级：94 分显示 🌻、95 分显示 ⭐
- [x] 精通 5 星：⭐⭐⭐⭐⭐ 必须含"大师挑战 primary dim"条件
- [x] 成长指数 <95 显示数字，≥95 替换精通徽章
- [x] 全精通：金色描边六边形 + 30 颗星星环 + 头像框升级
- [x] 专家模式：关闭显示等级+星，开启显示 0-100 分 + 明细
- [x] 未精通用户 GrowthPage 不显示大师挑战横幅

## 全局回归

- [x] `go build ./...` 通过
- [x] `tsc --noEmit` 通过
- [x] `vitest run` 现有单元测试不回退
- [x] 全量删库后重新注册：birthday 必填、grade 推算正确、A 矩阵规则生效
  - birthday=2019-08-15 → derived_grade=1 / derived_age=6；A 矩阵派生字段：生活自理/学习认知/身心健康 primary cap=100，动手实践 secondary cap=80，独立自主 latent cap=40，社交情感 latent cap=35；balance=0 无积分发放
- [x] Transaction 白名单守卫：onboarding/问卷奖励/新手指引关键词 Reason 仍被拒绝
  - 修复 BeforeCreate GORM hook 签名 bug（原 `interface{ Error(...) }` 不被 GORM 调用，改为 `*gorm.DB`）
  - 禁止关键词 Reason（新手指引奖励/问卷奖励/考试满分奖励）均被拒；RelatedType=academic 合法路径成功；1 年级 progress 被年级解锁拦截；学业积分 500 被 clamp 到 200；流水历史只含 3 条合法记录，被拒记录未入库
- [x] FamilySettingsPage 新加孩子走 Onboarding?mode=add_child 仍完整可用
  - 浏览器端到端验证：家庭管理点+跳转 /onboarding?mode=add_child；走完 Onboarding 全流程 mode 参数保留；最终跳回 /settings/family；孩子列表含小明(1年级)+小红(2年级手动覆盖)；A 矩阵主轴随年级切换（1年级学习认知主轴→2年级动手实践主轴）
