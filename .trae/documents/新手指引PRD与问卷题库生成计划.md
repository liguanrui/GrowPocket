# 新手指引 PRD 与问卷题库生成计划

> 用户决策：独立 Onboarding 流程页 + 按年级+年龄组合分6档。本阶段**只生成 PRD 文档和问卷题库文档，不改代码**。

## 目标产出

两个文档：
1. **新手指引 PRD 文档**：`.trae/documents/新手指引Onboarding-PRD.md`
2. **问卷题库文档**：`.trae/documents/问卷题库-分龄6档.md`

## Phase 1 探索结论（已完成的现状分析）

### 当前注册→录入→问卷链路
- `RegisterPage.tsx` 注册成功 → `navigate('/settings/family')`
- `FamilySettingsPage.tsx` 无儿童时显示 IPPAvatar 引导卡片 → ChildForm（仅 nickname/birthday/gender）→ `navigate('/questionnaire?stage=register&child_id=...')`
- `QuestionnairePage.tsx` 加载 register 问卷（仅 6 题，所有儿童同一份）→ 提交 → `/growth`

### 关键工程债
- Child 模型字段缺失：无年级(grade)、爱好(hobbies)字段
- 问卷不分龄：仅按 stage(register/weekly/review) 区分，register 固定 6 题
- 问卷数据结构：`Questionnaire.Questions` 为 JSON 字符串，无独立 Question 表
- "游戏化地图"只是普通进度条，无关卡节点
- birthday 格式不匹配：前端 `YYYY-MM-DD` vs 后端 `time.RFC3339`

### IP 形象现状
- `IPPAvatar.tsx`：5 阶段（seed/sprout/seedling/tree/bigtree）× 6 表情（happy/encourage/think/surprised/comfort/proud）
- 动画仅 `animate-bounce`，无过渡动画

### 6 档分龄设计（本计划核心）
| 档位 | 年级 | 年龄段 | 标签 |
|------|------|--------|------|
| L1 | 一年级 | 6-7岁 | 启蒙期 |
| L2 | 二年级 | 7-8岁 | 萌芽期 |
| L3 | 三年级 | 8-9岁 | 探索期 |
| L4 | 四年级 | 9-10岁 | 成长期 |
| L5 | 五年级 | 10-11岁 | 进阶期 |
| L6 | 六年级 | 11-12岁 | 飞跃期 |

每档 15-20 题，覆盖 6 个能力维度（生活自理/独立自主/动手实践/学习认知/社交情感/身心健康），题库总量约 100-120 题。

---

## 产出文档 1：新手指引 Onboarding PRD

**文件**：`.trae/documents/新手指引Onboarding-PRD.md`

### PRD 结构
1. **背景与目标**：注册成功后的强交互游戏化引导，IP「小萌芽」全程陪伴
2. **用户流程图**：注册成功 → Onboarding欢迎页 → 5步信息收集 → 问卷 → 进入主App
3. **Onboarding 5 步设计**（每步一个全屏场景，IP 互动）：
   - Step 1 欢迎页：IP 种子破土动画 + 自我介绍「我是小萌芽，陪你一起成长！」
   - Step 2 姓名收集：IP 提问「你叫什么名字呀？」+ 输入框 + IP 鼓励反馈
   - Step 3 年龄年级收集：IP 选择「你几岁啦？上几年级？」+ 年龄滑块/年级按钮，**用于匹配问卷档位**
   - Step 4 爱好收集：IP「你喜欢做什么？」+ 多选标签（运动/阅读/绘画/音乐/拼搭/自然观察等）+ 影响后续任务生成
   - Step 5 问卷预告：IP「我还想多了解你一点，大概 N 题，每题都有进度提示，可以返回修改哦」→ 进入问卷
4. **交互规范**：
   - 每步 IP 表情联动（think/encourage/proud）
   - 进度条（顶部 5 圆点）
   - 允许返回上一步修改
   - 按钮 press-effect、cardEnter 入场动画
5. **问卷页增强**：
   - 提前告知总题数
   - 每题进度提示「第 X/N 题 · 进度 XX%」
   - 允许返回修改答案（上一题按钮）
   - 游戏化进度：关卡节点路径（非普通进度条）
6. **数据模型扩展**（规划，不改代码）：
   - Child 新增 `grade`（1-6）、`hobbies`（JSON 数组）、`age`（由 birthday 计算）
   - Questionnaire 新增 `level`（L1-L6）字段，按档位区分
7. **问卷匹配逻辑**：根据年级→档位映射，拉取对应 level 问卷

---

## 产出文档 2：问卷题库-分龄6档

**文件**：`.trae/documents/问卷题库-分龄6档.md`

### 题库结构
- 6 档（L1-L6）× 每档 15-20 题 × 6 能力维度
- 每题结构：`{ id, dimension_id, question, options:[{text, score}] }`
- 题目内容按年龄认知水平差异化：
  - L1-L2（6-8岁）：简单具体行为（如"你会自己系鞋带吗？"）
  - L3-L4（8-10岁）：日常习惯+初步社交（如"遇到不会的题会怎么做？"）
  - L5-L6（10-12岁）：复杂情境+自主决策（如"和朋友意见不合时怎么办？"）

### 6 能力维度（沿用现有）
1. 生活自理（dimID=1）
2. 独立自主（dimID=2）
3. 动手实践（dimID=3）
4. 学习认知（dimID=4）
5. 社交情感（dimID=5）
6. 身心健康（dimID=6）

### 题目设计原则
- 每维度每档 2-3 题，保证均衡
- 选项 3 个，分值 5/3/1
- 题干贴合该年龄段儿童生活场景
- 语言难度适配（低年级口语化，高年级可抽象）

### 文档格式
每档一个章节，列出题目 JSON 数组，可直接用于后续种子数据初始化。

---

## 执行步骤

1. 写 `.trae/documents/新手指引Onboarding-PRD.md`（完整 PRD，含流程图、5步设计、交互规范、数据模型规划、问卷匹配逻辑）
2. 写 `.trae/documents/问卷题库-分龄6档.md`（6档完整题库，每档15-20题，JSON格式可直接复用）

## 不做的事
- 不改任何代码（前端/后端/模型/路由）
- 不创建种子数据文件
- 不修改现有问卷页面

## 验证
- PRD 文档结构完整，5步设计清晰可执行
- 题库 6 档齐全，每档 15-20 题，覆盖 6 维度
- 题目 JSON 格式与现有 `Questionnaire.Questions` 字段兼容
