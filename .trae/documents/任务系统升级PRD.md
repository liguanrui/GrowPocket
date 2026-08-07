# 任务系统升级 PRD v4

> 状态：待评审  
> 日期：2026-08-05  
> 范围：任务系统 + 成长系统  
> 关联：在 [growpocket-v3.1-four-modules-prd.md](./growpocket-v3.1-four-modules-prd.md) 基础上扩展

---

## 一、背景与目标

### 1.1 现状
当前任务系统为**扁平单层结构**：
- Task 表只有 22 个字段，无任务类型区分、无父子关联、无习惯打卡机制
- AI 每日生成 3 条扁平日常任务，缺乏持续性和主题性
- 成长周期目标仅能关联 `dimension_id + target_score`，周期长度无限制（默认 30 天）
- 阶段回顾时所有任务一视同仁，无法体现习惯坚持或主题任务推进

### 1.2 目标
1. **任务系统**：引入两种新任务形式
   - **习惯养成**：每日重复出现的子任务，带鼓励语，跟踪坚持天数
   - **父子主题任务**：长期主题（如养绿植），AI 生成子任务，分阶段推进
2. **成长系统**：目标设置关联更多内容
   - 目标可关联习惯、主题任务
   - 周期限制 1-4 周（7-28 天），便于管理
3. **阶段回顾**：区分任务类型，习惯按坚持天数评估，主题任务按完成度生成相册

### 1.3 非目标
- 不重构现有日常任务（daily）的生成逻辑
- 不修改积分结算机制（Task 完成仍走现有 ReviewTask 流程）
- 不引入技能系统（Skill）—— 后续单独规划

---

## 二、任务系统升级

### 2.1 任务类型扩展

Task 表新增 `TaskKind` 字段，区分 5 种任务类型：

| TaskKind | 说明 | 是否出现在任务列表 | 是否可单独完成 |
|----------|------|-------------------|---------------|
| `daily` | 日常任务（现有扁平任务） | 是 | 是 |
| `habit_master` | 习惯父任务（聚合统计层） | 否（成长页单独展示） | 否 |
| `habit_daily` | 习惯每日子任务 | 是 | 是 |
| `parent` | 主题父任务 | 否（详情页查看） | 否 |
| `child` | 主题子任务 | 是 | 是 |

**新增字段**（Task 表）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `TaskKind` | string | 任务类型，默认 `daily`（向后兼容） |
| `ParentID` | uint | 父任务 ID（habit_daily→habit_master，child→parent） |
| `HabitID` | uint | 习惯配置 ID（仅 habit_daily/habit_master） |
| `GuardianRequired` | bool | 家长陪伴标记 |
| `StreakCount` | int | 连续坚持天数（仅 habit_master） |
| `TotalCount` | int | 累计坚持天数（仅 habit_master） |
| `HabitGoal` | int | 习惯目标天数，默认 21（仅 habit_master） |
| `LastCheckinDate` | *time.Time | 上次打卡日期（仅 habit_master） |
| `SubTaskOutline` | JSON | 子任务大纲（仅 parent，AI 生成的全部子任务大纲，未实例化的） |
| `Sequence` | int | 子任务顺序（仅 child，从 1 开始） |
| `IsKeyMilestone` | bool | 是否关键里程碑（仅 child，用于详情页高亮） |

### 2.2 习惯养成系统

#### 2.2.1 习惯库

**新增 `Habit` 表**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ID` | uint | 主键 |
| `FamilyID` | uint | 家庭 ID |
| `ChildID` | uint | 孩子 ID（0 表示预设通用） |
| `Title` | string | 习惯标题 |
| `Description` | string | 习惯描述 |
| `Category` | string | 类别（life/chore/cooking/study/sports/craft/social/safety/other） |
| `AgeMin` | int | 适用年龄下限 |
| `AgeMax` | int | 适用年龄上限 |
| `IsCustom` | bool | 是否自定义（预设=false，自定义=true） |
| `IsActive` | bool | 是否启用 |
| `CreatedAt` | time.Time | 创建时间 |

**预设习惯库**（Seed 数据）：
- 按 6 个年龄段分组：3-4 / 5-6 / 7-8 / 9-10 / 11-12 / 13+ 岁
- 覆盖 9 个类别，每年龄段约 10 条，共 60+ 条
- 示例：3-4 岁「自己穿鞋子」、9-10 岁「每日阅读 30 分钟」、13+ 岁「炒菜基础」

**自定义习惯**：
- 家长在目标设置时可自定义习惯（标题 + 描述）
- 自定义习惯 `IsCustom=true`，`FamilyID` + `ChildID` 标记归属
- AI 每日生成 habit_daily 子任务时基于自定义描述生成鼓励语

#### 2.2.2 目标设置时绑定习惯

成长周期目标设置面板新增「习惯目标」区：
1. 按孩子年龄（由生日推算）展示适配的预设习惯
2. 家长最多选 **1-2 个**习惯作为本周期阶段目标
3. 也可点击「自定义习惯」创建新习惯
4. 选中的习惯写入 Goal 表（`GoalType=habit`，`HabitID=xxx`）

#### 2.2.3 每日子任务生成

**触发时机**：每日 08:00 定时任务（与现有 AI 任务生成同批）

**生成逻辑**：
1. 查询当前 active 周期内 `GoalType=habit` 的所有目标
2. 对每个习惯目标：
   - 若 habit_master 父任务不存在 → 创建（`TaskKind=habit_master`，`StreakCount=0`，`HabitGoal=21`）
   - 若当日 habit_daily 子任务不存在 → 创建（幂等检查：同一天同 HabitID 不重复）
3. habit_daily 子任务：
   - 标题固定（取 Habit.Title）
   - **描述由 AI 生成**，带鼓励语（基于坚持天数动态变化）
   - `ParentID` = habit_master.ID
   - `HabitID` = Habit.ID
   - `Status` = 1（进行中）
4. habit_daily 完成后：
   - 进入已完成列表
   - habit_master 父任务统计更新：`StreakCount++`、`TotalCount++`、`LastCheckinDate=今天`
   - 当天未完成 → 次日 `StreakCount` 重置为 0（`TotalCount` 保留）

**鼓励语生成**（AI Prompt 示例）：
```
孩子「小明」正在坚持习惯「每日阅读 30 分钟」
当前连续坚持 5 天，累计 8 天，目标 21 天
请生成一句简短的鼓励语（10-20 字），结合坚持天数，语气温暖有童趣
```

#### 2.2.4 任务列表展示

- **只显示 habit_daily 子任务**，不显示 habit_master 父任务
- 卡片增加「🌱 习惯养成」标识（绿色徽章）
- 卡片右侧显示「连续 N 天」badge
- 当天完成后进入已完成列表（与日常任务一致）

#### 2.2.5 任务详情页

habit_daily 详情页新增「习惯打卡区」：
- 连续天数 + 累计天数 + 目标进度（N/21）+ 上次打卡日期
- 21 天进度条（可视化坚持过程）
- 打卡网格（最近 21 天的完成情况，类似 GitHub 贡献图）
- 「父任务」入口 → 跳转 habit_master 详情（只读统计页）

#### 2.2.6 阶段回顾

周期结束时 AI 评估习惯养成程度：
- **输入**：家长对 habit_daily 的批语 + 坚持天数（StreakCount/TotalCount/HabitGoal）
- **输出**：养成程度评级（已养成 / 基本养成 / 待加强）+ 文字总结
- **下周期推荐**：已养成的习惯在下次目标设置时**不再推荐**（标记 `IsActive=false` 或在推荐列表中过滤）

### 2.3 父子主题任务

#### 2.3.0 主题任务模板库

与习惯库对应，提供预设主题任务模板 + 家长自定义。

**新增 `ParentTaskTemplate` 表**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ID` | uint | 主键 |
| `FamilyID` | uint | 家庭 ID（0=预设通用） |
| `ChildID` | uint | 孩子 ID（0=预设通用） |
| `Title` | string | 主题标题（如「养绿植」） |
| `Description` | string | 主题描述（背景/意义/预期成果） |
| `Category` | string | 类别（family_creation/creative/community/financial/nature/craft 等） |
| `AgeMin` | int | 适用年龄下限 |
| `AgeMax` | int | 适用年龄上限 |
| `EstimatedDays` | int | 预计周期天数（7-28） |
| `KeyMilestones` | JSON | 关键里程碑大纲（AI 生成子任务的参考） |
| `IsCustom` | bool | 是否自定义（预设=false，自定义=true） |
| `CreatedAt` | time.Time | 创建时间 |

**预设主题模板**（Seed 数据）：
- 按 6 个年龄段分组：3-4 / 5-6 / 7-8 / 9-10 / 11-12 / 13+ 岁
- 覆盖 6 大类别，每年龄段约 5-8 条，共 30-50 条
- 示例：
  - 3-4 岁：「我的小花园」（nature，14 天）、「家庭照片墙」（family_creation，7 天）
  - 7-8 岁：「社区图书角」（community，21 天）、「零花钱记账」（financial，14 天）
  - 11-12 岁：「家庭厨艺周」（family_creation，14 天）、「手工义卖」（community+financial，28 天）
  - 13+ 岁：「阳台菜园」（nature，28 天）、「短视频记录家乡」（creative，21 天）

**自定义主题任务**：
- 家长在目标设置或创建任务时可自定义主题
- 填写：标题 + 描述 + 预计周期 + 类别
- `IsCustom=true`，`FamilyID` + `ChildID` 标记归属
- `KeyMilestones` 可选填（不填则由 AI 自动生成子任务大纲）

#### 2.3.1 父任务（parent）

**创建方式**：
- **从模板创建**：目标设置时选择年龄段适配的预设模板 → 自动填充标题/描述/预计周期/关键里程碑
- **自定义创建**：CreateTaskPage 新增「主题任务」类型，家长填写主题信息
- **AI 自动生成**：基于周期目标，如检测到「自然观察」维度弱项时自动推荐「养绿植」主题

**父任务字段**：
- 标题、描述、预计周期（天）、关键里程碑（JSON）
- `TaskKind=parent`
- `Status` 始终为 1（进行中），不进入待验收/已完成流转
- 不出现在任务列表

#### 2.3.2 子任务（child）

**两阶段生成机制**（大纲 → 分批实例化）：

**阶段 1：大纲生成**（父任务创建时立即执行）
- 父任务创建后，调用 AI 一次性生成**全部子任务大纲**
- 输入：父任务主题 + 孩子年龄 + 周期长度
- 输出：3-8 个子任务大纲（标题 + 简述 + 预计天数 + 顺序 + 是否关键里程碑）
- 大纲存入 parent 任务的 `SubTaskOutline` JSON 字段（**不创建 child 任务记录**）

**阶段 2：分批实例化**（按完成度触发 + 时间兜底）
- **首批**：大纲生成后立即实例化第 1 个子任务（创建 child 记录，Status=1）
- **完成触发**：当前批次子任务全部完成后，自动实例化下一批（1 个）
- **时间兜底**：若当前批次超过 3 天未完成，仍解锁下一批（避免卡住，保持节奏）
- **末批**：最后一个子任务实例化后，父任务标记进入"收尾阶段"

**分批策略说明**：
- 避免一次生成 8 个子任务导致任务列表过载和孩子压力过大
- 子任务可能有前后依赖（如"播种"→"浇水观察"→"测量记录"），分批保证顺序性
- 保持项目式学习节奏感，完成一个阶段解锁下一个，类似游戏关卡

**子任务字段**：
- `TaskKind=child`
- `ParentID` = 父任务 ID
- 标题、描述、积分、难度、能力维度
- `Sequence`（顺序，从 1 开始）
- `IsKeyMilestone`（bool，是否关键里程碑，用于详情页高亮）

**任务列表展示**：
- 子任务出现在任务列表，带「🎯 主题任务」标识（蓝色徽章）+ 父任务名 + 序号（如 2/5）
- 子任务完成后进入已完成列表
- 未实例化的子任务**不出现在列表**（只存于父任务大纲，父任务详情页可查看完整大纲）

#### 2.3.3 子任务详情页

新增「父任务信息区」：
- 父任务标题 + 描述
- 整体进度（已完成 X/Y 个子任务）
- 关键子任务列表（标记 KeyMilestone 的子任务，显示状态）
- 「查看父任务详情」入口

#### 2.3.4 阶段回顾

- **只对「所有子任务都已完成」的父任务**生成回忆相册
- 相册内容：
  - 父任务主题 + 时间跨度
  - 子任务成果照片（按时间线排列）
  - 关键里程碑高亮
- 未全部完成的父任务：在故事中显示「进行中」状态 + 当前进度

### 2.4 家长陪伴标记

- `GuardianRequired` boolean 字段（所有任务类型均可设置）
- 创建任务时家长可勾选「需要家长陪伴」
- **自动触发**：任务标题/描述含风险关键词（刀/火/电/化学/高处等）时自动置为 true
- 任务列表卡片显示醒目「⚠️ 需家长陪伴」标识（玫红色徽章）
- 详情页显示大型 Banner + 安全提示

---

## 三、成长系统升级

### 3.1 目标设置扩展

**Goal 表新增字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `GoalType` | string | 目标类型：`dimension`（默认）/ `habit` / `parent_task` |
| `HabitID` | *uint | 关联的习惯 ID（GoalType=habit 时） |
| `ParentTaskID` | *uint | 关联的父任务 ID（GoalType=parent_task 时） |

**能力维度目标简化**：去掉 `TargetScore`（原 `[10,20,30,40,50,60,80,100]` 分值选择），`GoalType=dimension` 时仅记录"本周期重点关注该维度"，由 AI 基于关注维度自动生成任务，不再以分数作为进度衡量。`TargetScore` 字段保留但置为 0（向后兼容旧数据）。

**周期进度计算调整**：原 `GetCycleProgress = current_score*100/target_score` 失效，改为按**任务完成度**计算：`已完成任务数 / 周期内应完成任务数`（应完成 = 已生成任务数，含 daily + habit_daily + child）。

**目标设置面板重构**（三区块）：

```
┌─────────────────────────────────┐
│  周期时间：[1周][2周][3周][4周]  │  ← 新增 1-4 周限制
├─────────────────────────────────┤
│  📊 能力维度目标（可选 0-6 个）  │  ← 简化：仅勾选，无分数
│  □ 自理能力                     │
│  □ 学习认知                     │
├─────────────────────────────────┤
│  🌱 习惯目标（可选 0-2 个）      │  ← 新增
│  [按年龄推荐的习惯列表]          │
│  [+ 自定义习惯]                  │
├─────────────────────────────────┤
│  🎯 主题任务（可选 0-1 个）      │  ← 新增
│  [按年龄推荐的主题模板列表]      │
│  [+ 自定义主题]                  │
└─────────────────────────────────┘
```

### 3.2 周期长度限制 1-4 周

**后端校验**（`growth_cycle_service.go`）：
- `CreateCycle`：校验 `endDate.Sub(startDate)` ∈ [7, 28] 天
- `UpdateCycle`：同样校验
- 不满足时返回 400 错误，提示「周期长度需在 1-4 周之间」

**前端校验**（`GrowthPage.tsx`）：
- MobileDatePicker 改为按周选择（1/2/3/4 周按钮组）
- 选择后自动计算 endDate = startDate + N*7 天
- 默认 2 周（14 天）

### 3.3 AI 任务生成扩展

`task_generation_service.go` 的 `GenerateTasksForChild` 扩展：

1. **读取目标扩展**：
   - 现有：读取 `GoalType=dimension` 的目标（仅维度 ID，**无目标分数**）
   - 新增：读取 `GoalType=habit` 的目标 → 生成 habit_daily 子任务（含 AI 鼓励语）
   - 新增：读取 `GoalType=parent_task` 的目标 → 检查父任务子任务是否齐全，不足则补齐
   - AI Prompt 调整：从"家长目标：XX目标N分"改为"本周期重点关注维度：XX、XX"

2. **生成策略调整**：
   - 日常任务（daily）：保持现有 3 条扁平任务
   - 习惯子任务（habit_daily）：每个习惯目标 1 条/天
   - 主题子任务（child）：**两阶段生成** —— 父任务创建时 AI 生成全部大纲存入 `SubTaskOutline`，随后按"完成触发 + 3 天时间兜底"分批实例化为 child 任务（详见 2.3.2）

3. **守门员规则适配**：
   - habit_daily 不参与 Jaccard 去重（标题固定）
   - child 任务按父任务主题去重
   - 蓄势维配额仅适用于 daily 任务

### 3.4 成长故事生成扩展

`growth_story_service.go` 的 `GenerateStory` 扩展：

1. **任务分类聚合**：
   - daily 任务：现有逻辑（标题 + 积分）
   - habit 任务：聚合统计（习惯名 + 坚持天数 + 家长批语）→ AI 评估养成程度
   - parent/child 任务：按父任务分组，仅全完成的父任务生成相册

2. **故事 Prompt 扩展**：
   ```
   ## 日常任务
   - 完成作业 +10
   - 整理书桌 +5
   
   ## 习惯养成
   - 「每日阅读」连续 18 天，累计 20 天，家长批语：「主动性强」
   - 「早睡早起」连续 5 天，累计 12 天，家长批语：「周末需改进」
   
   ## 主题任务
   - 「养绿植」已完成 5/5 子任务（相册 5 张照片）
   - 「社区服务」已完成 2/4 子任务（进行中）
   ```

3. **相册生成规则**：
   - 习惯任务：选取打卡日历 + 部分成果照片
   - 主题任务：仅全完成的父任务，按时间线排列子任务成果照片

---

## 四、API 变更

### 4.1 任务列表 API

`GET /api/tasks` 新增查询参数：
- `task_kind`：筛选任务类型（支持逗号分隔多选，如 `daily,habit_daily,child`）
- 默认只返回 `daily,habit_daily,child`（不返回 habit_master, parent）

### 4.2 习惯相关 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/habits/preset?age=8` | 获取年龄段适配的预设习惯 |
| POST | `/api/habits/custom` | 创建自定义习惯 |
| GET | `/api/habits/active?child_id=2` | 获取当前周期绑定的习惯 |
| GET | `/api/habits/:id/stats` | 获取习惯统计（连续/累计/目标/打卡日历） |

### 4.3 父子任务相关 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/parent-task-templates/preset?age=8` | 获取年龄段适配的预设主题模板 |
| POST | `/api/parent-task-templates/custom` | 创建自定义主题模板 |
| POST | `/api/tasks/parent` | 创建主题父任务（可带 template_id 从模板创建） |
| POST | `/api/tasks/parent/:id/generate-children` | AI 生成子任务大纲 |
| POST | `/api/tasks/parent/:id/advance-batch` | 手动触发下一批子任务实例化（可选） |
| GET | `/api/tasks/:id/children` | 获取子任务列表（含已实例化 + 大纲中未实例化的） |
| GET | `/api/tasks/:id/parent` | 获取父任务详情 |
| GET | `/api/tasks/:id/habit-master` | 获取习惯父任务统计 |

### 4.4 成长周期 API

`POST /api/growth/cycles` 和 `PUT /api/growth/cycles/:id`：
- 后端校验周期长度 1-4 周
- 错误响应：`{"error": "周期长度需在 1-4 周之间"}`

### 4.5 目标设置 API

`POST /api/growth/goals` 扩展请求体：
```json
{
  "cycle_id": 1,
  "child_id": 2,
  "goals": [
    {"goal_type": "dimension", "dimension_id": 1},
    {"goal_type": "habit", "habit_id": 5},
    {"goal_type": "parent_task", "parent_task_id": 10}
  ]
}
```
> 注：`goal_type=dimension` 时不再传 `target_score`，仅标记关注维度。

---

## 五、前端变更

### 5.1 TaskListPage

- 卡片增加任务类型徽章：
  - 🌱 习惯养成（绿色）+ 连续天数 badge
  - 🎯 主题任务（蓝色）+ 父任务名
  - ⚠️ 需家长陪伴（玫红色）
- 任务列表查询默认带 `task_kind=daily,habit_daily,child`

### 5.2 TaskDetailPage

按任务类型条件渲染新区块：
- **habit_daily**：习惯打卡区（连续天数 + 21 天进度条 + 打卡网格 + 父任务入口）
- **child**：父任务信息区（标题 + 进度 + 关键子任务列表 + 查看父任务入口）
- **所有类型**：若 `GuardianRequired=true`，显示家长陪伴 Banner + 安全提示

### 5.3 GrowthPage 目标设置面板

- 时间选择改为 1-4 周按钮组
- 新增「习惯目标」区（按年龄推荐 + 自定义入口）
- 新增「主题任务」区（推荐主题列表）
- 提交时按 GoalType 分类调用 setGoal

### 5.4 CreateTaskPage

- 新增任务类型选择（日常 / 主题任务）
- 主题任务创建时：填写主题 + 描述 + 预计周期 → 创建后自动调用 AI 生成子任务
- 所有任务类型均可勾选「需要家长陪伴」

---

## 六、数据模型变更汇总

### 6.1 Task 表新增字段

```go
TaskKind         string     `json:"task_kind" gorm:"default:daily"`      // daily/habit_master/habit_daily/parent/child
ParentID         uint       `json:"parent_id" gorm:"default:0"`          // 父任务 ID
HabitID          uint       `json:"habit_id" gorm:"default:0"`           // 习惯配置 ID
GuardianRequired bool       `json:"guardian_required" gorm:"default:false"` // 家长陪伴标记
StreakCount      int        `json:"streak_count" gorm:"default:0"`       // 连续坚持天数（habit_master）
TotalCount       int        `json:"total_count" gorm:"default:0"`        // 累计坚持天数（habit_master）
HabitGoal        int        `json:"habit_goal" gorm:"default:21"`        // 习惯目标天数（habit_master）
LastCheckinDate  *time.Time `json:"last_checkin_date"`                   // 上次打卡日期（habit_master）
SubTaskOutline   string     `json:"sub_task_outline" gorm:"type:text"`   // 子任务大纲 JSON（parent）
Sequence         int        `json:"sequence" gorm:"default:0"`           // 子任务顺序（child，从 1 开始）
IsKeyMilestone   bool       `json:"is_key_milestone" gorm:"default:false"` // 关键里程碑（child）
```

### 6.2 Goal 表新增字段

```go
GoalType      string `json:"goal_type" gorm:"default:dimension"` // dimension/habit/parent_task
HabitID       *uint  `json:"habit_id"`                            // 关联习惯（GoalType=habit）
ParentTaskID  *uint  `json:"parent_task_id"`                      // 关联父任务（GoalType=parent_task）
// TargetScore 字段保留，GoalType=dimension 时置 0（不再作为进度衡量）
```

### 6.3 新增 Habit 表

```go
type Habit struct {
    ID          uint      `json:"id" gorm:"primaryKey"`
    FamilyID    uint      `json:"family_id"`
    ChildID     uint      `json:"child_id"`           // 0=预设通用
    Title       string    `json:"title"`
    Description string    `json:"description"`
    Category    string    `json:"category"`           // life/chore/cooking/study/sports/craft/social/safety/other
    AgeMin      int       `json:"age_min"`
    AgeMax      int       `json:"age_max"`
    IsCustom    bool      `json:"is_custom" gorm:"default:false"`
    IsActive    bool      `json:"is_active" gorm:"default:true"`
    CreatedAt   time.Time `json:"created_at"`
}
```

### 6.4 新增 ParentTaskTemplate 表

```go
type ParentTaskTemplate struct {
    ID             uint      `json:"id" gorm:"primaryKey"`
    FamilyID       uint      `json:"family_id"`        // 0=预设通用
    ChildID        uint      `json:"child_id"`         // 0=预设通用
    Title          string    `json:"title"`
    Description    string    `json:"description"`
    Category       string    `json:"category"`         // family_creation/creative/community/financial/nature/craft
    AgeMin         int       `json:"age_min"`
    AgeMax         int       `json:"age_max"`
    EstimatedDays  int       `json:"estimated_days"`   // 7-28
    KeyMilestones  string    `json:"key_milestones" gorm:"type:text"` // JSON 大纲
    IsCustom       bool      `json:"is_custom" gorm:"default:false"`
    CreatedAt      time.Time `json:"created_at"`
}
```

### 6.5 AutoMigrate 更新

`database.go` 新增：
```go
db.AutoMigrate(&model.Habit{})
db.AutoMigrate(&model.ParentTaskTemplate{})
```

---

## 七、影响范围与风险

### 7.1 向后兼容

- Task 表新增字段均有默认值，旧任务自动 `TaskKind=daily`、`ParentID=0`、`GuardianRequired=false`
- Goal 表新增字段均有默认值，旧目标自动 `GoalType=dimension`
- 现有 API 不受影响，新参数均为可选

### 7.2 风险与对策

| 风险 | 对策 |
|------|------|
| 习惯每日生成重复 | 幂等检查：同一天同 HabitID 不重复生成 habit_daily |
| 自定义习惯 AI 评判无批语 | 阶段回顾时若无批语，AI 仅基于坚持天数评估 |
| 父子任务相册生成延迟 | 异步生成，故事先完成主体，相册后补 |
| AI 生成子任务描述重复 | 守门员增加父子任务维度去重（基于父任务主题） |
| 周期 1-4 周限制影响旧数据 | 仅对新周期校验，旧 completed 周期不动 |
| 任务列表查询性能 | task_kind 字段加索引 |

### 7.3 性能优化

- Task 表新增索引：`task_kind`、`parent_id`、`habit_id`、`last_checkin_date`
- 习惯统计查询使用 Redis 缓存（可选，后续优化）

---

## 八、实施阶段建议

### Phase 1：数据模型与基础 API（基础层）
- Task 表新增字段 + AutoMigrate
- Goal 表新增字段 + AutoMigrate
- 新增 Habit 表 + ParentTaskTemplate 表 + AutoMigrate
- 基础 CRUD API（习惯预设/自定义、主题模板预设/自定义、父子任务）
- 周期 1-4 周校验

### Phase 2：习惯养成系统（核心功能）
- 预设习惯库 Seed（60+ 条，6 年龄段 × 9 类别）
- 目标设置绑定习惯（UI + API）
- 每日子任务生成（含 AI 鼓励语）
- 任务列表与详情页展示
- 阶段回顾 AI 评估养成程度

### Phase 3：父子主题任务（核心功能）
- 预设主题模板库 Seed（30-50 条，6 年龄段 × 6 类别）
- 父任务创建（从模板创建 + 自定义创建）
- AI 生成子任务大纲 + 分批实例化
- 任务列表与详情页展示
- 相册生成（仅全完成父任务）

### Phase 4：成长系统整合与家长陪伴（体验优化）
- 目标设置 UI 重构（三区块）
- AI 任务生成扩展（读取习惯/主题目标）
- 成长故事扩展（区分任务类型）
- 家长陪伴标记（自动触发 + Banner）

---

## 九、验收标准

### 9.1 习惯养成
- [ ] 目标设置时可选 1-2 个年龄段适配的习惯
- [ ] 习惯子任务每日 08:00 自动生成，描述带鼓励语
- [ ] 任务列表显示「习惯养成」标识 + 连续天数
- [ ] 详情页显示 21 天进度条 + 打卡网格
- [ ] 阶段回顾 AI 评估养成程度，已养成的习惯下周期不再推荐

### 9.2 父子主题任务
- [ ] 预设主题模板库覆盖 6 年龄段 × 6 类别，30+ 条
- [ ] 目标设置时可选年龄段适配的主题模板，也可自定义
- [ ] 父任务创建后 AI 自动生成 3-8 个子任务大纲
- [ ] 子任务分批实例化（完成触发 + 3 天时间兜底）
- [ ] 任务列表显示「主题任务」标识 + 父任务名 + 序号
- [ ] 子任务详情页显示父任务进度 + 关键子任务
- [ ] 阶段回顾仅对全完成父任务生成相册

### 9.3 成长系统
- [ ] 周期长度限制 1-4 周（前后端均校验）
- [ ] 目标设置面板包含三区块（维度/习惯/主题任务）
- [ ] AI 任务生成读取习惯目标生成 habit_daily
- [ ] 成长故事区分任务类型展示

### 9.4 家长陪伴
- [ ] 任务创建可勾选「需要家长陪伴」
- [ ] 风险关键词自动触发标记
- [ ] 任务列表和详情页显示醒目标识

---

## 十、附录

### 10.1 相关文件

**后端**：
- [task.go](file:///Users/Admin1/Workhome/GrowPocket/backend/internal/model/task.go) - Task 模型
- [goal.go](file:///Users/Admin1/Workhome/GrowPocket/backend/internal/model/goal.go) - Goal 模型
- [growth_cycle.go](file:///Users/Admin1/Workhome/GrowPocket/backend/internal/model/growth_cycle.go) - 周期模型
- [task_generation_service.go](file:///Users/Admin1/Workhome/GrowPocket/backend/internal/service/task_generation_service.go) - AI 生成
- [growth_story_service.go](file:///Users/Admin1/Workhome/GrowPocket/backend/internal/service/growth_story_service.go) - 故事生成
- [growth_cycle_service.go](file:///Users/Admin1/Workhome/GrowPocket/backend/internal/service/growth_cycle_service.go) - 周期服务

**前端**：
- [TaskListPage.tsx](file:///Users/Admin1/Workhome/GrowPocket/frontend/src/pages/TaskListPage.tsx) - 任务列表
- [TaskDetailPage.tsx](file:///Users/Admin1/Workhome/GrowPocket/frontend/src/pages/TaskDetailPage.tsx) - 任务详情
- [GrowthPage.tsx](file:///Users/Admin1/Workhome/GrowPocket/frontend/src/pages/GrowthPage.tsx) - 成长页
- [CreateTaskPage.tsx](file:///Users/Admin1/Workhome/GrowPocket/frontend/src/pages/CreateTaskPage.tsx) - 创建任务

### 10.2 术语表

| 术语 | 说明 |
|------|------|
| habit_master | 习惯父任务，聚合统计层，不出现在任务列表 |
| habit_daily | 习惯每日子任务，每日生成，完成后消失 |
| parent | 主题父任务，如「养绿植」 |
| child | 主题子任务，父任务下的具体任务 |
| daily | 日常任务，现有扁平任务 |
| StreakCount | 连续坚持天数，未打卡次日重置 |
| TotalCount | 累计坚持天数，永不重置 |
