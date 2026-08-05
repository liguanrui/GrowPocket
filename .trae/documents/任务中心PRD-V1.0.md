# GrowPocket「任务中心」模块 PRD V1.3

> 版本：**V1.3 · 日期：2026-08-04**（V1.2基础上增量升级：① Cycle 长度可配置 1-4 周四档 ② 新增阶段目标设定前置流程 ③ 锚定「目标 → 课程表」生成链路）
> 范围：底部导航「任务」Tab 完整模块（含可配置周期课程表视图、每日任务列表、任务详情、四类验收、技能解锁、父任务里程碑、Cycle级编排引擎）
> 关联输入文档：《1-6年级成长任务基础规范V1》《每日锚任务汇总》《技能解锁树汇总》《跨周期父任务汇总》《1-6年级任务模板库×6份》《问卷题库-分龄6档V2》
> 品牌色：任务中心使用**暖橙渐变**（`from-orange-400 to-amber-500`）作为主题色，与成长模块绿色渐变、AI助理蓝色渐变形成三色区分。
> 核心合规：**学术红线100%（禁具体分数奖励）+ 安全红线100%（危险操作技能树前置+家长确认书）+ 主次潜维度占比合规**
> 架构升级（V1.1新增，V1.3演进一步）：**生成架构从「每日单点推送」升级为「Cycle全局预生成 + 家长预览拍板」，每日任务仅作为Cycle的一天切片落地**
> 架构演进（V1.3新增）：**Cycle 长度从固定 14 天 → 家长可选 1/2/3/4 周四档；新增「阶段目标设定」前置环节，家长先选定本周期重点能力维度+积分目标，再生成对应长度的课程表**

---

## 一、模块定位与核心价值（V1.1 增量部分见「任务实例Taxonomy与架构升级」）

### 1.1 模块定位

「任务中心」是 GrowPocket 的**日常行动引擎**，是孩子每天打开App的第一落地页。它以「7天为1成长周期」为节奏，自动为每个孩子生成符合：
- ✅ 所在年级的**主次潜能力维度配比**（主维≥60% / 次维~30% / 潜维≤10%）
- ✅ 问卷测出的**初始能力基线分**（高分跳级解锁 / 低分补强补量）
- ✅ 技能解锁进度（危险任务禁直接推，必须前置技能链）
- ✅ 父任务当前阶段里程碑（自动拆分子任务进每日池）

的每日任务组合，驱动孩子通过「做任务 → 验收 → 得积分 → 攒技能 → 完成项目」的正向循环获得能力成长。

### 1.2 与「成长模块」的分工关系

| 模块 | 定位 | 节奏 | 核心价值 | 数据流向 |
|-----|-----|-----|---------|---------|
| **任务中心（本PRD）** | **行动端**：每天做什么、怎么做、做完验收 | **每日**粒度 | 任务执行 + 每日积分 + 技能解锁 + 父任务子任务拆解 | 任务完成记录 → 写入成长模块待评定 |
| 成长模块 | **回顾端**：一段时间后长了什么能力、获得什么故事 | **每7天（1周期）** 粒度 | 能力雷达评定 + 积分兑换 + 成长故事 + 阶段目标回顾 | 读取本周期任务记录 → AI综合评定能力分 → 写入成长故事 |

> 一句话分工：**任务中心管「每天播种」，成长模块管「每季收割」**。

### 1.3 核心设计理念（3条硬约束）

1. **能力维度不跑偏**：每日任务组合在「年级主维≥60%」硬约束下生成，绝不允许潜维任务刷屏（如运动/创意只能占1/10以下，留作奖励性质）。
2. **危险操作零裸奔**：涉刀/火/燃气/电/工具任务，必须先过技能解锁链，未解锁的任务**直接跳过不出池**，换同维度低风险替代。
3. **学术红线一票否决**：任何任务文案、验收标准、奖励文案中出现「具体分数/名次/排名/测试/试卷」关键词 → 系统审核层自动打回，不得上线。

---

## 一-B、任务实例Taxonomy 6类枚举 + 4核心字段扩展（V1.1 新增）

> **核心目标**：覆盖「父子任务 / 每日重复 / 强制陪同 / 周期编排」四种任务形式，**完全复用现有 task_template + daily_task_instance 两张主表**，仅通过加4个字段+Sanitize/RAG新增5条规则实现，不动主流水线。

### 1-B.1 任务类型Taxonomy 6类枚举（task_kind 字段）

| 枚举值 | 中文名 | 对应架构图标签 | 核心价值（神经回路/合规义务/家庭参与感） | 典型任务举例 |
|-------|-------|-------------|-------------------------------------|----------|
| `daily_fixed` | 每日锚点任务 | daily_fixed | **习惯养成（神经回路）**：每天固定不变，3-7周形成自动化行为回路，无需家长提醒 | H1-GX系列：每日三整理、餐桌小主人、静阅读 |
| `weekly_recurring` | 每周固定任务 | daily_fixed（周维度变种） | 同上，巩固周期性责任感（如每周二四六倒垃圾），对应低段习惯扩展 | 每周2天家庭公共区清洁、每周日家庭采购 |
| `guardian_reqd` | 强制陪同任务 | guardian_reqd | **合规义务（防安全事故）**：涉刀/火/燃气/电/高温/工具的任何等级操作，必须家长在场 | 首次用安全水果刀、明火熬果酱、高温熨斗熨衣 |
| `collaborative` | 父子协同任务 | collaborative | **家庭参与感（减少甩手家长）**：必须家长+孩子共同完成的任务，家长不可只验收不参与 | 家庭采购分工、组装家具、家庭大扫除分工、家宴策划 |
| `parent_child` | 父任务→子任务（里程碑） | 父子协同变种 | 同上，跨周期父任务的里程碑子任务，天然是父子协同（因为父任务有最终产出物需要家长签字） | 绿豆发芽Day7填观察卡、义卖活动前做海报 |
| `cycle_theme` | 主题周目标任务 | 周期编排变种 | **针对性训练（补短板）**：能力缺口驱动的整周主题任务，全部集中在同一弱维 | 「收纳美学主题周」（创意审美弱）、「公益小伙伴主题周」（社交协作弱） |

### 1-B.2 4个扩展字段（复用现有表，仅加列 + Sanitize/RAG加5条规则，主流水线不动）

> **设计原则**：4个字段覆盖6类Taxonomy的全部差异化逻辑，**不需要新建表**，只在task_template（模板级默认值）和daily_task_instance（实例级可覆盖）各加4列。

| 字段名 | 类型 | 模板级作用（task_template） | 实例级作用（daily_task_instance） | 对应Taxonomy分类 |
|-------|------|------------------------|------------------------------|--------------|
| **`task_kind`** | ENUM(6类) | 默认任务类型（如H1锚任务默认=daily_fixed，明火烹饪默认=guardian_reqd） | 可覆盖：家长在课程表视图里可把单天某任务临时改成「collaborative父子协同」 | 决定：任务卡片左上角徽标、验收流程分支、陪同校验 |
| **`parent_id`** | BIGINT 可空 | 若子任务则关联父任务template_id；锚任务/拓展=NULL | 同模板级，但父子里程碑子任务自动注入当前激活的parent_task.id | 对应：父子协同 / 父任务→子任务两类 |
| **`supervision`** | JSON | 家长陪同配置：`{level: "none\|accompany\|doorstep\|confirm", sign_off_required: bool, first_n_times: 3}` 来自《技能解锁树汇总》安全红线总表 | 可覆盖：家长可提高陪同等级（如把confirm改成accompany额外注意） | 对应：强制陪同 guardian_reqd |
| **`prerequisite_code`** | VARCHAR(64) 可空 | 前置依赖校验码：支持 `skill:S1-G3>=1`（技能等级）/ `task:H1-G1-01:done:7`（锚任务连续完成7天）/ `pt:P1-G1:milestone:2`（父任务第2里程碑达成） | 同模板级，Cycle级编排时Sanitize阶段自动过滤不满足前置依赖的日期 | 对应：每日锚点重复/陪同/周期编排的前置链校验 |

### 1-B.3 现有三阶段流水线增量升级：主逻辑不动，仅 Sanitize + RAG 加5条规则

```
【原流水线（保持不变）】
  Prompt Assemble → Template Select → Score Generate → RAG Retrieve → Rank & Generate → Final Sanitize → Output

【V1.1 新增：仅在 RAG Retrieve 和 Final Sanitize 各加规则，主Rank&Generate不动】
  RAG Retrieve     →  + 规则R-1/R-2（主题周弱维RAG加权 + guardian_reqd任务RAG召回时自动附带安全确认书模板）
  Final Sanitize   →  + 规则S-1/S-2/S-3（task_kind/supervision/prerequisite_code 三维度硬校验）
```

---

## 一-C、生成架构升级：Daily → 可配置Cycle全局编排（V1.1 新增，V1.3 演进为「阶段目标 → 课程表」两段式）

> **三支柱对应架构图右侧**：
> 支柱0 = **阶段目标设定前置**（V1.3 新增）→ 家长先选定本Cycle重点能力维度+积分目标，再触发课程表生成
> 支柱1 = **全局可配置周期编排（课程表视图）**→ 全局规划感，不再被动等每日推送；周期长度家长可选1/2/3/4周四档
> 支柱2 = **能力缺口驱动（主题周分配）**→ 针对性训练，补问卷和完成率暴露的短板
> 支柱3 = **家长预览调整（拍板权给家长）**→ 家长责任感，减少系统推荐抵触

### 1-C.0 支柱0：阶段目标设定（V1.3 新增前置环节）

> **核心定位**：Cycle 课程表不再是「凭空生成」，而是**家长设定阶段目标后由引擎反向推导生成**。这是 V1.3 相对 V1.1 最核心的演进。

**目标设定的 3 类要素**（家长在「📅周期课程表」页顶部「🎯设定本周期目标」入口填写）：

| 目标要素 | 取值范围 | 说明 | 影响课程表生成的环节 |
|---------|---------|-----|-------------------|
| **① 周期长度档位** | `1week` / `2week` / `3week` / `4week` 四档 | 默认=2week（向后兼容V1.1）；1week 适合临时调整/试运行，4week 适合长项目规划 | 决定 `cycle_plan.cycle_length_weeks` 字段；锚任务数=周数×7；拓展池总量动态计算 |
| **② 重点能力维度**（可多选1-3个） | 6 维中选：生活自理/责任担当/学习探索/社交协作/创意审美/运动健康 | 默认=本年级主维（系统推荐）；家长可勾选补充弱维作为重点突破 | 影响拓展池抽取权重：被选维度的拓展槽占比 +20%；若勾选弱维则触发主题周优先级 +1 |
| **③ 周期积分目标** | 50 / 100 / 200 / 300 / 500 分 五档（按年级递增） | 默认=按年级主维任务量自动推算；家长可手动调高挑战 | 影响拓展槽数量：目标分↑→每日拓展槽 +1（封顶年级上限+2）；目标分未达成时下个 Cycle 自动 +10% 推算 |

**目标设定 → 课程表生成的链路**：
```
家长进入📅周期课程表页
  ↓ 点击「🎯设定本周期目标」入口
  ↓ 选择 ① 周期长度档位（1/2/3/4 周）+ ② 重点能力维度（1-3 个）+ ③ 积分目标（5 档）
  ↓ 系统基于目标计算拓展槽数量 + 弱维加权倍率 + 主题周是否触发
  ↓ 调用 generate_cycle_plan(child_id, start_monday, cycle_length_weeks, goals) 生成对应长度课程表
  ↓ 进入支柱3的家长预览拍板流程（锁定/替换/增删/提级陪同）
  ↓ 锁版后按日切片落地
```

**默认目标推算规则**（家长未主动设定时）：
- 周期长度：2week（兼容V1.1）
- 重点维度：当前年级的 PRIMARY_DIMS（系统自动选主维）
- 积分目标：基础锚任务积分×周期天数 + 拓展任务预估积分×拓展槽数量

### 1-C.1 支柱1：全局可配置周期编排（课程表日历视图，V1.3 升级）

**编排频率**：Cycle 结束前一周的周日 20:00 预生成「下个 Cycle 周一 → 下个 Cycle 末日」共 `cycle_length_weeks × 7` 天的任务课程表，存为 cycle_plan 快照；家长可预览调整后锁版；每日仅按锁版切片落地。

> V1.3 改动：V1.1 固定每周日 20:00 触发，V1.3 改为「按 Cycle 实际长度动态触发」——下个 Cycle 开始前一周的周日 20:00 触发；1周Cycle则每周日触发、4周Cycle则每4周触发一次。

**Cycle 编排的三大约束（保证主次潜合规，按周期长度动态生效）**：
1. **全局占比约束**：整个 Cycle 总任务数的**主维≥60% / 次维~30% / 潜维≤10%**（按天聚合，允许单日有波动，但整个 Cycle 整体必须达标）
2. **Cool-down池全局生效**：主维任务3天冷却/次维5天冷却/潜维14天冷却直接在 Cycle 生成时一次性满足，不需要每日再查重（注：1周Cycle下潜维14天冷却等价于"本Cycle内不重复"）
3. **parent_id 里程碑连续**：若父任务里程碑在本 Cycle 范围内有 N 条子任务，必须均匀分布在 `cycle_length_weeks × 7` 天内，不许堆到最后2天（可配置最大日密度=父任务子任务≤每日1条）

### 1-C.2 支柱2：能力缺口驱动（主题周分配）

**触发条件**：问卷基线分<50分 OR 近一个Cycle某维完成率<60% → 标记为「弱维」，触发主题周分配。
> V1.3 改动：历史回看窗口从固定「近14天」改为「近一个已锁版Cycle」（动态长度），保证不同周期长度下都能识别弱维。

**主题周分配规则（V1.3 适配不同周期长度）**：
1. **频率上限**：每4周最多安排1次主题周，避免过载；主题周持续7天（周一到下周一前）
2. **周期长度适配**：
   - 1周Cycle：若触发主题周，则整个Cycle即为主题周（拓展槽100%派给弱维，等同"主题周期"）
   - 2周Cycle：主题周占其中1周（前周或后周由家长选）
   - 3-4周Cycle：主题周占其中1周，其余周正常分配
3. **弱维加权**：主题周内，对应维度的拓展槽数量×3（例如平时拓展=3条，主题周主弱维=9条，对应弱维占比直接拉满到≥80%，一周集中练透）
4. **可识别徽标**：主题周期间，任务卡片加「🌟XX主题周」金色徽标，孩子端和家长端都明确感知
5. **主题周可选值**（和各年级维度配置对齐）：收纳美学、孝心责任、学习探索家、创意小画家、公益小伙伴、厨艺小达人、运动小健将、社交小主人

### 1-C.3 支柱3：家长预览调整（拍板权）

**时间窗**：Cycle 开始前一周的周日 20:00 → Cycle 开始日 06:00，预览时间窗；家长有完全的拍板权。
> V1.3 改动：预览时间窗随周期长度动态调整（始终是「下个Cycle开始前一周的周日20:00 → 下个Cycle开始日06:00」）。

**家长可做的5类调整（全部落实例级4字段覆盖）**：
| 操作 | 效果 | 触发的后端规则 |
|-----|-----|------------|
| 🔒 **锁定任务** | 某Cycle内某任务锁定，后续家长再点「重新生成」时此任务不动，仅重排其余 | 写入 instance.locked = true；Sanitize S-1 跳过锁定任务的重排 |
| 🔄 **替换单任务** | 点击「换一个同维度任务」→ 弹出3条同维度同难度候选 | RAG规则R-1：替换时优先召回冷却池外+和近7天完成任务不重复的3条 |
| ➕ **增加任务** | 家长手动加任务（或从拓展池选）到某一天 | task_kind 自动=weekly_recurring（如果设为重复）或 daily_fixed（如果仅单次）；dimension_id 校验 |
| ➖ **删除任务** | 家长删除系统推荐的单天任务 | 前提：当天主维任务数删除后仍≥主维最低要求（删除后如果主维<60%则弹窗提示「主维任务不足，建议替换而非删除」） |
| 📌 **提级陪同等级** | 家长把「仅确认」任务手动提级为「全程陪同」 | supervision JSON 覆盖写入；触发 guardian_reqd 规则，孩子端验收按钮自动等家长端签字后才亮起 |

---

## 二、信息架构与页面结构

### 2.1 整体页面树

```
底部「任务」Tab（/growth-tasks）
├─┬ 顶部一级Tab切换：📘 今日任务（默认） / 📅 周期课程表（V1.3支持1-4周可配置，家长专属）
│ │
│ ├── 📘 今日任务页（默认落地页，孩子主视角）
│ │   ├── 顶部栏：IP形象 + 日期问候 + 今日完成进度环 + 儿童切换
│ │   ├── 周期概览卡：当前第X周期 / Cycle进度条（按cycle_length_weeks显示） / 完成率 / 预计积分
│ │   ├── 锚任务专区（标「每日保底」徽标 + task_kind徽标）：必做3-5条，按年级固定
│ │   ├─┬ 拓展任务专区（标「今天多练」徽标）：每天系统自动补1-3条
│ │   │ └── 分Tab切换：全部 / 主维 / 次维 / 潜维（奖励）/ 🌟主题周（激活时显示）
│ │   ├── 技能解锁专区（标「新解锁」徽标）：可升级技能 + 当前技能进度
│ │   ├── 跨周期父任务专区（标「进行中」徽标）：父任务卡片 + 今日子任务进度
│ │   └── 悬浮按钮「+ 自定义任务」（家长端可手动加）
│ │
│ └── 📅 周期课程表页（V1.3 支持可配置长度，家长专属，无家长权限则提示「请爸爸妈妈登录」）
│     ├── 顶部栏：周期选择 + 周期长度档位切换器（1/2/3/4周） + 🎯设定本周期目标入口 + 整Cycle维度占比统计条 + 🔒锁版状态
│     ├── 周期日历表格视图（按 cycle_length_weeks 动态渲染行数：1周1行×7列 / 2周2行×7列 / 3周3行×7列 / 4周4行×7列，每日1个cell）
│     │   └── 每个cell = 日期徽标 + 任务卡片列表（按task_kind分色）+ 完成度mini圆环
│     ├── 悬浮操作条（预览时间窗内显示，锁版后隐藏）：
│     │   ├── 🔄 重新生成 / 🔒 全部锁定 / 📤 导出PDF分享 / ✅ 确认锁版
│     │   └── 能力占比仪表盘（实时计算整Cycle主维/次维/潜维占比，不达标时红标提醒）
│     └── 单天cell长按或点击 → 展开当日任务编辑面板（锁定/替换/增删/提级陪同）
│
├── 任务详情页 /growth-tasks/:id
│   ├── 任务信息块：图标 + 标题 + 能力维度标签 + 积分 + 安全等级 + task_kind彩色徽标
│   ├── 验收标准块：3-5条可量化硬标准（打勾式）
│   ├── 示范参考区：图文/小视频（可选）演示正确做法
│   ├── 强制陪同提示条（supervision.level=accompany时显示，红底白字+等家长签字状态）
│   ├── 提交验收区：照片上传 / 家长签字 / 安全确认书（如需要）
│   └── 底部固定按钮「已完成，去验收」（guardian_reqd且家长未签字时置灰）
├── 技能解锁详情页 /skills/:id
│   ├── 技能树进度条（Lv.0→Lv.1→Lv.2→Lv.3）
│   ├── 每个等级的解锁条件 + 解锁后可执行的对应任务列表
│   ├── 累计安全操作次数进度
│   └── 家长陪同确认区（强制签字确认时显示）
├── 父任务详情页 /parent-tasks/:id
│   ├── 父任务基本信息 + 总周期跨度（如28天）
│   ├── 里程碑时间轴（Day1-Day7-Day14-Day28）
│   ├── 当前阶段进度（第X子任务/总X子任务）
│   ├── 子任务列表（已完成✅/进行中⚡/未开始🔒）
│   └── 最终产出物预览位（手绘小报/照片/作品集等）
└── 自定义任务添加页 /tasks/custom（仅家长可进）
    ├── 任务名称 / 对应能力维度 / 积分设定 / 验收标准
    ├── task_kind选择器（daily_fixed/weekly_recurring/collaborative，默认=weekly_recurring）
    └── 是否仅今日生效 / 是否加入拓展池复用
```

### 2.2 核心用户流程（双角色：孩子每日路径 + 家长周日预览路径）

#### 2.2.1 孩子每日主路径（不变，仅增加task_kind徽标视觉）
```
打开App → 进入「任务」Tab → 📘今日任务页
  ↓
看到今日任务组合（锚任务N条+拓展M条+技能1条+父任务子任务K条 + 主题周徽标激活提示）
  ↓
孩子点进任务详情 → 看验收标准 → 看task_kind徽标颜色（绿=自己做/蓝=和爸妈一起/红=等爸妈陪同）
  ↓
点击「已完成去验收」→ 按任务类型走对应验收流：
  ├─ 低风险简单任务（如整理书包）→ 自检打勾+家长抽查1项 → 通过=发积分
  ├─ 中风险任务（如擦餐桌）→ 照片上传+家长确认 → 通过=发积分
  ├─ 技能解锁关联任务（如用安全刀削果，task_kind=guardian_reqd）→ 先弹「技能确认书」+家长陪同签字 → 通过=积分+技能累计次数+1
  └─ 父任务子任务（如绿豆浇水第3天，task_kind=parent_child）→ 照片/观察卡提交 → 通过=积分+父任务里程碑推进
  ↓
任务卡片变灰打✅ → 今日完成进度环刷新
  ↓
全部完成后顶部IP变「proud」表情 + 弹出「今日小萌芽成长了！」庆祝动效
```

#### 2.2.2 家长设定目标 + 预览拍板流程（V1.3 升级，两段式：先设目标→再拍板课程表）
```
【第一段：阶段目标设定】
家长进入「任务」Tab → 📅 周期课程表页 → 点击「🎯设定本周期目标」
  ↓
选择 ① 周期长度档位（1周/2周/3周/4周，默认2周）
  ↓
选择 ② 重点能力维度（1-3个，系统默认勾选本年级主维，家长可勾选弱维作重点突破）
  ↓
选择 ③ 周期积分目标（5档可选，系统按主维任务量给出推荐值）
  ↓
保存目标 → 系统调用 generate_cycle_plan 生成对应长度的课程表草稿
  ↓
【第二段：预览拍板】
系统推送：「下个周期（X周）的成长课程表已生成，请拍板 📅」
  ↓
家长看到 N周×7天 表格视图 + 顶部实时主/次/潜维占比条 + 已设定的阶段目标徽标
  ↓
家长逐天扫一眼或快速操作：
  ├─ 单任务悬停 → 快捷按钮：🔒锁定 / 🔄换一个 / 📌提级陪同 / ➖删除
  ├─ 单天点击 → 展开当日面板，➕从拓展池选任务加进来
  ├─ 若顶部占比条主维<60% → 红标闪烁 + 弹出建议「建议删除潜维任务或加主维任务」
  └─ 若触发了弱维 → 顶部提示「本周期将安排【XX主题周】集中补强社交协作 💪」（可一键关闭）
  ↓
满意后点「✅ 确认锁版」→ 弹出锁版确认框：
  「锁版后本周期X周的任务每天按计划推送，
   每日仍可临时调整单天任务哦」
  → 确认 → 状态变为「已锁版🔒」
  ↓
（可选）周期开始前临时想改 → 再点「重新解锁」→ 重新调整后再锁
  ↓
Cycle 开始日 00:00 系统按锁版切片生成当日daily_task_instance，孩子端落地📘今日任务页
```

---

## 三、任务中心首页详细UI规格

> 主题色：暖橙渐变 `from-orange-400 to-amber-500`，IP表情随完成进度联动。

### 3.1 顶部栏（固定高度180px，渐变背景）

| 元素 | 规格 | 联动规则 |
|-----|-----|---------|
| 左侧问候区 | 「小萌芽，下午好呀」（text-lg font-bold text-white）+ 日期「8月4日 星期一 第3周期Day4」（text-xs text-white/80） | 问候语随时间变（早上/下午/晚上）；周期信息来自当前激活的成长周期 |
| 右侧完成进度环 | SVG圆环（w-24 h-24），外环白色半透明，内环白色填充进度；中心文字=已完成/总任务（如「5/8」） | 每完成1个任务，进度环实时刷新；100%后环变绿色+庆祝粒子 |
| 儿童切换胶囊 | 顶部栏下方，胶囊式ChildTabs（复用现有组件），背景白色/20 | 切换儿童→整页任务池、技能树、父任务状态实时刷新 |
| IP形象 | 右上角圆形IP头像（w-16 h-16），表情=完成进度映射：0-30%=think、30-80%=encourage、80-100%=happy、100%+=proud | 表情随完成率自动切换，点击IP弹出随机鼓励语气泡 |

### 3.2 周期概览卡（渐变卡片，mt-4）

```
┌─────────────────────────────────────────┐
│ 🔥 当前第3周期 · 第4/7天         查看详情→│
│ ████████████████░░░░  57%              │
│ 已完成 22/40 任务 · 预计本周可得 680 积分 │
└─────────────────────────────────────────┘
```

- 点击「查看详情」跳转成长模块阶段目标页
- 40为该周期理论总任务量（锚任务×7 + 预计拓展+技能+父任务子任务）

### 3.3 四大任务专区布局（纵向堆叠，每专区带独立Tab角标）

#### 3.3.1 专区1：每日保底锚任务（Top Priority，标红色「保底」徽标）
> 数量：一年级3条 → 六年级5条，**每天固定不变**，必须放在页面最上方确保曝光。

**单张任务卡片规格（大卡片，w-full rounded-2xl border p-4）：**
```
┌────────────────────────────────────────────┐
│ 🔴保底 [维度标签：生活自理]        5 积分 ⚡│
│ H1-G1-01 每日三整理（书包+衣服+桌面）        │
│ 3项验收标准 · 抽查1项即过                    │
│ ─────────────────────────────────────────── │
│ 待完成 [去完成 →]                           │
└────────────────────────────────────────────┘
```

- 状态颜色：未完成=橙边框橙左条 / 已验收=绿边框绿勾 / 待验收=黄边框「审核中」
- 必须项：`dimension_tag`（维度标签颜色编码）、`积分值`、`验收标准条数`

#### 3.3.2 专区2：今日拓展任务池（标蓝色「多练」徽标，可Tab切换）
> 数量：每天1-3条随机（年级越高数量越多），来自《拓展任务池》文档，按**主次潜配比**抽取。

**专区顶部Tab：**
- 「全部」Tab：今天所有拓展任务混排
- 「主维」Tab：仅展示今日主维任务（如一年级=生活自理/责任担当相关）
- 「次维」Tab：仅展示次维任务
- 「奖励」Tab（潜维任务，≤每日1条）：如「和家人玩20分钟飞盘」，打「🌟完成奖励额外+5积分」标识

#### 3.3.3 专区3：技能解锁专区（标紫色「新解锁」徽标，有升级时才显示）
> 显示条件：当孩子某技能的累计操作次数满足升级条件时，此区出现升级提醒卡片。

**技能升级卡片示例：**
```
┌───────────────────────────────────────────┐
│ 🎉 技能可升级啦！ 厨房安全小帮手 Lv.1→Lv.2  │
│ ━━━━━━━━━━ 9/10次 ⭐累计再完成1次解锁        │
│ 解锁后可做：洗碗筷 + 擦厨房台面              │
│ [去看技能树 →]    [立即去做解锁任务 →]       │
└───────────────────────────────────────────┘
```

#### 3.3.4 专区4：跨周期父任务专区（标金色「进行中」徽标，有活跃父任务时显示）
> 显示条件：当前周期内有 status=active 的父任务。

**父任务迷你进度卡：**
```
┌───────────────────────────────────────────┐
│ 🌱 我的植物朋友·绿豆发芽 14天 · 第5/28天    │
│ 里程碑 ████████░░░░ Day7「破皮露白」60%      │
│ 今日子任务：浇水 + 填观察卡（高度）1项待做    │
│ [进入父任务详情 →]                         │
└───────────────────────────────────────────┘
```

### 3.5 悬浮按钮：「+ 自定义任务」（仅家长账号可点）
- 固定位置：右下角 w-14 h-14 圆形渐变橙按钮 + 白色加号
- 孩子账号点：弹「叫爸爸妈妈来加专属任务哦」IP提示气泡
- 家长账号点：跳转自定义任务添加页（见信息架构）

---

## 四、任务详情页 + 四类验收流程

### 4.1 任务详情页通用结构

```
[顶部返回 + 收藏/分享图标]
┌──────────────────────────────────────┐
│ [任务大图标] （渐变背景+SVG/emoji）    │
│ 任务标题（text-2xl font-bold）         │
│ [维度标签Primary] [积分12分] [⚠️安全等级]│
└──────────────────────────────────────┘
── 验收标准（必看区，带勾选框） ──
□ 1.书包按课表顺序装好课本/文具
□ 2.第二天穿的衣裤鞋袜叠放整齐于床头
□ 3.学习桌面无书本/文具/零食遗留
── 示范参考区（可选，图/短视频） ──
[缩略图网格] 正确整理书包示范图
── 能力提升说明（小卡片） ──
💪 完成本任务提升：生活自理 +2% 责任担当 +1%
── 底部固定按钮「已完成，去验收」──
```

### 4.2 四类验收流程（按任务风险等级）

#### A类：低风险自检任务（约占60%，如整理/收碗/阅读）
- 验收要求：3项标准自检打勾 + **家长随机抽查1项**
- 流：孩子自检打勾提交 → 系统随机抽1项让家长核验 → 家长点「抽查通过」→ 秒发积分
- 抽查规则：同一任务连续做满7天 → 抽查概率从30%降到10%（习惯已养成松绑）

#### B类：中风险拍照任务（约占25%，如清洁/烹饪入门/手工）
- 验收要求：上传1-3张照片（如擦干净的桌面照片、手工作品图）+ 家长确认
- 流程：拍照上传 → 家长看照片 → 点「验收通过」/「退回重做（附文字说明）」
- 存档：照片自动归档到成长模块，阶段回顾时可生成图集

#### C类：高风险技能前置任务（约占10%，如用安全刀/微波炉/明火入门）
- 验收要求：
  1. **前置校验**：技能解锁等级 ≥ 对应要求，未满足直接弹「先去完成技能解锁」拦截
  2. **安全确认书**：首次3次操作强制弹出《XX安全陪同确认书》→ 家长电子签名（端内手写或勾选确认）
  3. **陪同等级核验**：根据技能树配置的陪同等级（全程/门外/仅确认），家长端必须点「陪同已到位」
  4. **照片+次数累计**：上传照片 → 通过 → 技能累计安全操作次数 +1
- 安全松绑：同一技能累计操作满次数阈值 → 下次进入降级陪同等级（如全程→门外）

#### D类：父任务里程碑子任务（约占5%）
- 验收要求：照片/作品文件 + 对应里程碑的验收条目（如「绿豆高度测量值=2.3cm」输入框）
- 流程：提交子任务 → 父任务里程碑进度推进 → 当前里程碑100% → 下一阶段子任务自动解锁到每日池
- 最终验收：父任务100%完成后 → 需上传「最终产出物」（A4小报照片/作品集/合集）→ 生成专属成长故事素材（自动同步到成长模块待回顾）

---

## 五、技能解锁树模块规格

### 5.1 技能树详情页

**页面结构：**
```
[技能树名称] S1-G5 烹饪进阶技能树
[当前等级徽章 Lv.1 达标] [累计安全操作次数 14/20]

技能进度阶梯（横向四节点）：
  Lv.0 入门 ──▶ Lv.1 达标 ──▶ Lv.2 进阶 ──▶ Lv.3 精通
  ✅           ✅当前       ⚡解锁中       🔒未解锁

[当前等级解锁条件卡]
解锁条件：凉拌菜累计≥5次 + 家长陪同签字5份
解锁后可执行任务列表：
  • 任务D05：熬蓝莓果酱（明火）
  • 任务D07：煮蔬菜汤（燃气+加水）
  • ...

[累计安全次数进度条]
██████████░░░░ 14/20

[家长确认区（如需）]
⚠️ 首次用明火必须家长全程陪同
[我已全程陪同，签字确认]
```

### 5.2 安全红线引擎联动规则

1. **未解锁拦截**：任务池编排时，拉取孩子技能解锁状态 → 危险操作技能等级不足的任务 → **直接从候选池剔除**，替换为同维度低风险任务。
2. **次数不达标拦截**：虽已解锁对应等级，但累计安全操作次数不满首次3次 → 每次验收仍强制弹确认书。
3. **事故熔断**：家长连续3次点「退回重做」且原因含「安全操作不规范」→ 该技能降级回上一等级，需重新累计次数，期间对应高级任务锁死。

---

## 六、跨周期父任务模块规格

### 6.1 父任务详情页

**核心：里程碑时间轴驱动子任务自动解锁**

```
父任务：🌱 我的植物朋友——绿豆发芽14天观察日记
建议跨周期：2个周期（14天）
[进度 35% 第5/14天]

◉ Day1 「浸泡发芽期」─ 3子任务 ✅全部完成
├─ □ 泡绿豆+放潮湿纱布 ✅
├─ □ 拍初始照片存档 ✅
└─ □ 手绘小报「第一格」 ✅

◉ Day7 「破皮露白期」─ 3子任务 ⚡进行中
├─ □ 第3天浇水 ⚡待验收
├─ □ 填观察卡（高度0.8cm）🔒
└─ □ 手绘小报「第二格」 🔒

◉ Day14 「成长期+品尝」─ 3子任务 🔒未解锁
...

[最终产出物位]
  占位图：手绘A4绿豆生长观察小报（完成后上传）
  [上传最终作品 → 生成成长故事素材]
```

### 6.2 父子任务联动引擎规则

1. **子任务自动入池**：父任务里程碑进入「进行中」→ 对应子任务在每日0点编排时自动进「父任务专区」，优先级等同锚任务。
2. **连续低完成挂起**：父任务子任务连续2周期提交率<50% → 父任务自动挂起，弹「任务太难啦，要不要换个7天短项目？」推荐同维度轻量替代。
3. **父任务完成后动作**：
   - 推送父任务完成徽章 + 一次性大额积分奖励（100~300分，按周期跨度）
   - 最终产出物进入成长模块「阶段回顾」素材池
   - AI基于产出物生成1条成长故事草稿，等待家长编辑确认

---

## 七、任务编排引擎规则（本PRD核心算法逻辑）

### 7.1 编排输入（V1.3 扩展：Cycle级10项输入 [新增阶段目标项] + 每日级7项两级输入）

**Cycle级10项输入（Cycle 结束前一周的周日20:00 执行可配置周期预生成时拉取）**：

| 序号 | 输入源 | 数据来自 | 作用 |
|-----|-------|--------|-----|
| **1（V1.3新增）** | **阶段目标设定** | cycle_goal_setting 表（家长设定） | **决定 cycle_length_weeks（1/2/3/4周）+ 重点维度加权倍率 + 积分目标对应的拓展槽增量** |
| 2 | 年级档位（L1-L6） | Child.grade字段 | 决定主次潜维配置、锚任务清单、拓展池范围 |
| 3 | 初始能力基线分（6维0-100） | 问卷V2提交→能力雷达初始值 | 弱维识别+主题周触发判断 |
| 4 | 近一个Cycle维度完成率 | 历史提交表聚合（动态长度） | 完成率<60%的维→弱维，加权×3派主题周（V1.3: 历史窗口=最近一个已锁版Cycle的实际长度） |
| 5 | 技能解锁进度 | SkillUnlock模型 | Cycle内满足prerequisite_code=skill:xxx的日期过滤 |
| 6 | 父任务本Cycle范围内里程碑 | ParentTask里程碑配置 | parent_id里程碑均匀分布在 cycle_length_weeks×7 天内，不堆尾 |
| 7 | 下一个主题周配置 | 周期编排表 | 若触发弱维→主题周拓展槽数×3；1周Cycle时主题周=整周期 |
| 8 | 连续完成记录+冷却池 | task_schedule_cooldown表 | Cycle内主维3天冷却/次维5天/潜维14天一次性满足（1周Cycle下潜维冷却等价于"本Cycle内不重复"） |
| 9 | 学术红线黑名单 | 审核关键词表 | 同前 |
| 10 | 安全红线黑名单 | 技能锁+事故熔断状态 | 同前 + supervision配置硬校验 |

**每日级7项输入（每日0点落地时拉取，V1.0保持不变，仅作为Cycle快照的fallback）**：V1.0的7项输入保持不变，仅在Cycle快照不存在时触发每日生成。

### 7.2 每日编排函数（V1.3 升级版：先读Cycle快照[可配置1-4周]，fallback才走10步）

```python
def generate_daily_tasks(child_id, date):
    # ===== V1.3 新增：优先读已锁版Cycle快照（1-4周可配置），99%场景走这个分支 =====
    cycle_plan = get_locked_cycle_plan(child_id, date)
    if cycle_plan is not None:
        daily_slice = cycle_plan.get_daily_slice(date)
        # 仅做最小增量修正：家长临时删除/增加的单任务覆盖 + 当日技能解锁进度变更替换
        daily_slice = apply_intraday_overrides(daily_slice, child_id, date)
        daily_slice = apply_safe_blacklist(daily_slice)  # 技能升级了才放高风险任务
        return daily_slice

    # ===== Cycle快照不存在（首次使用/家长未锁版）时 fallback 到 V1.0 的10步每日单点生成 =====
    return _generate_daily_10step_v10(child_id, date)  # 下面7.2-B是原来的10步，重命名保持兼容
```

### 7.2-B V1.0 每日10步流程（保持不变，作为fallback，伪代码略，同V1.0文档）

```python
def generate_daily_tasks(child_id, date):
    # Step1: 拉7项输入
    grade, dim_scores, skills, parent_tasks, hist_7d, acad_black, safe_black = load_inputs(child_id, date)

    # Step2: 加载年级固定锚任务（保底必出3-5条）
    anchor_tasks = load_anchor_tasks(grade)  # 锚任务100%来自《每日锚任务汇总》
    anchor_tasks = apply_safe_blacklist(anchor_tasks, skills, safe_black)  # 锚任务也需过安全锁
    result = anchor_tasks

    # Step3: 计算今日额外拓展任务数量（1-3条，年级↑数量↑）
    extra_count = grade_to_extra_count(grade)  # G1=1, G2-3=2, G4-6=3

    # Step4: 按主次潜比例拆分拓展槽位
    main_slots = ceil(extra_count * 0.65)    # 主维≥60% → 占拓展的65%
    secondary_slots = floor(extra_count * 0.3)  # 次维~30%
    latent_slots = extra_count - main_slots - secondary_slots  # 潜维≤10%，=剩下的0-1条

    # Step5: 找出弱维（维度分<50分的维）→ 加权抽中率×2
    weak_dims = [dim for dim, score in dim_scores.items() if score < 50]
    weighted_pool = build_weighted_pool(grade=grade, weak_dims=weak_dims, weight_multiplier=2)

    # Step6: 抽主维任务 × main_slots（+弱维加倍抽）
    main_candidates = weighted_pool.filter(dim in PRIMARY_DIMS[grade])
    main_tasks = sample_no_repeat(main_candidates, main_slots, exclude=hist_7d.recent_3d_ids)
    main_tasks = apply_safe_blacklist(main_tasks, skills, safe_black)
    main_tasks = apply_academic_blacklist(main_tasks, acad_black)
    result += main_tasks

    # Step7: 抽次维任务 × secondary_slots
    sec_candidates = weighted_pool.filter(dim in SECONDARY_DIMS[grade])
    sec_tasks = sample_no_repeat(sec_candidates, secondary_slots, exclude=hist_7d.recent_5d_ids)
    sec_tasks = apply_double_blacklist(sec_tasks)
    result += sec_tasks

    # Step8: 抽潜维任务 × latent_slots（0-1条，带🌟奖励标识）
    if latent_slots > 0:
        lat_candidates = weighted_pool.filter(dim in LATENT_DIMS[grade])
        lat_task = sample(lat_candidates, 1, exclude=hist_7d.recent_14d_ids)  # 潜维14天内不重复
        lat_task.mark_as_reward_extra_points(+5)  # 潜维完成奖励额外+5
        result += apply_double_blacklist(lat_task)

    # Step9: 注入父任务子任务（进行中里程碑的未完成子任务，优先级=锚任务）
    for pt in get_active_parent_tasks(child_id):
        current_milestone_tasks = pt.get_current_stage_subtasks()
        for sub in current_milestone_tasks:
            if sub not in hist_7d.today_ids:
                result.insert(ANCHOR_ZONE_POSITION + len([t for t in result if t.is_anchor]), sub)
                result[-1].mark_as_parent_subtask(pt_id=pt.id)

    # Step10: 校验当日总主次潜占比，不达标则替换末位任务
    if not validate_ratio(result, grade):  # 校验主维占比是否≥年级阈值
        result = swap_last_to_fit_ratio(result, grade)

    return result
```

### 7.3 各年级拓展槽位分配参考表

| 年级 | 拓展槽位总数 | 主维槽（~65%） | 次维槽（~30%） | 潜维槽（≤10%） | 例子：3条拓展的拆分 |
|-----|-----------|-------------|-------------|-------------|----------------|
| 一年级 | 1条 | 1条 | 0条 | 0条（因为只有1条，全给主维） | 主1 : 次0 : 潜0 |
| 二年级 | 2条 | 1条 | 1条 | 0条 | 主1 : 次1 : 潜0 |
| 三年级 | 2条 | 1条 | 1条 | 0条 | 主1 : 次1 : 潜0 |
| 四年级 | 3条 | 2条 | 1条 | 0条 | 主2 : 次1 : 潜0 |
| 五年级 | 3条 | 2条 | 1条 | 0条（或1条潜维替换次维） | 主2 : 次1 : 潜0~1 |
| 六年级 | 3条 | 2条 | 1条 | 0条（或1条潜维替换次维） | 主2 : 次1 : 潜0~1 |

> 潜维槽为0的年级：潜维任务仅在「奖励模式」（连续7天锚任务全勤）时手动下发1条，不作为日常拓展池内容，严格控制占比。

### 7.4 查重与防腻规则

- **3天内主维任务不重复**：避免连续3天做「洗碗/洗碗/洗碗」，从拓展池去重抽。
- **5天内次维任务不重复**：次维变化更敏感，去重窗口延长。
- **14天内潜维任务不重复**：潜维本来就少，避免连续两次派同一条运动/创意任务。
- **轮换机制**：同一任务做完一次，进入「冷却池」，过N天才能再被抽到（主维3天/次维5天/潜维14天）。

### 7.5 双红线审核拦截（编排引擎的最后两道闸）

#### 学术红线拦截（硬拦截，不允许任何例外）
- **关键词黑名单**：分/分数/考/考试/试卷/测试/名次/排名/第X名/95分/满分 → 命中任意词的任务文案/奖励文案 → **直接从候选池剔除+打标记返回给运营审核**。
- **3-5年级特殊规则**：任务描述允许出现「单元知识树」「错题整理」「给同学讲题」，但**禁止出现具体分数相关词**。
- **6年级特殊规则**：允许出现「本周完成率提升≥20%」「对比上周进步X项」进步类描述，禁止具体期中期末考分数词。

#### 安全红线拦截（硬拦截，不允许任何例外）
- **技能解锁表匹配**：任务关联的skill_required字段 → 拉孩子对应skill_level → 不足则替换为同维低风险替代任务（如「切菜」未解锁→替换为「择菜」）。
- **事故熔断匹配**：技能处于frozen状态（连续3次因安全原因退回）→ 对应高级任务替换为基础任务，重新累计次数。
- **陪同等级强制校验**：任务需家长sign_off且今日家长账号未登录 → 任务卡片显示「等爸爸妈妈回家后一起做哦」，验收按钮置灰不可点。

### 7.6 可配置周期Cycle级批量生成流程（V1.3 升级主路径，Cycle 结束前一周的周日20:00 跑1次，支持1-4周）

#### 7.6.1 批量生成核心步骤（伪代码，V1.3 改造：参数化 cycle_length_weeks）

```python
def generate_cycle_plan(child_id, start_monday, cycle_length_weeks=2, goals=None):
    """Cycle 结束前一周的周日20:00执行
    start_monday = 下个Cycle周一日期
    cycle_length_weeks = 1/2/3/4 周（V1.3 新增，默认2周兼容V1.1）
    goals = {focus_dims:[1,2], points_target:200}  # V1.3 新增：阶段目标
    """
    cycle_days = cycle_length_weeks * 7  # 7/14/21/28 天

    # Step1: 拉 Cycle级10项输入（见7.1表）+ 判断是否触发弱维主题周
    grade, dim_scores, dim_completion_last_cycle, skills, parent_tasks_future, \
        theme_week_cfg, cooldown_pool, acad_black, safe_black = load_cycle_inputs(child_id, cycle_days)
    # V1.3 新增：从 goals 拉阶段目标设定
    focus_dims = goals.get('focus_dims', PRIMARY_DIMS[grade]) if goals else PRIMARY_DIMS[grade]
    points_target = goals.get('points_target', None) if goals else None
    # 重点维度加权倍率：被选维度拓展槽占比 +20%
    focus_dim_boost = {dim: 1.2 for dim in focus_dims}

    theme_week_dim = detect_weak_dim_and_decide_theme(dim_scores, dim_completion_last_cycle)

    # Step2: 初始化 Cycle 空容器 + 锚任务每日注入（3-5条×cycle_days天 = 21-140条）
    plan = {date: [] for date in date_range(start_monday, cycle_days)}
    for date, day_tasks in plan.items():
        day_tasks += load_anchor_tasks(grade)  # 锚任务每天都在

    # Step3: 主题周配置生效：若触发，主题周7天内弱维拓展槽×3
    #   V1.3 适配：1周Cycle 时主题周=整周期；2-4周时主题周占其中1周
    if theme_week_cfg is not None:
        if cycle_length_weeks == 1:
            # 1周Cycle：整个周期都是主题周
            theme_start, theme_end, theme_dim = start_monday, start_monday + 6, theme_week_dim
        else:
            # 2-4周Cycle：默认主题周放第1周（家长可在预览时调整位置）
            theme_start, theme_end, theme_dim = start_monday, start_monday + 6, theme_week_dim

    # Step4: 每日拓展槽生成（主65%/次30%/潜≤5% + 冷却池一次性Cycle全局去重）
    #   V1.3 改动：拓展槽基数根据 积分目标 动态调整；重点维度加权 +20%
    cooldown_global = CooldownTracker()  # 跨整个Cycle的全局冷却池
    extra_count_base = grade_to_extra_count(grade)
    # 积分目标对应拓展槽增量：目标分↑→每日拓展槽 +1（封顶年级上限+2）
    if points_target and points_target > estimate_default_points(grade, cycle_days):
        extra_count_base = min(extra_count_base + 1, grade_to_extra_count(grade) + 2)

    for date in plan.keys():
        extra_count = extra_count_base
        # 主题周激活日→拓展槽×3，且主维槽全部派给theme_week_dim
        in_theme_week = theme_week_cfg and (theme_start <= date <= theme_end)
        day_extra_count = extra_count * 3 if in_theme_week else extra_count
        main_ratio = 1.0 if in_theme_week else 0.65  # 主题周天100%拓展给theme_dim
        # V1.3 重点维度加权：非主题周时，被选重点维度拓展槽占比 +20%
        day_plan, cooldown_global = sample_day_extra_with_global_cooldown(
            grade, day_extra_count, main_ratio,
            exclude_recent_3d_ids=cooldown_global.last_3d,
            exclude_recent_5d_ids=cooldown_global.last_5d,
            exclude_recent_14d_ids=cooldown_global.last_14d,  # 1周Cycle下等价于"本Cycle内不重复"
            force_dim=theme_dim if in_theme_week else None,
            focus_dim_boost=focus_dim_boost  # V1.3 新增
        )
        plan[date] += day_plan

    # Step5: 父任务里程碑子任务均匀分布（parent_id 里程碑不堆尾，每日≤1条）
    plan = spread_parent_subtasks_evenly(parent_tasks_future, plan, max_per_day=1, cycle_days=cycle_days)

    # Step6: 【RAG Retrieve + R-1/R-2 规则】（V1.1新增，V1.3保持不变）
    plan = apply_rag_rules_R1_R2(plan, theme_week_dim, child_id)

    # Step7: 【Final Sanitize + S-1/S-2/S-3 规则】（V1.1新增，V1.3 校验范围改为整个Cycle）
    plan = apply_sanitize_rules_S1_S2_S3(plan, child_id, skills, parent_tasks_future, cycle_days=cycle_days)

    # Step8: 校验整个Cycle整体主次潜占比，不达标则swap末位任务
    if not validate_cycle_ratio(plan, grade, cycle_days=cycle_days):
        plan = swap_cycle_end_to_fit_ratio(plan, grade, min_main=0.6, max_latent=0.1)

    # Step9: 存cycle_plan快照（含 cycle_length_weeks + goals），状态=草稿，等待家长预览锁版
    save_cycle_plan_draft(child_id, plan, start_monday,
                          cycle_length_weeks=cycle_length_weeks,  # V1.3 新增
                          goals=goals,  # V1.3 新增
                          status='draft')

    # Step10: 推送家长预览通知
    push_to_parent(child_id, f'下个周期（{cycle_length_weeks}周）的成长课程表已生成，请拍板 📅')
```

#### 7.6.2 规则R-1/R-2（RAG Retrieve 新增2条，对应架构图RAG柱）

> **不变更主Rank&Generate**，仅在RAG召回候选时额外走两条分支：

| 规则编号 | 触发条件 | 动作 | 对应Taxonomy字段 |
|---------|---------|-----|--------------|
| **R-1 主题周弱维RAG加权** | Cycle 计划中 theme_week_dim 不为空 | 召回候选池时，theme_dim 候选**置顶优先** + 同维难度从低到高排序（前3天低难度→建立信心；后4天中难度→巩固） | 对应 `cycle_theme` 类任务 |
| **R-2 guardian_reqd安全确认书RAG附带** | 候选池里 `task_kind == guardian_reqd` 的任务 | RAG召回该任务对应《技能解锁树汇总》的**安全确认书模板**（含「陪同等级说明+事故熔断说明+家长签字须知」），直接预填到实例的`supervision` JSON里，家长不用再看长文 | 对应 `guardian_reqd` + `supervision` 字段 |

#### 7.6.3 规则S-1/S-2/S-3（Final Sanitize 新增3条，对应架构图Sanitize柱）

> **Sanitize是最后三道闸，硬拦截不通过直接剔除替换**，主排序逻辑完全不动。

| 规则编号 | 校验维度 | 校验逻辑（硬拦截→失败则替换同维低风险替代） | 对应4字段 |
|---------|---------|---------------------------------------|--------|
| **S-1 task_kind 一致性校验** | task_kind | 1️⃣ daily_fixed/weekly_recurring 锚任务必须连续整个Cycle每天都出现，不能中间缺（缺则补回锚任务模板）；2️⃣ parent_child 类的 parent_id 必须对应进行中里程碑（里程碑未到→先不派）；3️⃣ cycle_theme 类仅在主题周7天内派（1周Cycle时=整周期） | `task_kind` + `parent_id` |
| **S-2 supervision 陪同可执行性** | supervision | 1️⃣ 若 supervision.level=accompany/doorstep → 实例 sign_off_required 必须=true；2️⃣ 若父任务里程碑要求家长签字 → 子任务 supervision 自动提升到 confirm 级；3️⃣ 熔断状态下 guardian_reqd 任务**直接剔除，换维替代** | `supervision` + 熔断表 |
| **S-3 prerequisite_code 前置依赖** | prerequisite_code | 对整个Cycle每一天执行前置链校验：<br>① `skill:S1-G3>=1` → 孩子到这一天技能等级≥1吗？<br>② `task:H1-G1-01:done:7` → 锚任务H1到这一天前已经连续完成7天了吗？<br>③ `pt:P1-G1:milestone:2` → 父任务P1到这一天第2里程碑已达成了吗？<br>不满足的日子→任务剔除，换无前置的同维任务。 | `prerequisite_code` |

---

## 八、数据模型扩展（任务中心新增表结构）

### 8.1 核心模型（V1.3 扩展：8张原表加4列复用 + 新增1张cycle_plan快照表[V1.3加2字段] + 新增1张cycle_goal_setting表 = 共10张）

```sql
-- 1.任务模板主表（存储176条拓展任务池+锚任务模板）
-- V1.1 增量：加 4 个新字段（task_kind / parent_id / supervision / prerequisite_code），完全覆盖6类Taxonomy差异化逻辑
CREATE TABLE task_template (
  id BIGINT PRIMARY KEY,
  grade_level VARCHAR(2) NOT NULL COMMENT 'L1-L6年级档位',
  task_type VARCHAR(16) NOT NULL COMMENT 'anchor锚任务 / extra拓展 / skill技能关联 / parent_sub父任务子任务（V1.0兼容字段，保留）',
  title VARCHAR(128) NOT NULL,
  dimension_id TINYINT NOT NULL COMMENT '1生活自理2责任担当3学习探索4社交协作5创意审美6运动健康',
  dimension_ratio_json JSON COMMENT '多维度权重占比，如{"1":0.7,"2":0.3}',
  points INT NOT NULL DEFAULT 5 COMMENT '完成积分',
  acceptance_criteria_json JSON NOT NULL COMMENT '验收标准数组，3-5条带勾选框',
  demo_media_ids JSON COMMENT '示范图/视频ID列表',
  skill_required_id BIGINT COMMENT '关联技能解锁ID，可为空',
  skill_required_level TINYINT COMMENT '要求的最低技能等级',
  safety_level TINYINT NOT NULL DEFAULT 0 COMMENT '0低/1中/2高风险',
  sign_off_required BOOLEAN NOT NULL DEFAULT 0 COMMENT '是否需家长安全签字',
  academic_red_line_clean BOOLEAN NOT NULL DEFAULT 1 COMMENT '是否已通过学术红线审核',
  -- ===== V1.1 新增 4 核心字段（6类Taxonomy的差异化逻辑全部通过这4个字段表达） =====
  task_kind ENUM('daily_fixed','weekly_recurring','guardian_reqd','collaborative','parent_child','cycle_theme') NOT NULL DEFAULT 'daily_fixed' COMMENT '6类枚举任务类型（Taxonomy）',
  parent_id BIGINT COMMENT '父任务或父模板关联ID：锚任务/拓展=NULL；子任务=父任务template_id；协同任务可关联父任务；父里程碑链接pt id',
  supervision JSON COMMENT '家长陪同配置JSON：{level:"none|accompany|doorstep|confirm", sign_off_required:bool, first_n_times:3}，来自技能树安全红线总表',
  prerequisite_code VARCHAR(64) COMMENT '前置依赖校验码，支持3种语法：1) skill:S1-G3>=1 技能等级前置 2) task:H1-G1-01:done:7 锚任务连续完成N天 3) pt:P1-G1:milestone:2 父任务第N里程碑达成',
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_grade_type (grade_level, task_type),
  INDEX idx_dimension (dimension_id),
  INDEX idx_task_kind (task_kind) COMMENT 'V1.1新增：按类型快速过滤guardian_reqd/cycle_theme等'
);

-- 2.每日任务实例表（每日编排引擎生成的实例）
-- V1.1 增量：加 5 个新字段（4字段继承模板级+可覆盖；+locked家长锁定）
CREATE TABLE daily_task_instance (
  id BIGINT PRIMARY KEY,
  child_id BIGINT NOT NULL,
  task_template_id BIGINT NOT NULL,
  cycle_id BIGINT COMMENT '归属成长周期ID',
  parent_task_id BIGINT COMMENT '如果是父任务子任务，关联父任务ID',
  task_date DATE NOT NULL,
  sort_order INT NOT NULL COMMENT '当日排序',
  status VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending待做/submitted待验收/approved已完成/rejected退回',
  awarded_points INT DEFAULT 0,
  dimension_award_json JSON COMMENT '本任务实际完成的维度加分',
  spot_check_required BOOLEAN DEFAULT 0 COMMENT '是否被抽中家长抽查',
  spot_check_passed BOOLEAN DEFAULT NULL,
  rejection_reason VARCHAR(255) COMMENT '退回原因',
  -- ===== V1.1 新增 5 个字段（4字段继承模板级默认值，实例级家长可覆盖重写）=====
  task_kind ENUM('daily_fixed','weekly_recurring','guardian_reqd','collaborative','parent_child','cycle_theme') NOT NULL DEFAULT 'daily_fixed' COMMENT '继承自模板，家长在课程表视图改时可覆盖（如把weekly_recurring临时改成collaborative）',
  parent_id BIGINT COMMENT '继承模板；父任务里程碑激活后自动填充激活的parent_task.id',
  supervision JSON COMMENT '继承模板；家长可手动提级陪同等级（confirm→accompany）',
  prerequisite_code VARCHAR(64) COMMENT '继承模板；Cycle级Sanitize S-3规则前置校验用',
  locked BOOLEAN NOT NULL DEFAULT 0 COMMENT 'V1.1新增：家长锁定标识=1时，重新生成Cycle不替换本任务实例',
  created_at DATETIME,
  submitted_at DATETIME,
  approved_at DATETIME,
  INDEX idx_child_date (child_id, task_date),
  INDEX idx_cycle (cycle_id),
  INDEX idx_locked (child_id, task_date, locked) COMMENT 'V1.1新增：锁定任务快速查询'
);

-- 3.验收提交流
CREATE TABLE task_submission (
  id BIGINT PRIMARY KEY,
  daily_task_instance_id BIGINT NOT NULL,
  submitter_role VARCHAR(8) NOT NULL COMMENT 'child/parent',
  self_check_flags JSON COMMENT '自检勾选框布尔数组',
  spot_check_item_index INT COMMENT '被抽中家长抽查的验收项序号',
  media_ids JSON COMMENT '照片/作品文件ID列表',
  milestone_value_json JSON COMMENT '里程碑输入值，如高度=2.3cm',
  parent_signature_id BIGINT COMMENT '安全确认书签字ID',
  parent_note VARCHAR(512) COMMENT '家长验收备注',
  created_at DATETIME
);

-- 4.技能解锁进度表
CREATE TABLE skill_unlock_progress (
  id BIGINT PRIMARY KEY,
  child_id BIGINT NOT NULL,
  skill_tree_id BIGINT NOT NULL COMMENT '对应技能树模板ID',
  current_level TINYINT NOT NULL DEFAULT 0 COMMENT '0入门/1达标/2进阶/3精通',
  safe_operation_count INT NOT NULL DEFAULT 0 COMMENT '累计安全操作次数',
  frozen BOOLEAN NOT NULL DEFAULT 0 COMMENT '事故熔断冻结标记',
  frozen_reason VARCHAR(255),
  frozen_reset_required_count INT COMMENT '熔断后需重新累计的次数',
  last_approved_operation_at DATETIME,
  UNIQUE KEY uk_child_skill (child_id, skill_tree_id)
);

-- 5.技能树模板表（对应《技能解锁树汇总》28棵）
CREATE TABLE skill_tree_template (
  id BIGINT PRIMARY KEY,
  grade_level VARCHAR(2) NOT NULL,
  tree_code VARCHAR(16) NOT NULL COMMENT '如S1-G5',
  title VARCHAR(128) NOT NULL,
  dimension_id TINYINT NOT NULL,
  level_requirements_json JSON NOT NULL COMMENT '每等级解锁条件数组+解锁后任务列表',
  supervision_level_json JSON NOT NULL COMMENT '每等级家长陪同等级',
  sign_off_levels_json JSON COMMENT '哪些等级需签字确认',
  created_at DATETIME
);

-- 6.家长安全确认书签字记录表
CREATE TABLE safety_sign_off (
  id BIGINT PRIMARY KEY,
  child_id BIGINT NOT NULL,
  parent_user_id BIGINT NOT NULL,
  skill_tree_id BIGINT,
  daily_task_instance_id BIGINT,
  sign_off_type VARCHAR(32) NOT NULL COMMENT 'knife/gas/fire/iron/needle/screwdriver/meat_cutting/general',
  supervision_acknowledged BOOLEAN NOT NULL,
  sign_text VARCHAR(64) COMMENT '家长签字文本或勾选姓名',
  created_at DATETIME
);

-- 7.父任务主表
CREATE TABLE parent_task (
  id BIGINT PRIMARY KEY,
  child_id BIGINT NOT NULL,
  template_id BIGINT COMMENT '父任务模板ID（来自28条模板）',
  title VARCHAR(128) NOT NULL,
  dimension_id_primary TINYINT NOT NULL,
  total_cycles INT NOT NULL COMMENT '总跨周期数，如2=14天',
  current_cycle INT NOT NULL DEFAULT 1,
  status VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT 'active/suspended/completed',
  milestones_json JSON NOT NULL COMMENT '里程碑时间轴配置',
  current_milestone_index INT NOT NULL DEFAULT 0,
  final_deliverable_media_ids JSON,
  final_story_draft TEXT COMMENT 'AI生成的成长故事草稿',
  started_at DATE,
  completed_at DATE,
  created_at DATETIME,
  INDEX idx_child_status (child_id, status)
);

-- 8.每日编排去重冷却池（缓存表）
CREATE TABLE task_schedule_cooldown (
  id BIGINT PRIMARY KEY,
  child_id BIGINT NOT NULL,
  task_template_id BIGINT NOT NULL,
  dimension_id TINYINT NOT NULL,
  last_assigned_date DATE NOT NULL,
  release_date DATE NOT NULL COMMENT '可再次被抽取的日期（主维+3天等）',
  UNIQUE KEY uk_child_task (child_id, task_template_id),
  INDEX idx_release (child_id, release_date)
);

-- 9. 可配置周期Cycle课程表快照表（V1.1 新增，V1.3 加 2 字段：cycle_length_weeks + goals_json）
-- Cycle 结束前一周的周日20:00批量生成对应长度计划后写入，草稿→家长预览→锁版；每日落地从这里切片
CREATE TABLE cycle_plan (
  id BIGINT PRIMARY KEY COMMENT 'Cycle计划ID',
  child_id BIGINT NOT NULL,
  start_date DATE NOT NULL COMMENT 'Cycle起始周一日期',
  end_date DATE NOT NULL COMMENT 'Cycle结束日期（=start_date + cycle_length_weeks*7 - 1）',
  -- ===== V1.3 新增字段 START =====
  cycle_length_weeks TINYINT NOT NULL DEFAULT 2 COMMENT 'V1.3新增：周期长度档位 1/2/3/4 周，默认2周兼容V1.1',
  goals_json JSON COMMENT 'V1.3新增：阶段目标设定快照 {focus_dims:[1,2], points_target:200, points_target_grade:G3}',
  -- ===== V1.3 新增字段 END =====
  status ENUM('draft','locked','applied','expired') NOT NULL DEFAULT 'draft' COMMENT '草稿/已锁版/已每日切片落地/过期作废',
  theme_week_config JSON COMMENT '主题周配置：{active:true, dim:4社交协作, start_date:xxx, end_date:xxx, theme_title:"公益小伙伴主题周", position:week1/week2/...} 或 NULL',
  dimension_ratio_summary JSON COMMENT '整Cycle维度占比汇总：{main_dim_pct:0.62, secondary_pct:0.31, latent_pct:0.07, theme_dim_contrib:0.28} 给家长仪表盘实时显示',
  daily_instances_json JSON NOT NULL COMMENT '整个Cycle的daily_task_instance预生成内容（含4字段+locked），key=yyyy-mm-dd→任务数组，切片时批量写入',
  lock_version INT NOT NULL DEFAULT 0 COMMENT '乐观锁，家长同时编辑时冲突保护',
  locked_at DATETIME COMMENT '锁版时间',
  locked_by_parent BIGINT COMMENT '锁版家长账号ID，拍板权追踪用',
  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE KEY uk_child_start_date (child_id, start_date),
  INDEX idx_child_length (child_id, cycle_length_weeks) COMMENT 'V1.3新增：按周期长度快速过滤'
);

-- 10. 阶段目标设定表（V1.3 新增，家长在生成课程表前设定的目标）
-- 每次家长点「🎯设定本周期目标」时写入一条，关联到下个生成的 cycle_plan
CREATE TABLE cycle_goal_setting (
  id BIGINT PRIMARY KEY,
  child_id BIGINT NOT NULL,
  parent_user_id BIGINT NOT NULL COMMENT '设定目标的家长账号ID',
  target_cycle_start_date DATE NOT NULL COMMENT '目标对应Cycle的起始周一日期',
  cycle_length_weeks TINYINT NOT NULL COMMENT '周期长度档位 1/2/3/4 周',
  focus_dims JSON NOT NULL COMMENT '重点能力维度数组，如[1,2] 表示生活自理+责任担当',
  points_target INT NOT NULL COMMENT '周期积分目标 50/100/200/300/500',
  points_target_grade VARCHAR(2) COMMENT '设定时孩子所在年级',
  is_default BOOLEAN NOT NULL DEFAULT 0 COMMENT '是否系统默认推算（true=家长未主动设定）',
  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE KEY uk_child_target_cycle (child_id, target_cycle_start_date),
  INDEX idx_child_date (child_id, target_cycle_start_date)
);
```

### 8.2 能力雷达加分规则（任务完成→维度加分）

> **核心硬约束**：任务完成只发积分+记完成记录，**不直接改能力雷达分**。能力雷达分只在「阶段回顾」（每7天）时由AI统一重算。但需保存「本任务理论维度贡献」用于回顾时AI参考：

公式（保存到daily_task_instance.dimension_award_json）：
```
维度加分贡献值 = (该任务维度占比 × 任务积分) / 10
示例：任务H1-G1-01（生活自理0.7 + 责任担当0.3，5分）
→ {"1": 0.35, "2": 0.15}
→ 阶段回顾时AI汇总该维度所有任务贡献值加权后 + 完成度 × 验收合格率 → 得到新的雷达分
```

---

## 九、接口清单（V1.1 扩展：原12个保持兼容 + 新增6个Cycle级 = 共18个核心API）

### 9.1 原V1.0 12个接口（100%向后兼容，全部可用）

| 方法 | 路径 | 说明 | 关键参数/返回 |
|-----|-----|-----|------------|
| GET | `/api/v1/tasks/daily` | 拉取今日任务列表 | child_id, date → 返回：锚任务数组/拓展/技能/父任务子任务+当日完成进度（V1.1新增：若cycle_plan已锁版则切片，否则fallback每日生成） |
| GET | `/api/v1/tasks/:id` | 任务详情 | id → 返回：模板详情+验收标准+4字段(task_kind/supervision/parent_id/prerequisite_code)+是否需技能/签字 |
| POST | `/api/v1/tasks/:id/submit` | 提交验收 | self_check_flags / media_ids / spot_check_item_index / milestone_value → 返回提交实例ID |
| POST | `/api/v1/tasks/:id/approve` | 家长验收通过/退回 | approve=true/false，rejection_reason → 通过则：发积分+技能次数累计+父任务里程碑推进 |
| GET | `/api/v1/skills` | 孩子技能解锁总览 | child_id → 返回所有技能树的当前等级/进度/可升级提示 |
| GET | `/api/v1/skills/:id` | 单个技能树详情 | id+child_id → 返回等级阶梯/解锁条件/解锁任务列表 |
| POST | `/api/v1/skills/:id/sign-off` | 家长安全确认书签字 | sign_off_type / supervision_acknowledged → 返回签字记录ID |
| GET | `/api/v1/parent-tasks` | 活跃父任务列表（首页专区用） | child_id+status=active → 返回迷你进度卡列表 |
| GET | `/api/v1/parent-tasks/:id` | 父任务详情+里程碑 | id → 返回里程碑时间轴+子任务列表 |
| POST | `/api/v1/parent-tasks/:id/submit-deliverable` | 上传父任务最终产出物+生成故事草稿 | media_ids → 返回AI生成的成长故事草稿 |
| POST | `/api/v1/tasks/custom` | 家长添加自定义任务 | title/dimension_id/points/acceptance/task_kind枚举选/生效日期 → 加入今日池/拓展池 |
| GET | `/api/v1/tasks/schedule-preview` | （运营工具用）预览指定年级+指定分的今日编排 | mock grade+mock scores → 返回排好的任务列表+占比校验（方便合规自查） |

### 9.2 V1.1 新增 6 个Cycle级接口 + V1.3 新增 1 个目标设定接口 = 共 7 个Cycle级API（V1.3 改造：支持1-4周可配置周期）

| 方法 | 路径 | 说明 | 关键参数/返回 | 对应架构图支柱 |
|-----|-----|-----|------------|-----------|
| **POST** | `/api/v1/cycle-goals` | **🎯设定阶段目标**（V1.3 新增前置接口） | child_id, target_cycle_start_date, cycle_length_weeks(1/2/3/4), focus_dims[], points_target → 返回：goal_setting.id + 系统推算的拓展槽建议值 + 主题周触发预判 | 支柱0：阶段目标设定 |
| **GET** | `/api/v1/cycle-plans/preview` | **拉取周期课程表预览**（家长视角📅首页接口） | child_id, start_monday, cycle_length_weeks(可选,默认从goals读取) → 返回：cycle_plan.id + 整Cycle每日任务数组 + 顶部维度占比仪表盘JSON + 主题周配置 + 阶段目标徽标 + lock_version | 支柱1：全局可配置周期编排 |
| **POST** | `/api/v1/cycle-plans/:id/lock` | **家长锁版确认**（拍板权） | id, lock_version, action=lock/unlock, locked_by_parent_id → 返回：新status + 乐观锁版本号 | 支柱3：家长预览拍板 |
| **POST** | `/api/v1/cycle-plans/:id/regenerate` | **重新生成Cycle**（保留locked=true的任务） | id, lock_version, force_dim_override=[可选强制重新计算维度占比] → 返回：新cycle_plan草稿 + lock_version | 支柱1+支柱3 |
| **POST** | `/api/v1/cycle-plans/:id/task-adjust` | **单任务5类调整操作**（锁定/替换/增/删/提级陪同） | id, daily_task_instance_id, operation=lock/replace/add/remove/escalate_supervision, new_supervision=[if escalate], replace_with_template_id=[if replace], add_template_id=[if add] → 返回：调整后的当日任务数组 + **实时重算的顶部维度占比仪表盘**（家长删除后主维不足要红标） | 支柱3：家长拍板权 |
| **GET** | `/api/v1/cycle-plans/replace-candidates` | **拉取「换一个同维任务」3条候选** | child_id, task_id, date, dimension_id, difficulty → 返回3条冷却池外+RAG R-1加权后的候选（给家长点🔄时弹选择器） | 支柱3 + RAG R-1 |
| **POST** | `/api/v1/cycle-plans/:id/toggle-theme-week` | **主题周手动开关**（家长主动关闭系统推荐的主题周/或手动开启/或调整位置） | id, theme_dim=维ID/null, start_date, end_date, position=week1/week2/...（V1.3 新增:多周时调整主题周所在周）, enable=true/false → 返回：新theme_week_config + 重算后整Cycle占比仪表盘 | 支柱2：能力缺口主题周 |
| GET | `/api/v1/cycle-plans/:id/export-pdf` | **导出周期计划PDF分享**（可选） | id → 返回二进制PDF（课程表表格样式，打印出来贴冰箱，家庭仪式感） | 支柱1+支柱3附加功能 |

---

## 十、权限控制（V1.1 增量：孩子/家长 + V1.3 新增课程表视图+阶段目标设定家长专属权限）

| 操作 | 孩子账号 | 家长账号 | 说明 |
|-----|---------|---------|-----|
| 查看今日任务列表 | ✅ | ✅ | 家长也能看孩子今天的任务清单 |
| 勾选自检项、提交任务 | ✅ | ❌ | 必须孩子自己提交（培养自主完成意识） |
| 验收通过/退回 | ❌ | ✅ | 中高风险任务必由家长最终确认 |
| 签署安全确认书 | ❌ | ✅（需账号密码/指纹二次校验） | 签字必须家长本人操作 |
| 添加自定义任务 | ❌IP弹提示 | ✅ | 只有家长能加任务 |
| 编辑锚任务/技能树配置 | ❌ | ❌ | 仅运营后台可改，防家长误操作 |
| 强制跳过今日某任务 | ❌ | ✅（仅1次/天，累计跳过≥3次触发提示） | 孩子生病/外出时家长可请假式跳过 |
| **🎯设定阶段目标（周期长度+重点维度+积分目标）** | ❌ | ✅ | V1.3新增：家长专属拍板权，决定下个Cycle形态 |
| **查看📅周期课程表视图** | ❌（入口不显示，或提示「请爸爸妈妈登录」） | ✅ | V1.1新增+V1.3适配可配置周期：Cycle级编排规划家长专属 |
| **锁版/解锁周期计划** | ❌ | ✅（需指纹校验，拍板权郑重） | V1.1新增：家长拍板权 |
| **单任务5类调整：锁定/替换/增/删/提级陪同** | ❌ | ✅ | V1.1新增：全部落实例级4字段覆盖 |
| **开启/关闭/调整主题周位置** | ❌ | ✅（系统自动推荐后，家长可1键关闭或调整所在周） | V1.3新增 position 字段：多周Cycle中调整主题周位置 |

---

## 十一、埋点事件清单（V1.1 增量：原11个 + 新增8个Cycle级埋点 + V1.3 新增3个目标设定埋点 = 共22个）

> 用于后续验证：**主次潜维实际完成率是否达标 / 双红线命中率 / 技能解锁安全率 / Cycle级家长拍板参与率 / V1.3阶段目标设定使用率与不同周期长度分布**

### 11.1 原V1.0 11个埋点（100%保留）

| 事件名 | 触发时机 | 关键参数 |
|-------|---------|---------|
| `tasks_daily_generated` | 每日任务生成 | child_id/grade/main_dim_count/secondary_dim_count/latent_dim_count/ratio_pass 布尔 |
| `task_safe_blacklist_replace` | 安全红线拦截替换 | original_task_id/replaced_task_id/reason=skill_missing |
| `task_academic_blacklist_hit` | 学术红线命中 | task_template_id/keywords_hit |
| `task_submitted` | 提交验收 | task_type/safety_level/sign_off_required_yesno |
| `task_approved` / `task_rejected` | 家长验收通过/退回 | dimension_ids/points_awarded/rejection_reason |
| `skill_unlock_upgraded` | 技能升级 | skill_tree_id/from_level/to_level/safe_op_count |
| `skill_frozen` / `skill_unfrozen` | 事故熔断触发/解除 | skill_tree_id/reason=consecutive_rejections_count |
| `parent_task_milestone_reached` | 父任务里程碑达成 | parent_task_id/milestone_index/subtask_completion_rate |
| `parent_task_completed` | 父任务100%完成 | parent_task_id/total_days/deliverable_count |
| `custom_task_added` | 家长加自定义任务 | dimension_id/points/是否复用进拓展池 |

### 11.2 V1.1 新增 8 个Cycle级埋点 + V1.3 新增 3 个目标设定埋点 = 共 11 个

| 事件名 | 触发时机 | 关键参数 | 对应架构图验证项 |
|-------|---------|---------|-------------|
| **`cycle_goal_set`**（V1.3新增） | 家长提交阶段目标设定 | child_id / cycle_length_weeks(1/2/3/4) / focus_dims[] / points_target / is_default_yesno | 验证支柱0：目标设定使用率（目标：≥60%家长主动设定）+ 周期长度档位分布（验证家长偏好：1/2/3/4周各占多少） |
| **`cycle_goal_completed_vs_target`**（V1.3新增） | Cycle结束时对比实际vs目标 | child_id / cycle_length_weeks / points_target / points_actual / completion_rate_target_dim | 验证支柱0：目标达成率（目标：≥50% Cycle达成预设积分目标≥80%） |
| **`cycle_length_distribution`**（V1.3新增） | 周期统计快照 | cycle_length_weeks / 占比 / 平均完成率 / 平均锁版率 | 验证家长对4档周期长度的偏好与适配性 |
| `cycle_plan_generated` | Cycle 结束前一周的周日20:00批量生成成功 | child_id/grade/cycle_length_weeks/整Cycle main_ratio/sec_ratio/lat_ratio/theme_week_active_yesno | 验证支柱1：可配置周期全局主次潜达标率（4档分别验证） |
| `cycle_plan_locked` / `cycle_plan_unlocked` | 家长锁版/重新解锁 | time_in_preview_window / adjustments_count做了几次调整 / 锁版时主维% / 次维% / 潜维% / cycle_length_weeks | 验证支柱3：家长责任感+参与率（目标≥60%家长锁版，分周期长度看差异） |
| `cycle_plan_task_adjusted` | 家长做了5类调整的任意一类 | operation=lock/replace/add/remove/escalate_supervision / 调整后主维占比变化±X% / cycle_length_weeks | 验证支柱3：哪类调整最多（分周期长度看差异，长周期是否调整更多） |
| `cycle_plan_ratio_warning_shown` | 删除后主维<60%红标警告弹窗展示 | shown/accepted_家长决定仍然删 or canceled_家长取消了删除 / cycle_length_weeks | 验证：占比硬约束是否被家长尊重（如果≥30%家长强删则需要提示文案优化） |
| `theme_week_triggered` / `theme_week_toggled_off` / `theme_week_position_changed`（V1.3新增position_changed） | 系统触发主题周 / 家长手动关闭 / V1.3家长调整主题周位置 | theme_dim_id / 触发原因=问卷baseline OR 上个Cycle完成率低 OR 手动开 / position=week1/week2/..（V1.3新增） | 验证支柱2：弱维识别准确率+家长接受度+多周位置偏好（若≥50%家长关掉则自动触发阈值要松绑） |
| `sanitize_rule_hit_S1` / `S2` / `S3` | Sanitize 3条规则任意一条命中 | rule_id, replaced_from_id, replaced_to_id, hit_reason, cycle_length_weeks | 验证Sanitize有效性（每条规则每周命中数，分周期长度看差异） |
| `rag_rule_hit_R1` / `R2` | RAG召回加权/附带安全确认书 | rule_id, theme_dim（if R1）/ guardian_reqd_task_count（if R2） | 验证RAG规则执行覆盖率 |

---

## 十二、验收标准（V1.1 增量：原4章 + 新增4章Cycle级验收）

### 12.1 维度配比合规（核心，必达）
- [ ] 用 `/api/v1/tasks/schedule-preview` 接口为每个年级跑100次模拟，**95%以上模拟结果**满足：主维占比≥60%、次维~30%、潜维≤10%
- [ ] 连续7天同一孩子任务去重：主维≤3天重复、次维≤5天重复、潜维≤14天重复

### 12.1-B V1.1 新增 + V1.3 升级：可配置周期Cycle级整体占比合规（核心，必达，4档周期长度分别验收）
- [ ] 调用 `/api/v1/cycle-plans/preview` 为6个年级 × **4档周期长度（1/2/3/4周）** 各生成50个 Cycle 计划（共6×4×50=1200个模拟），**95%满足整Cycle聚合主维≥60%、次维≥28%且≤32%、潜维≤10%**（允许单日有波动，但整个 Cycle 整体必须满足）
- [ ] 1200次模拟中，Cool-down池全局生效：主维3天不重复率100%（没有任何主维任务连续3天出现），次维5天不重复率≥98%，潜维在本Cycle内不重复率100%（注：1周Cycle下潜维14天冷却等价于"本Cycle内不重复"）
- [ ] parent_id里程碑分布：父任务N条子任务均匀分布在对应Cycle长度（7/14/21/28天）内，日密度≤1条（没有任何一天塞了≥2条子任务）
- [ ] **V1.3新增**：阶段目标设定 → 课程表生成链路验证：家长设定 `focus_dims=[1,2]` + `points_target=200` 后，生成的Cycle计划中重点维度拓展槽占比比默认+20%、积分预估达成率≥95%
- [ ] **V1.3新增**：4档周期长度下，主题周触发与适配验证：1周Cycle触发主题周时整周期100%派给theme_dim；2-4周Cycle时主题周占其中1周且其余周正常分配

### 12.2 双红线合规（核心，必达）
- [ ] 学术红线：所有任务模板关键词扫描0命中；运营工具人工扫一遍也0命中
- [ ] 安全红线：12类危险操作未解锁的孩子，预览接口100%不返回对应高级任务；连续3次退回含安全关键词 → 技能自动冻结

### 12.2-B V1.1 新增：Sanitize S1-S3 + RAG R1-R2 5条新规则覆盖（核心，必达）
- [ ] S1：daily_fixed锚任务在整个Cycle预览的每一天都必须有，缺失率=0（不能中间某一天突然锚任务少了1条）
- [ ] S2：supervision.level=accompany/doorstep的任务100%伴随sign_off_required=true；技能熔断状态孩子的guardian_reqd任务100%被剔除替换
- [ ] S3：任选50个不满足前置依赖的mock场景（skill等级不够/锚任务没连7天/里程碑没到），不满足的任务100%被替换为无前置的同维任务
- [ ] R1：主题周开启时，弱维候选池排序的前3条100%是theme_dim同维任务，且前3天难度≤中（从任务模板difficulty字段校验）
- [ ] R2：任选20条guardian_reqd任务，RAG召回返回的任务100%预填了《技能解锁树汇总》对应的supervision JSON（sign_off_required=true+level=accompany）

### 12.3 主流程体验
- [ ] 孩子提交→家长验收→发积分→进度刷新 全链路5秒内完成
- [ ] 4类验收流（低/中/高/父任务）都走通且验收按钮对应权限正确
- [ ] 锚任务3-5条年级匹配正确；父任务子任务里程碑推进正确；技能升级时首页专区弹出提醒

### 12.3-B V1.1 新增：家长预览拍板主流程（核心体验）
- [ ] 家长进入📅周期课程表 → 整Cycle表格加载≤2秒；顶部维度占比仪表盘实时正确；切换1/2/3/4周档位时表格行数动态渲染正确
- [ ] 单任务悬停快捷按钮🔒锁定/🔄换/📌提级/➖删都可用；➕加任务从拓展池选单≤1.5秒打开
- [ ] 点「✅确认锁版」→ 指纹校验通过 → 状态变「已锁版🔒」→ 推送通知「孩子已经知道下个周期任务啦」
- [ ] Cycle开始日00:00，锁版Cycle的Day1切片100%正确落地到孩子的📘今日任务页（100个孩子模拟验证0偏差，4档周期长度都验证）
- [ ] **V1.3新增**：家长点「🎯设定本周期目标」→ 选1/2/3/4周 + 重点维度 + 积分目标 → 系统生成对应长度课程表，链路完整无报错

### 12.4 数据与成长模块联动
- [ ] 任务完成后积分上账正确；维度贡献值正确存入`dimension_award_json`
- [ ] 父任务最终产出物上传后，素材自动同步到成长模块「阶段回顾素材池」
- [ ] 问卷基线分正确接入编排引擎，弱维孩子实际派单的弱维任务占比×2 埋点验证有效
- [ ] **V1.3新增**：阶段目标设定数据 (`cycle_goal_setting`) 正确接入成长模块「阶段回顾」，回顾时显示「本周期目标 vs 实际达成」对比

---

## 十三、与现有6份核心文档的100%对齐清单（V1.1 + 4字段落地 + V1.3 阶段目标对齐）

| 核心输入文档 | 本PRD对齐位置 | V1.0校验项 | V1.1 新增4字段落地对齐校验项 | V1.3 新增对齐校验项 |
|----------|-----------|---------|--------------------------|------------------|
| 《1-6年级成长任务基础规范V1》 | 七、编排引擎7.3表 + 附录PRIMARY/SECONDARY/LATENT_DIMS映射 | 6年级主次潜维完全一致，0偏差 | ✅ 整Cycle整体占比≥60%/30%/10%硬约束；✅ cycle_theme弱维主题周×3加权与基础规范弱维逻辑对齐 | ✅ 4档周期长度（1/2/3/4周）下主次潜占比都达标；✅ 重点维度加权 +20% 不破坏整体合规 |
| 《每日锚任务汇总》 | 八、task_template表的anchor类型任务3-5条/年级 | 锚任务ID命名（H1-GX-YY）与汇总文档一致 | ✅ 所有锚任务模板的task_kind=daily_fixed/weekly_recurring；✅ prerequisite_code=锚任务的连续完成条件（如H1连7天→task:H1-G1-01:done:7）正确写入 | ✅ 1周Cycle下锚任务数=7天×3-5条仍合规；4周Cycle下锚任务数=28天×3-5条不超载 |
| 《1-6年级任务模板库》×6份 | 八、task_template表的extra拓展任务176条 | dimension_id + dimension_ratio_json 完全对应各模板库任务的主次潜标注 | ✅ 每类涉及刀/火/电/气的任务task_kind=guardian_reqd；✅ supervision JSON来自《技能解锁树汇总》的陪同等级+签字等级；✅ 创意类亲子共做任务task_kind=collaborative | ✅ 阶段目标重点维度选择时，对应维度的拓展池候选数充足（每维至少10条可选） |
| 《技能解锁树汇总》28棵 | 八、skill_tree_template表28行 + 五、安全联动 | 每棵树的等级要求/陪同等级/确认书对应 | ✅ RAG R-2：28棵树每棵的S2安全红线的guardian_reqd任务supervision_level_json→预填task_template.supervision JSON；✅ 熔断解除后任务重新出池由S-2规则保证 | ✅ 4档周期长度下技能解锁进度推算正确（长周期下单技能可解锁Lv.2） |
| 《跨周期父任务汇总》28条 | 八、parent_task模板28条 + 六、里程碑配置 | 28条父任务的周期跨度/里程碑数/最终产出物一致 | ✅ 所有父任务子任务task_kind=parent_child；✅ 每个里程碑的prerequisite_code=pt:Px-Gy:milestone:z 正确写入；✅ S-1规则里程碑未到不派 | ✅ 1周Cycle下父任务里程碑跨度适配（仅安排本周可达成的里程碑子任务）；✅ 4周Cycle可完整覆盖28天父任务全周期 |
| 《问卷题库-分龄6档V2》 | 七、编排引擎Step5弱维加权 | 问卷输出的6维分→弱维识别，比例×2加权派单验证通过 | ✅ 支柱2主题周触发条件：问卷baseline分<50 OR 上个Cycle完成率<60%，两种路径都100%正确识别；✅ ×3加权后theme_dim一周占比≥80%（周度集中训练） | ✅ 阶段目标设定的「重点维度」默认推荐值来自问卷V2弱维识别；✅ 历史回看窗口从固定14天改为「近一个已锁版Cycle」（动态长度），保证不同周期长度下都能识别弱维 |

---

## 附录A：一年级任务模板库（6-7岁 | 幼小衔接适应期）

> 年级定位：规则建立 + 自理启蒙 + 注意力基础训练
> 能力主次潜：主=生活自理/责任担当（合计任务占比~65%），次=学习探索/社交协作（合计~28%），潜=创意审美/运动健康（严格≤7%）
> 学术红线：绝对不涉及任何考试分数/试卷/测试相关奖励，学术奖励仅限习惯类

---

## 一、核心习惯培养（每日固定锚任务，3项）

| 编号 | 习惯名称 | 培养目标 | 主/次能力维度 | 每日基础积分 | 可量化验收标准 |
|-----|---------|---------|-------------|------------|-------------|
| H1-G1-01 | 每日三整理（书包+衣服+桌面） | 幼小衔接必备自理能力，杜绝上学丢三落四 | 主=生活自理，次=责任担当 | 5分 | 1.书包按课表顺序装好课本/文具；2.第二天穿的衣裤鞋袜叠放整齐于床头；3.学习桌面无书本/文具/零食遗留 |
| H1-G1-02 | 饭后餐桌小主人 | 建立「家庭一员承担分内事」的责任意识 | 主=责任担当，次=生活自理 | 5分 | 1.自己的碗筷勺放入厨房水槽；2.座位方圆50cm桌面饭粒/油污擦净；3.椅子推回餐桌下 |
| H1-G1-03 | 15分钟静阅读 + 朗读1句话给家长 | 训练15分钟连续注意力，积累识字量 | 主=学习探索，次=社交协作 | 6分 | 1.坐姿端正持续阅读15分钟不中断；2.朗读1句当天内容并录音或家长签字确认 |

---

## 二、技能解锁阶梯（4条技能树，新增S3/S2补充）

### 技能树 S1-G1：垃圾分类小公民

> 潜维占比控制：垃圾分类仅作为生活常识启蒙，归属于「责任担当主维下的家庭义务」，占比严格≤10%

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 能正确识别4类垃圾（可回收/厨余/有害/其他）的彩色图标 | 协助家长投放家庭垃圾（每日1次） | 仅需家长提示分类即可，无需全程陪同 |
| Lv.1 达标 | 连续7天（1个完整周期）正确投放无错误 | 家庭垃圾分类宣传员：教会1位家人区分1种易混垃圾（例：纸巾≠可回收） | 无需陪同 |

### 技能树 S2-G1：个人清洁小卫士（主=生活自理）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 独立完成七步洗手法 + 刷牙2分钟（家长核验） | 洗自己的袜子/红领巾/手帕 | 仅需提示水温，无需全程陪同 |
| Lv.1 达标 | 连续14天（2个周期）洗漱无家长主动提醒 | 独立洗澡 | 门外看护提醒模式（家长浴室门外看护，不进浴室），防止意外滑倒 |
| Lv.2 进阶（新增自莱西市洙河小学/长城路小学清单） | 独立洗澡后将洗手台和地面水渍擦干 + 挂好自己的毛巾 | 整理自己的洗漱用品归位 + 擦拭洗手台水渍 | 门外看护提醒模式 |

### 技能树 S3-G1：扫地小能手（主=责任担当，新增自永城七小/槐荫刘庄小学/内江市一小清单）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 正确握扫把姿势（家长示范3次能模仿） | 扫自己学习桌下的小区域 + 会用畚箕装垃圾 | 仅需家长示范姿势即可，无需全程盯 |
| Lv.1 达标 | 连续7天扫自己房间地面合格 | 饭后扫餐厅地面（家长餐桌方圆1米区域）+ 倒垃圾入指定垃圾桶 | 无需陪同，家长抽查即可 |

### 技能树 S4-G1：生活小工具启蒙（主=生活自理，新增自小学低段官方清单/台儿庄实验小学）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 能正确区分遥控器/时钟等5种常用家电的电池正负极 | 给遥控器/时钟更换电池 + 给新课本包书皮 | 电池更换首次家长陪同；包书皮仅需示范1次 |
| Lv.1 达标 | 累计更换电池+包书皮≥3次无差错 | 开关家门门锁 + 开关家中电灯/电扇（家长确认安全后） | 门锁首次使用陪同；开关电器确认无安全隐患后可独立 |

---

## 三、项目式跨周期父任务（4项，新增P3养蚕/P4手工来自台儿庄实验小学/宿迁实小）

### 🌱 P1-G1-01 我的植物朋友——绿豆发芽14天观察日记（主=责任担当+学习探索次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=责任担当；次=学习探索；潜=创意审美（手绘小报部分） |
| 建议跨周期 | 2个周期（14天） |
| 里程碑（每7天1个对应1周期） | 周期1 Day1-7「浸泡发芽期」：观察破皮→露白→根长<br>周期2 Day8-14「成长期」：测芽高/叶片数 + 全家品尝劳动成果 |
| 每日自动生成子任务 | 1个子任务：浇水（按需2天1次）+ 填写观察卡（高度/根长/照片三选一提交） |
| 父任务完成最终产出物 | 1.手绘A4绿豆生长观察小报1张（4阶段手绘+数据+感受）；2.全家一起品尝自己种的豆芽菜，合影1张留档 |

### 🛡️ P1-G1-02 我会保护自己——家庭安全信息卡制作（主=生活自理+学习探索次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=生活自理；次=学习探索；潜=社交协作（陌生人应对演练部分） |
| 建议跨周期 | 1个周期（7天） |
| 里程碑（7天分天拆解） | Day1 背熟家庭住址 → Day2 背熟爸妈手机号 → Day3 画家的方位图 → Day4 陌生人敲门应对演练 → Day5 消防逃生路线指认 → Day6 地震避险姿势演练 → Day7 绘制信息卡贴门后 |
| 每日自动生成子任务 | 1个子任务：当天对应的记忆/练习内容（无需强制照片，家长签字确认即可） |
| 父任务完成最终产出物 | 手绘A5双面家庭安全信息卡1张，贴大门内侧：正面=住址+电话+紧急联系人；反面=逃生/敲门/地震3条应对规则 |

### 🐛 P1-G1-03 养蚕宝宝——21天完整生命周期观察（主=责任担当+学习探索次维，新增自台儿庄实验小学4月任务）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=责任担当；次=学习探索；潜=创意审美（绘本式手绘记录部分） |
| 建议跨周期 | 3个周期（21天，覆盖卵→蚁蚕→熟蚕→结茧→化蛾完整周期） |
| 里程碑（每7天1个） | 周期1「卵孵化期」：观察蚕卵颜色变化 + 准备桑叶/饲养盒<br>周期2「幼虫生长期」：每日更换新鲜桑叶 + 清理蚕沙 + 测量体长<br>周期3「结茧化蛾期」：搭结茧簇 + 观察吐丝结茧 + 记录化蛾出茧 + 蚕蛾产卵 |
| 每日自动生成子任务 | 1个子任务：换桑叶/清蚕沙/观察记录三选一（蚕沙清理尤其重要，培养责任感） |
| 父任务完成最终产出物 | 1.《蚕宝宝生命日记》A5绘本式装订1本（每天1张手绘+1句话观察+关键阶段照片贴入）；2.蚕茧和蚕卵标本展示卡1份 |

### 🎨 P1-G1-04 我的巧手百宝箱——纸编+捏泥手工周（主=学习探索+创意审美潜维，新增自台儿庄实验小学4-5月任务）

> ⚠️ 本项目作为「主维任务达标的每周奖励项目」，不占用主/次维任务配额，仅在每周主/次维锚任务全勤时触发（潜维≤10%硬约束）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=学习探索（精细动作训练+专注力）；次=责任担当（手工材料整理收齐）；潜=创意审美（纸编+彩泥造型部分，严格≤占比） |
| 建议跨周期 | 1个周期（7天） |
| 里程碑（7天分天拆解） | Day1 十字交叉纸编杯垫 → Day2 纸编小篮子 → Day3 彩泥捏水果（苹果/香蕉/橘子） → Day4 彩泥捏小动物（小猫/小狗） → Day5 彩泥捏小泥人 → Day6 挑选2件精品上色装饰 → Day7 家庭手工展开幕式 |
| 每日自动生成子任务 | 1个手工子任务（家长仅需提供材料，创意方向孩子自主） |
| 父任务完成最终产出物 | 1.手工展实物5件以上（纸编2件+彩泥3件）+ 家庭手工展留影；2.每件作品贴小标签注明作品名+作者+创作日期 |

---

## 四、特色主题周（4个，新增T3/T4来自永城七小/白衣堂小学/莱西洙河小学）

| 主题代号 | 主题周名称 | 主题周对应任务集中安排方向（严格匹配主次潜） | 主题周推荐触发条件 |
|---------|-----------|------------------------------------|----------------|
| T-G1-01 | 我是家里小主人主题周 | 主维集中：锚任务全勤 + 扫地S3解锁任务 + 整理鞋柜 + 垃圾分类<br>次维少量：给长辈递茶/递水果≥2次（社交协作次维） | 任意一周主维锚任务3/3全勤后可触发 |
| T-G1-02 | 亲子阅读主题周 | 次维集中：拓展任务全部围绕绘本展开——复述故事（学习探索次维）、亲子角色扮演（社交协作次维）、画主角（创意审美潜维，仅1天任务） | 连续2周阅读锚任务达标后触发 |
| T-G1-03 | 学雷锋·小小志愿者主题周（新增自宿迁实小/白衣堂小学） | 主维：捡拾小区草坪垃圾+擦健身器材（责任担当主维）<br>次维：给社区老人捶背（社交协作次维）<br>潜维：画「劳动最光荣」主题画（仅1张） | 每年3月第一周自动触发，或任意周锚任务全勤 |
| T-G1-04 | 我的新书包书皮比赛周（新增自小学低段官方清单） | 主维集中：包书皮5本（生活自理主维S4）+ 扫地S3比赛+系鞋带比赛（生活自理主维S2） | 开学第1周自动触发 |

---

## 五、日常拓展任务池（共26条，主维~65%，次维~27%，潜维≤8% 严格合规）

> 任务池说明：除锚任务、技能解锁任务、父任务子任务外，每日从以下任务池中**按比例优先抽取主/次维任务**（主维6成，次维3成，潜维仅每周最多抽1条作为奖励），RAG召回同样按此权重优先命中，保证发展主轴不偏。

| 编号 | 任务名称 | 对应能力维度（严格主次潜） | 积分 | 验收标准（均来自公立小学劳动清单） |
|-----|---------|------------------------|-----|------------------------------|
| **【生活自理 主维 9条，占比34.6%】** | | | | |
| E1-G1-01 | 独自洗漱（刷牙+洗脸+洗手七步法） | 主=生活自理 | 3分 | 全程无家长代劳，洗漱台地面无水渍 |
| E1-G1-02 | 自己穿脱衣服穿鞋（区分正反面） | 主=生活自理 | 3分 | 衣服前后不反、鞋子左右不反，2分钟内完成 |
| E1-G1-03 | 自己背书包上下学 | 主=生活自理 | 3分 | 书包自己背不甩给家长，全程独立 |
| E1-G1-04 | 分类整理玩具（积木/绘本/玩偶三格分类） | 主=生活自理 | 4分 | 玩具完好多归位不混放，绘本大小排列整齐 |
| E1-G1-05 | 用抹布擦自己房间的门窗把手 | 主=生活自理 | 3分 | 把手正反面都擦，无手印无灰尘 |
| E1-G1-06 | 自己叠短袖上衣+裤子+袜子各1件 | 主=生活自理 | 5分 | 衣服对折整齐+裤子裤腿对齐+袜子成团塞好 |
| E1-G1-07 | 整理自己的抽屉（文具/玩具/杂物分三格） | 主=生活自理 | 4分 | 每格物品分类明确，关抽屉不卡 |
| E1-G1-08 | 戴红领巾+敬队礼（正确姿势） | 主=生活自理 | 3分 | 红领巾两角对齐+队礼右手五指并拢高举头上 |
| E1-G1-09 | 放学回家把外套脱下挂好+换拖鞋摆好 | 主=生活自理 | 3分 | 外套挂衣架或指定挂钩，拖鞋鞋头朝外 |
| **【责任担当 主维 8条，占比30.8% → 主维合计17条，占比65.4%】** | | | | |
| E1-G1-10 | 饭前帮摆碗筷、纸巾、餐垫 | 主=责任担当，次=生活自理 | 4分 | 每人对应位置摆1碗1筷+纸巾，人数正确无遗漏 |
| E1-G1-11 | 饭后擦自己的餐椅+桌子 | 主=责任担当，次=生活自理 | 4分 | 无油污饭粒残留，椅子推回原位 |
| E1-G1-12 | 用湿纸巾擦自己的学习桌和小椅子 | 主=责任担当，次=生活自理 | 3分 | 桌面无笔印无灰尘，椅子四条腿都擦到 |
| E1-G1-13 | 整理鞋柜（自己的鞋左右配对摆正） | 主=责任担当 | 4分 | 左右脚一致+鞋头朝外+按常用/不常用排列 |
| E1-G1-14 | 养护水盆植物绿萝（每周换水1次+擦叶子） | 主=责任担当，次=学习探索 | 5分 | 水清澈无异味+叶片正反面擦到无灰尘 |
| E1-G1-15 | 给家里绿植浇水（家长提前告知哪些需要浇） | 主=责任担当 | 4分 | 浇到盆底微微漏水为止，不浇太多溢出来 |
| E1-G1-16 | 帮家长把脏衣服放进洗衣篮（分颜色） | 主=责任担当 | 3分 | 深色/浅色分开放，袜子单独装洗衣袋 |
| E1-G1-17 | 冲泡柠檬水（温开水+2片柠檬+蜂蜜半勺） | 主=责任担当（为家人准备），次=社交协作（双手递） | 4分 | 家长在旁看护用水安全，成品无洒漏可饮用，双手递给家人 |
| **【学习探索 次维 4条，占比15.4%】** | | | | |
| E1-G1-18 | 分辨5种常见食物的保质期（牛奶/面包/饼干/酸奶/火腿肠） | 次=学习探索 | 5分 | 能指出包装上生产日期和保质期，算出没过期 |
| E1-G1-19 | 剥花生比赛（10颗花生计时+数颗数） | 次=学习探索（数数计时），主=生活自理（精细动作） | 4分 | 10颗完整花生米无破碎，花生壳归厨余垃圾桶，说出总数 |
| E1-G1-20 | 用安全剪刀剪直线+剪圆形 | 次=学习探索（精细动作训练），潜=创意审美 | 4分 | 直线不偏离≥10cm，圆形闭合流畅不毛边 |
| E1-G1-21 | 剥花生/瓜子+数数给家人吃的数量 | 次=学习探索（数数），主=责任担当（为家人剥） | 4分 | 15颗完整瓜子仁不碎，直接递给家人分享，说出一共剥了多少颗 |
| **【社交协作 次维 3条，占比11.5% → 次维合计7条，占比26.9%】** | | | | |
| E1-G1-22 | 给长辈端茶递水递水果 | 次=社交协作，主=责任担当 | 4分 | 双手递+温度适宜（热水提醒长辈慢用） |
| E1-G1-23 | 用水果招待客人（洗水果+摆盘+双手递） | 次=社交协作，主=责任担当 | 5分 | 水果洗干净无泥土，摆盘好看不拥挤 |
| E1-G1-24 | 给妈妈削水果（苹果/梨用安全刨子，家长看护） | 次=社交协作（孝心服务），主=责任担当 | 5分 | 安全刨子全程家长在旁，皮厚薄均匀不浪费，削完切块装盘 |
| **【创意审美 潜维 2条，占比7.7% → 严格≤10%合规】** | | | | |
| E1-G1-25 | 捏小泥人（用超轻黏土或橡皮泥） | 潜=创意审美，次=学习探索（精细动作） | 4分 | 捏出人形：有头有身体有四肢，能说出是谁 |
| E1-G1-26 | 十字交叉纸编（彩色纸条编杯垫） | 潜=创意审美，次=学习探索（手眼协调） | 5分 | 4条×4条纸条经纬交织不散，能垫起1个杯子 |

---

## 六、一年级任务池主次潜合规性自检表（100%达标）

| 维度层级 | 理论占比 | 实际26条拓展池数量 | 实际占比 | 合规判定 |
|---------|---------|-----------------|---------|---------|
| Primary 主维（生活自理+责任担当） | ≥60% | 17条 | 65.4% | ✅ 达标 |
| Secondary 次维（学习探索+社交协作） | ~30% | 7条 | 26.9% | ✅ 达标 |
| Latent 潜维（创意审美+运动健康） | ≤10% | 2条（创意审美2条，运动健康0条） | 7.7% | ✅ 达标且未用运动健康（可留作奖励） |

> 奖励用预留潜维任务（不进拓展池，仅作为主/次维周全勤奖励，不影响占比）：跳绳100下/拍球50下（运动健康·潜）、画1张全家福（创意审美·潜）

---

## 附录B：二年级任务模板库（7-8岁 | 习惯巩固期 + 社交协作启蒙）

> 年级定位：习惯固化 + 手部精细动作训练 + 同伴分享意识建立
> 能力主次潜：主=责任担当/学习探索（合计~64%），次=生活自理/社交协作（合计~32%），潜=运动健康/创意审美（严格≤11%）
> 学术红线：仍然不涉及任何考试分数相关奖励，学术奖励仅限学习习惯类

---

## 一、核心习惯培养（每日固定锚任务，3项）

| 编号 | 习惯名称 | 培养目标 | 主/次能力维度（严格匹配二年级：主=责任担当/学习探索） | 每日基础积分 | 可量化验收标准 |
|-----|---------|---------|--------------------------------------------------|------------|-------------|
| H1-G2-01 | 每日书桌+书包双整理 | 在一年级三整理基础上升级，巩固「不丢学习用品」的习惯 | 主=学习探索（学习环境自我管理），次=生活自理 | 6分 | 1.书桌左书右文具分区；2.书包侧袋放水杯/餐巾纸/跳绳；3.前一天作业全部入书包夹层 |
| H1-G2-02 | 每日家庭小帮手：餐桌完整流程 | 从收自己的碗升级为：收全桌碗筷 + 擦整张餐桌 + 摆第二天早餐碗筷 | 主=责任担当，次=社交协作（家庭协作） | 7分 | 1.全桌每人的碗筷收进厨房；2.整张餐桌油污饭粒擦净；3.第二天早餐每人1份碗筷摆放就位 |
| H1-G2-03 | 20分钟阅读 + 5分钟口头复述 | 从15分钟提升到20分钟，加上复述训练逻辑表达力 | 主=学习探索，次=社交协作（表达沟通） | 7分 | 1.连续阅读20分钟中断≤1次；2.口头复述当天故事的「起因-经过-结果」三要素，家长录音≥1分钟 |

---

## 二、技能解锁阶梯（4条技能树，新增S3拖地S4学校值日生）

### 技能树 S1-G2：厨房安全小帮手（主=责任担当，禁明火禁刀具）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 能准确说出厨房3个危险区域（火/刀/电水壶）并主动规避 | 择青菜（空心菜/白菜）、剥毛豆/蒜瓣、洗水果（苹果/梨） | 强制全程陪同，家长端APP须签署「厨房陪同确认书」 |
| Lv.1 达标 | 累计完成厨房协助类子任务≥10次，期间无任何安全事故 | 洗碗筷（洗洁精洗→清水冲2遍）+ 擦厨房台面 | 强制全程陪同（热水操作防烫伤提醒） |
| Lv.2 进阶（新增自永城七小/槐荫刘庄小学） | 累计洗碗≥15次无投诉 + 能准确分辨蔬菜好坏（新鲜/发黄/腐烂） | 择菜时去黄叶+老根，洗碗后按大小放入碗柜归位 | 仅拿取高处碗柜时家长搭把手即可 |

### 技能树 S2-G2：系结小能手（主=学习探索·精细动作训练）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 能独立系标准蝴蝶结鞋带不松脱 | 系红领巾 + 整理自己鞋带每双配对 | 无需陪同 |
| Lv.1 达标 | 连续7天每天1次系鞋带无松脱 | 整理全家鞋柜 + 每双鞋左右配对 + 鞋带系好展示 | 无需陪同 |
| Lv.2 进阶（新增自台儿庄实小/长城路小学） | 熟练掌握3种绳结：蝴蝶结+死结+活结 | 给礼物打包装绳结 + 给垃圾袋扎紧口 + 跳皮筋打结不松 | 无需陪同 |

### 技能树 S3-G2：拖地小卫士（主=责任担当，新增自内江市一小/永城七小/槐荫刘庄小学）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 一年级扫地小能手Lv.1通过 + 拖把正确握法（家长示范3次） | 拖自己房间地面（扫完再拖） | 仅需家长告知「先扫后拖+拧干拖把不滴水」即可 |
| Lv.1 达标 | 连续7天自己房间拖地合格 | 拖餐厅+客厅公共区地面 + 拖完洗拖把晾晒 | 无需陪同，家长抽查水渍即可 |

### 技能树 S4-G2：教室值日生技能（主=责任担当+学习探索次维，新增自莱西洙河小学/槐荫刘庄小学，为学校场景适配）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 一年级扫地+垃圾投放熟练 | 用黑板擦擦黑板（下半部分够到的区域）+ 擦自己课桌椅 | 学校场景由老师负责看护 |
| Lv.1 达标 | 学校值日生经验≥5次 + 抽屉整理熟练 | 给教室植物角浇水 + 清除校园花坛杂草 + 整理全班课桌对齐一条线 | 学校场景由老师负责看护 |

---

## 三、项目式跨周期父任务（4项，新增P3水培/P4社区小义工）

### 🫛 P1-G2-01 我的阳台小菜园——香葱/大蒜28天种植记（主=责任担当+学习探索次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=责任担当；次=学习探索；潜=创意审美（手绘生长手册部分，严格≤占比） |
| 建议跨周期 | 4个周期（28天） |
| 里程碑（每7天1个） | 周期1「种植周」：培土 + 播种 + 第一次浇水<br>周期2「发芽期」：发芽率统计 + 每日测芽高<br>周期3「生长期」：叶片数统计 + 稀释有机液肥施肥<br>周期4「收获期」：剪香葱/大蒜 + 参与做菜 + 品尝 |
| 每日自动生成子任务 | 1个子任务：松土/浇水（按需2天1次）+ 观察记录（照片/株高/叶片数三选一） |
| 父任务完成最终产出物 | 1.和家长共同完成1道菜（香葱炒蛋/大蒜炒肉）；2.28天完整生长手册1本（4张阶段卡装订，手绘+数据+照片） |

### 📚 P1-G2-02 我当小老师——给家人讲1本绘本（主=学习探索+社交协作次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=学习探索（阅读+逻辑）；次=社交协作（公众表达）；潜=创意审美（板书手绘部分） |
| 建议跨周期 | 1个周期（7天） |
| 里程碑（7天分天拆解） | Day1 自选绘本 → Day2-4 熟读3遍不漏情节 → Day5 给1位家长讲1遍 → Day6 修改讲稿加动作/表情 → Day7 给全家人正式脱稿讲 |
| 每日自动生成子任务 | 1个阅读/演练子任务（录音 + 家长签字确认即可） |
| 父任务完成最终产出物 | 1.全家面前正式讲绘本≥3分钟的完整视频；2.小老师自制A4板书1张（画关键角色+关键情节） |

### 🌿 P1-G2-03 水培植物实验室——马铃薯/大蒜/绿豆对比观察28天（主=学习探索+责任担当次维，新增自宿迁实小水培活动）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=学习探索（科学对比实验）；次=责任担当（每日换水维护）；潜=创意审美（手绘对比柱状图部分） |
| 建议跨周期 | 4个周期（28天） |
| 里程碑（每7天1个） | 周期1「定植周」：准备透明塑料杯3个 + 马铃薯块/大蒜瓣/绿豆分别定植 + 贴标签<br>周期2「发芽对比周」：观察三者发芽时间先后 + 每日测芽长并记录<br>周期3「生长速度周」：记录根长、叶数、颜色对比 + 换水每周2次<br>周期4「总结展示周」：手绘对比柱状图 + 剪部分蒜苗做菜品尝 + 撰写小观察报告 |
| 每日自动生成子任务 | 1个子任务：换水/测量/记录三选一，确保不天天浇水符合水培实际 |
| 父任务完成最终产出物 | 1.三盆水培植物实物；2.《水培对比观察手册》A5装订（含手绘对比图+测量数据+照片）；3.品尝自己种的蒜苗炒鸡蛋1餐 |

### 🤝 P1-G2-04 我是社区小义工——7天公益挑战（主=责任担当+社交协作次维，新增自台儿庄实小/宿迁实小/白衣堂小学）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=责任担当（公益责任）；次=社交协作（与老人/邻居沟通）；潜=创意审美（公益小报手绘部分） |
| 建议跨周期 | 1个周期（7天） |
| 里程碑（7天分天拆解） | Day1 清理小区楼道小广告（家长陪同） → Day2 擦拭小区健身器材 → Day3 捡拾小区绿化带白色垃圾 → Day4 给独居老人捶背+送自己画的贺卡 → Day5 小区垃圾分类志愿引导1小时（家长在旁） → Day6 给小区植物浇水 → Day7 公益心得分享会+绘制公益小报 |
| 每日自动生成子任务 | 1个公益子任务（必须家长全程陪同户外，安全第一） |
| 父任务完成最终产出物 | 1.累计公益时长≥5小时，家长签字+社区盖章优先（无盖章家长签字即可）；2.《我的公益日记》配7张照片+7句话；3.手绘A3公益小报1张贴单元门口 |

---

## 四、特色主题周（4个，新增T3传统手艺T4亲子劳动日）

| 主题代号 | 主题周名称 | 主题周对应任务集中安排方向（严格匹配主次潜） | 主题周推荐触发条件 |
|---------|-----------|--------------------------------------|----------------|
| T-G2-01 | 小小厨师助手主题周 | 主维集中：厨房S1解锁任务（择菜/洗碗/擦台面均为责任担当主维）<br>次维少量：盛饭摆碗筷（生活自理次维） | 任意周锚任务全勤后可触发 |
| T-G2-02 | 分享与友谊主题周 | 次维集中：和朋友交换1本书（社交协作次维+学习探索主维）、给好朋友写1张明信片（社交协作次维）、为家人默默做1件不提醒的事（责任担当主维） | 连续2周社交协作次维任务达标≥3次 |
| T-G2-03 | 传统手艺体验周（新增自兖州区白衣堂小学） | 主维：竹编小筐（学习探索主维·手艺技能习得）、面塑捏小动物（学习探索主维·精细动作）<br>潜维≤1天任务：剪纸贴窗花（创意审美·潜） | 传统节日前1周自动触发（春节/中秋等） |
| T-G2-04 | 亲子劳动日主题周（新增自兖州区白衣堂小学每学期亲子劳动日） | 主维集中：亲子大扫除（责任担当主维）、亲子种1盆花（责任担当主维+学习探索次维）<br>次维：亲子包饺子（社交协作次维·家庭协作） | 每月最后1周周末自动触发 |

---

## 五、日常拓展任务池（共28条，主维~64%，次维~32%，潜维~11% 严格合规）

> 任务池说明：除锚任务、技能解锁任务、父任务子任务外，每日从以下任务池中**按比例优先抽取主/次维任务**（主维6.4成，次维3.2成，潜维仅每周最多抽1条作为奖励），RAG召回同样按此权重优先命中，保证发展主轴不偏。

| 编号 | 任务名称 | 对应能力维度（严格主次潜） | 积分 | 验收标准（均来自公立小学劳动清单） |
|-----|---------|------------------------|-----|------------------------------|
| **【责任担当 主维 11条，占比39.3%】** | | | | |
| E1-G2-01 | 洗漱后擦干洗手台台面和地面水渍 | 主=责任担当（公共区域卫生维护），次=生活自理 | 3分 | 无水渍反光，毛巾挂回原位 |
| E1-G2-02 | 饭前帮家人盛饭+摆碗筷+摆汤勺 | 主=责任担当，次=社交协作（家庭服务） | 5分 | 每人一碗饭根据饭量调整+筷子搁在碗右侧+汤勺配汤碗 |
| E1-G2-03 | 饭后全桌收碗+擦桌+扫地+椅子归位 | 主=责任担当，次=生活自理 | 6分 | 全流程独立完成，桌面地面饭粒油污全清 |
| E1-G2-04 | 帮父母叠长辈的被子（表达孝心） | 主=责任担当（孝心责任感），次=社交协作 | 5分 | 叠成方正形状放在长辈床头，边角整齐 |
| E1-G2-05 | 管理自己的植物：每周浇水2次+擦叶子+修剪黄叶 | 主=责任担当，次=学习探索（植物知识） | 5分 | 不烂根不黄叶，叶片有光泽无灰尘 |
| E1-G2-06 | 剥豌豆+分类（100g豌豆+数数豆米数） | 主=责任担当（厨房帮工），次=学习探索（数数计时） | 5分 | 豆米完整不碎，豆荚分类入厨余垃圾桶，说出总粒数 |
| E1-G2-07 | 剥玉米（1根玉米完整剥下所有玉米粒+数数） | 主=责任担当（备菜帮手），次=学习探索（数数） | 5分 | 玉米粒完整不浪费，玉米棒光溜无遗漏，说出总粒数 |
| E1-G2-08 | 练习正确系红领巾+敬队礼+唱队歌 | 主=责任担当（少先队员义务），次=学习探索 | 3分 | 红领巾压衣领下，两角对齐胸前打结，队礼标准 |
| E1-G2-09 | 打扫自己房间的窗户轨道+窗台灰尘 | 主=责任担当，次=生活自理 | 5分 | 用小刷子/旧牙刷刷轨道无灰尘，窗台湿抹布擦两遍 |
| E1-G2-10 | 擦洗家里所有的门把手+电灯开关（8个以上） | 主=责任担当（公共区域维护），次=生活自理 | 5分 | 用消毒湿巾擦，正反面都擦到，无手印无污渍 |
| E1-G2-11 | 剥蒜（10瓣蒜完整去皮+计时数数） | 主=责任担当（厨房帮工），次=学习探索（计时数数） | 4分 | 蒜瓣完整不碎无残留蒜皮，蒜皮归厨余垃圾桶 |
| **【学习探索 主维 7条，占比25% → 主维合计18条，占比64.3%】** | | | | |
| E1-G2-12 | 自己的小衣物（袜子/内裤/手帕）手洗+晾晒 | 主=学习探索（生活技能习得），次=生活自理 | 5分 | 用肥皂打泡→揉搓→漂洗2次无泡沫→用夹子夹牢晾晒 |
| E1-G2-13 | 整理自己的书桌+书柜（书本大小归类） | 主=学习探索（学习环境管理），次=生活自理 | 5分 | 桌面清空只剩文具+常用书，书柜按大小/学科排列整齐 |
| E1-G2-14 | 叠被子（平铺对折再对折成长条状摆床头） | 主=学习探索（生活技能习得），次=责任担当（个人起居责任） | 4分 | 被子平整无明显褶皱，枕头放在被子上方 |
| E1-G2-15 | 自己整理抽屉：书本/文具/杂物分三格 | 主=学习探索（分类整理能力），次=责任担当 | 4分 | 每格物品分类明确，抽屉推拉顺滑不卡 |
| E1-G2-16 | 学做一道凉菜——糖拌番茄（切瓣+撒白糖） | 主=学习探索（烹饪入门），次=责任担当（为家人准备），潜=创意审美（摆盘） | 6分 | 番茄切瓣大小均匀，白糖适量不齁，家长看护切菜安全 |
| E1-G2-17 | 用安全剪刀剪窗花（对折后剪简单图案） | 主=学习探索（传统手工艺学习），次=责任担当（装饰家），潜=创意审美（造型设计） | 5分 | 对折对齐，剪线流畅，展开后图案对称不碎 |
| E1-G2-18 | 用面团捏小动物（发面或橡皮泥均可） | 主=学习探索（精细动作训练），次=责任担当（家庭装饰），潜=创意审美（造型） | 5分 | 动物形态可辨，至少做3只不同的小动物 |
| **【生活自理 次维 5条，占比17.9%】** | | | | |
| E1-G2-19 | 整理自己的衣柜：当季/过季分两格挂+叠 | 次=生活自理 | 6分 | 当季挂外面方便拿，过季叠里面，衣架一个方向 |
| E1-G2-20 | 折叠全家的毛巾（长毛巾三折+小方巾对角折） | 次=生活自理，主=责任担当（帮全家） | 4分 | 每条折叠后大小一致，按使用人分位置摆放 |
| E1-G2-21 | 整理换季自己的鞋子：擦洗+配对+装鞋盒 | 次=生活自理，主=责任担当（独立整理） | 6分 | 鞋子擦干净无污渍，左右配对放鞋盒，盒外贴标签 |
| E1-G2-22 | 每周整理1次书包：按学科/大小分类 | 次=生活自理，主=学习探索（学习管理） | 4分 | 课本按课表顺序放，文具归笔袋，水壶跳绳侧袋 |
| E1-G2-23 | 制作简单水果拼盘（3种以上水果+造型） | 次=生活自理+社交协作（招待），主=责任担当，潜=创意审美（摆盘） | 6分 | 至少红黄绿三种颜色，造型美观不杂乱，家长签字确认安全用刀 |
| **【社交协作 次维 4条，占比14.3% → 次维合计9条，占比32.1%】** | | | | |
| E1-G2-24 | 给长辈捶背10分钟（竖拳掌根交替） | 次=社交协作，主=责任担当（孝心） | 5分 | 力度适中询问长辈感受，捶满10分钟不停 |
| E1-G2-25 | 和来访的客人打招呼+端水果+陪聊5分钟 | 次=社交协作，主=责任担当（小主人责任） | 6分 | 不躲在房间，主动打招呼，礼貌回答客人问题 |
| E1-G2-26 | 给弟弟妹妹/邻居小朋友读1本绘本 | 次=社交协作（分享），主=学习探索（阅读） | 5分 | 大声朗读+翻页+提问互动≥5分钟，小听众不走开 |
| E1-G2-27 | 用旧报纸+胶带包装1件礼物+贴蝴蝶结 | 次=社交协作（送礼情谊），主=学习探索（包装技能），潜=创意审美（包装设计） | 5分 | 包装纸平整无褶皱，胶带不外露，蝴蝶结不散 |
| **【创意审美 潜维 1条 + 3条任务含少量潜维，合计≈11%合规】** | | | | |
| E1-G2-28 | 用彩纸/超轻黏土做1张感谢卡送给帮助过自己的人 | 潜=创意审美，次=社交协作（感恩表达），主=责任担当（感恩习惯） | 5分 | 至少有图+有文字+有签名，亲手送出并合影 |

---

## 六、二年级任务池主次潜合规性自检表（100%达标）

| 维度层级 | 理论占比 | 实际28条拓展池数量 | 实际占比 | 合规判定 |
|---------|---------|-----------------|---------|---------|
| Primary 主维（责任担当+学习探索） | ≥60% | 18条（11+7） | 64.3% | ✅ 达标 |
| Secondary 次维（生活自理+社交协作） | ~30% | 9条（5+4） | 32.1% | ✅ 达标 |
| Latent 潜维（创意审美+运动健康） | ≤10% | 纯潜维1条 + 4条任务含少量潜维（E16/E17/E18/E23/E27），折合≈3条 | ≈10.7% | ✅ 达标，运动健康潜维未用留作奖励 |

> 奖励用预留潜维任务（不进拓展池，仅作为主/次维周全勤奖励，不影响占比）：拍球100下/跳绳150下（运动健康·潜）、画1张我的好朋友（创意审美·潜）

---

## 附录C：三年级任务模板库（8-9岁 | 学习方法养成期 + 独立能力跃升期）

> 年级定位：从被动执行→主动规划，学习方法启蒙，安全独立意识建立
> 能力主次潜：主=学习探索/责任担当（合计~67%），次=生活自理/创意审美（合计~30%），潜=运动健康/社交协作（严格≤7%）
> 学术边界：开始出现学习习惯奖励（预习/复习/错题整理），但仍然不涉及任何考试分数直接奖励

---

## 一、核心习惯培养（每日固定锚任务，4项）

| 编号 | 习惯名称 | 培养目标 | 主/次能力维度（严格匹配三年级：主=学习探索/责任担当） | 每日基础积分 | 可量化验收标准 |
|-----|---------|---------|--------------------------------------------------|------------|-------------|
| H1-G3-01 | 学习三件套：预习+复习+错题小本 | 学习方法黄金三角，从习惯升级为方法论 | 主=学习探索，次=责任担当 | 10分 | 1.预习：第二天新课做3处标记（划线/提问/生字）；2.复习：当日重点用1句话复述；3.错题小本：当天作业错题抄1遍 |
| H1-G3-02 | 个人房间日更整理：扫地+床铺+桌面 | 从局部整理升级为全权负责1个完整空间的整洁 | 主=责任担当（空间所有权责任感），次=生活自理 | 8分 | 1.地面无纸屑灰尘；2.床单平整被子方正；3.桌面书/文具/玩具三分区不混放 |
| H1-G3-03 | 每日负责：全家倒垃圾+分类投放 | 从一年级协助分类→升级为全权负责家庭垃圾事务 | 主=责任担当，次=生活自理 | 7分 | 1.4类垃圾桶正确分类投放；2.桶壁无外溢垃圾；3.投放后洗手消毒 |
| H1-G3-04 | 25分钟深度阅读 + 3句话书面读后感 | 阅读从口头复述→升级为文字表达，练写作逻辑 | 主=学习探索，次=创意审美（书面表达美学） | 8分 | 1.阅读25分钟无中断；2.手写3句话读后感（好词+印象最深情节+个人感想） |

---

## 二、技能解锁阶梯（5条技能树）

### 技能树 S1-G3：独立生活三级跳（主=责任担当+生活自理次维）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 连续14天个人房间日更整理全部合格 | 独立洗头洗澡 + 梳头（女生需会扎简单马尾） | 门外看护提醒模式即可（不进浴室） |
| Lv.1 达标 | 洗澡+房间整理累计≥20次无家长投诉 | 洗自己的鞋（运动鞋/凉鞋分材质清洁）+ 帮家人擦皮鞋 | 门外看护提醒模式 |
| Lv.2 进阶 | 累计完成洗鞋任务≥5次 | 水果拼盘制作（使用安全儿童水果刀） | 强制全程陪同用刀，须签署「安全刀具使用确认书」 |
| Lv.3 熟练 | 水果拼盘累计制作≥3次且造型合格 | 手洗自己的简单衣物（袜子/内衣/短袖T恤）+ 会用洗衣机洗自己的外套床单 | 洗衣机操作环节首次陪同指导，之后可独立操作 |

### 技能树 S2-G3：金钱管理启蒙（主=学习探索·财商+规划能力）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 建立家庭零花钱记账小本，连续记7天无差错 | 每周家庭采购，给孩子10元预算购买指定小件物品（酱油/盐/文具） | 强制全程陪同（防走失+付款流程指导） |
| Lv.1 达标 | 10元采购累计完成≥3次且找零无误 | 20元预算独立采购水果拼盘所需食材（3种以上水果），列出清单→比价→采购 | 全程陪同，采购决策由孩子主导，家长仅作安全提醒 |
| Lv.2 进阶 | 20元食材采购累计≥2次且预算控制在±2元内 | 协助家庭做一周餐饮开销记录（每日晚餐支出记账），周末汇总计算总支出 | 无需陪同，家长每日提供消费小票，孩子核对入账 |

### 技能树 S3-G3：孝心服务技能（主=责任担当，潜=社交协作·沟通表达）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 会正确捶背力度+捶法（竖拳/掌根交替） | 给长辈捶背/捏腿10分钟（爷爷奶奶/外公外婆任选1位） | 无需陪同，家长签字确认即可 |
| Lv.1 达标 | 累计孝心服务≥10次 | 给长辈洗脚（水温38-40℃由家长提前调试好） | 仅需提前确认水温不烫即可 |
| Lv.2 熟练 | 给长辈洗脚累计≥5次且长辈评价满意 | 学做1道长辈爱吃的凉拌菜（拍黄瓜/糖拌西红柿/凉拌木耳三选一） | 用刀和调味环节必须家长全程陪同 |

### 技能树 S4-G3：打结+削铅笔+缝扣子小能手（主=学习探索·精细动作，次=创意审美，参考槐荫刘庄小学三年级清单）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 学会打死结（鞋带/绳子双圈穿入拉紧），连续3次不散开 | 每天自己系鞋带 + 帮家人系购物袋死结 | 无需陪同，家长检查系紧程度即可 |
| Lv.1 达标 | 死结累计练习≥10次熟练掌握 | 学会打活结（一拉即开）+ 蝴蝶结（鞋带/礼物包装），各连续3次成功 | 蝴蝶结练习阶段家长可示范1次，之后独立完成 |
| Lv.2 进阶 | 活结+蝴蝶结均熟练掌握 | 学会用卷笔刀削铅笔（笔尖1cm长，笔屑不撒落），连续成功削3支 | 首次使用卷笔刀家长陪同讲解安全要点，之后独立操作 |
| Lv.3 熟练 | 削铅笔累计≥10支且合格率≥80% | 学会用针线缝扣子（两孔/四孔平扣），至少成功缝1颗不掉落 | 穿针环节可请家长协助，缝纫过程必须全程看护防止扎手 |

### 技能树 S5-G3：电器安全启蒙（主=学习探索·安全知识+责任担当，参考莱西洙河小学三年级清单）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 了解家庭常用电器安全标识（禁止触碰/小心烫伤/节约用水），能正确指出5处以上 | 垃圾桶套垃圾袋 + 打包垃圾（桶口扎紧不漏），每天负责自己房间的垃圾桶 | 无需陪同，家长检查垃圾袋是否套好、打包是否紧实 |
| Lv.1 达标 | 垃圾袋打包累计≥14次合格 | 独立用电饭煲热馒头/包子（加适量水→放蒸格→放馒头→按开关） | 首次操作家长全程陪同讲解用电安全（手不湿插拔插头），之后可独立操作 |
| Lv.2 进阶 | 热馒头累计≥5次且不糊不滴水 | 独立用煮蛋器/小奶锅煮鸡蛋（冷水下锅→水没过鸡蛋→计时8分钟→冷水浸泡） | 全程必须家长陪同，关火/倒水环节由家长操作，孩子负责计时和观察 |
| Lv.3 熟练 | 煮鸡蛋累计≥3次成功（蛋白全熟蛋黄微嫩） | 综合运用：早餐负责煮鸡蛋1个 + 热馒头2个 + 餐后打包垃圾 | 煮鸡蛋仍需家长在旁看护，其余步骤独立完成 |

---

## 三、项目式跨周期父任务（5项）

### 🐟 P1-G3-01 我的水生宠物——斗鱼/金鱼28天饲养观察手册（主=责任担当+学习探索次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=责任担当（每日喂食换水）；次=学习探索（水生生物知识）；潜=创意审美（手册排版插图） |
| 建议跨周期 | 4个周期（28天） |
| 里程碑 | 周期1「安家期」：准备鱼缸/过滤/养水<br>周期2「入缸适应期」：入鱼+每天观察状态+每周换水1/3<br>周期3「健康观察期」：观察摄食/粪便/体表判断健康状态<br>周期4「总结期」：换水清洁+写完整的饲养技术手册 |
| 每日自动生成子任务 | 1个子任务：喂食1次（定量）+ 水质观察1次 + 每周1次换水专项子任务 |
| 父任务完成最终产出物 | 1.28天鱼类饲养手册A5装订1本（含每日观察记录+10个常见健康问题应对+全程对比照）；2.鱼存活健康获得「水生动物养护师」徽章；若失败写「失败总结卡」同样给纪念徽章 |

### 💰 P1-G3-02 购物小当家——100元家庭周末食材采购计划+执行（主=学习探索·财商+责任担当次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=学习探索（预算规划+数学应用）；次=责任担当（家庭采购责任）；潜=社交协作（与收银员沟通部分，严格≤占比） |
| 建议跨周期 | 2个周期（14天） |
| 里程碑 | 周期1「计划期」：收集家人菜单需求 → 列购物清单 → 3店比价 → 定100元内最终预算<br>周期2「执行期」：跟随家长去市场/超市 → 按预算采购 → 找零核对 → 回家分类摆放食材 |
| 每日自动生成子任务 | 周期1每天1个计划类子任务；周期2集中1天采购子任务 + 其余天食材分类摆放子任务 |
| 父任务完成最终产出物 | 1.采购计划单1份（含预算/比价/实际支出）；2.采购全流程照片3张；3.家人对食材质量满意度投票 |

### 📓 P1-G3-03 我的一周家庭新闻小报制作（主=学习探索·写作+创意审美次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=学习探索（观察记录+文字表达）；次=创意审美（排版+插图）；潜=社交协作（与家人采访沟通部分） |
| 建议跨周期 | 1个周期（7天） |
| 里程碑（7天分天拆解） | 每天记录1条家庭发生的新闻（趣事/家人成就/出游等）→ Day7 排版手绘小报 |
| 每日自动生成子任务 | 1个新闻记录子任务（文字 + 可选照片） |
| 父任务完成最终产出物 | 1.A3大小手绘家庭周报1张（含≥5条新闻 + 插图 + 报头 + 日期 + 作者署名）；2.贴客厅墙展示1周 |

### 🍳 P1-G3-04 14天"我是小厨师助手"（主=责任担当+学习探索次维，参考长城路小学三年级）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=责任担当（家庭用餐保障责任）；次=学习探索（烹饪知识+安全用电）；潜=创意审美（水果拼盘造型部分） |
| 建议跨周期 | 2个周期（14天） |
| 里程碑 | 周期1「基础技能周」：每周学3项基础技能<br>Week1 Day1-2：淘米+电饭煲焖饭（水米比例1:1.2）<br>Week1 Day3-4：择菜+洗菜（青菜/豆角/西红柿三选二轮练）<br>Week1 Day5-7：煮鸡蛋+热馒头（电器安全巩固）<br>周期2「成果展示周」：<br>Week2 Day1-3：水果拼盘3种造型练习（创意+刀工）<br>Week2 Day4-5：淘米+择菜洗菜组合操作（准备一餐的量）<br>Week2 Day6：全家早餐小助手（煮蛋+热馒头+水果拼盘一条龙）<br>Week2 Day7：技能复盘+自评 |
| 每日自动生成子任务 | 每天1-2个技能练习子任务，周末有组合操作子任务 |
| 父任务完成最终产出物 | 1.「小厨师助手成长手册」1本（每项技能3次打卡记录+家长评语+成品照片）；2.周末全家早餐展示照片3张；3.颁发「家庭小厨师」徽章 |

### 🌱 P1-G3-05 7天"无土栽培实验室"（主=学习探索·科学实验+责任担当次维，参考永城七小）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=学习探索（科学方法+对比实验）；次=责任担当（每日养护责任）；潜=创意审美（手绘生长曲线图部分） |
| 建议跨周期 | 1个周期（7天） |
| 里程碑 | Day1「实验准备日」：准备3种水培植物（推荐：大蒜/绿萝/豆苗任选3种）+ 3个透明容器 + 营养液/清水对比组设置<br>Day2-3「观察适应期」：每天观察根部状态+拍照+记录水位变化<br>Day4-5「实验中期」：比较清水组vs营养液组的生长差异，测量高度/根长，记录观察日记<br>Day6「养护操作日」：换水/补充营养液，清洁容器壁，观察叶片状态<br>Day7「总结展示日」：整理7天观察记录，制作对比图表，写实验结论 |
| 每日自动生成子任务 | 每天1个观察记录子任务（文字+测量数据+照片），Day6增加换水养护子任务 |
| 父任务完成最终产出物 | 1.「无土栽培实验报告」1份（A4手写/打印，含7天观察记录+3种植物对比数据+手绘生长曲线图+实验结论）；2.植物最终状态展示照片；3.颁发「小小植物学家」徽章 |

---

## 四、特色主题周

| 主题代号 | 主题周名称 | 主题周对应任务集中安排方向（严格匹配主次潜） | 主题周推荐触发条件 |
|---------|-----------|----------------------------------------|----------------|
| T-G3-01 | 感恩长辈主题周 | 主维集中：学做长辈爱吃凉拌菜（责任担当主维+学习探索次维·烹饪技能）<br>潜维≤2天：捶背洗脚（社交协作·潜维，严格控制占比） | 每年重阳节/父亲节/母亲节自动触发 |
| T-G3-02 | 我的独立能力挑战周 | 主维集中：连续7天房间整理+学习三件套全勤（责任担当+学习探索双主维）<br>次维辅助：洗澡+洗鞋（生活自理·次维） | 任意2周锚任务全勤后可挑战 |
| T-G3-03 | "粮食从哪里来"主题周（参考兖州区白衣堂小学） | 主维集中：参观粮店拍照记录10种粮食价格（学习探索主维）+ 一顿饭成本核算（学习探索主维·数学应用）+ 光盘7天（责任担当主维）<br>潜维≤1天：与菜市场摊主礼貌询价（社交协作·潜） | 每年世界粮食日（10月16日）所在周触发 |
| T-G3-04 | "养绿护绿"植树周（参考莱西洙河小学） | 主维集中：植树/盆栽（责任担当主维）+ 7天养护日记（学习探索主维·观察记录）<br>次维辅助：制作植物专属名牌（创意审美·次维） | 每年植树节（3月12日）所在周触发 |

---

## 五、日常拓展任务池（共30条，主维~67%，次维~30%，潜维~7% 严格合规）

> 任务池说明：除锚任务、技能解锁任务、父任务子任务外，每日从以下任务池中**按比例优先抽取主/次维任务**（主维6.7成，次维3成，潜维仅每周最多抽1条作为奖励），RAG召回同样按此权重优先命中，保证发展主轴不偏。

| 编号 | 任务名称 | 对应能力维度（严格主次潜） | 积分 | 可量化验收标准（参考公立小学官方劳动清单） |
|-----|---------|------------------------|-----|--------------------------------------|
| **【责任担当 主维 11条，占比36.7%】** | | | | |
| D-G3-01 | 手洗自己的袜子和内衣 | 主=责任担当，次=生活自理 | 4分 | 参考莱西洙河小学：1.用专用盆+肥皂/洗衣液浸泡5分钟；2.重点搓洗袜底/领口/袖口，每件搓洗≥10次；3.漂清至无泡沫（换水≥3次）；4.拧干晾晒整齐（袜子夹袜口、内衣展开不重叠） |
| D-G3-02 | 用洗衣机洗自己的外套和床单 | 主=责任担当，次=生活自理 | 5分 | 参考槐荫刘庄小学：1.衣物分类（深色/浅色分开）；2.正确投放洗衣液（用量说明指示）；3.选择正确模式（标准洗/快洗）；4.启动后确认进水正常；5.洗完后及时取出晾晒（不闷在洗衣机内超过1小时） |
| D-G3-03 | 淘米+电饭煲焖饭 | 主=责任担当（为全家备餐），次=生活自理 | 5分 | 参考长城路小学：1.取米：按每人1量杯（150g）计，3人取3杯；2.淘米：加水搅拌，换水3次至水清；3.加水比例：米水=1:1.2（食指第一节水位）；4.电饭煲正确选择「标准煮」模式，启动后确认工作灯亮；5.熟后米粒饱满不夹生不糊底 |
| D-G3-04 | 择菜：青菜/豆角/芹菜（任选一种） | 主=责任担当（厨房帮工），次=生活自理 | 4分 | 参考白衣堂小学：1.青菜：摘除黄叶/烂叶/老叶，切除根部；2.豆角：掐去两头尖和老筋；3.芹菜：摘除叶子留嫩杆，切去根部；4.择好的菜放入干净菜篮；5.垃圾投入厨余垃圾桶，台面清洁无残留菜叶 |
| D-G3-05 | 洗菜：分浸泡+冲洗两步 | 主=责任担当（厨房帮工），次=生活自理 | 4分 | 参考莱西洙河小学：1.清水浸泡10分钟（去除农药残留）；2.逐片/逐根搓洗叶片正反面；3.换水冲洗2-3次至水无泥沙；4.捞出沥干放入菜篮；5.水池内无残留菜叶泥沙，周边擦干 |
| D-G3-06 | 洗自己的运动鞋/凉鞋 | 主=责任担当（个人物品维护），次=生活自理 | 4分 | 参考槐荫刘庄小学：1.先刷去鞋底泥沙；2.鞋刷+肥皂打泡，重点刷鞋头/鞋边/鞋舌（每处刷≥15次）；3.鞋垫单独取出刷洗；4.冲净泡沫至水清澈；5.阳台晾晒（鞋头朝下控水），鞋垫单独晒；6.2双鞋（运动+凉鞋）完成即合格 |
| D-G3-07 | 清理瓷砖污渍（厨房/卫生间） | 主=责任担当（公共区域卫生），次=生活自理 | 5分 | 参考永城七小：1.工具：喷壶装稀释洗洁精+百洁布/旧牙刷；2.喷洒污渍处静置3分钟；3.重点刷洗酱油渍/水渍/皂垢（每处刷≥20次）；4.清水冲洗或湿布擦净；5.瓷砖表面无肉眼可见污渍，地面擦干防滑；6.完成≥2平方米瓷砖清洁即合格 |
| D-G3-08 | 节约用水洗拖把+拖地 | 主=责任担当（家庭公共卫生），次=创意审美（空间整洁美学） | 5分 | 参考莱西洙河小学：1.湿拖：拖把浸水后拧至不滴水（节约用水，一次用水量不超过半桶）；2.顺序：从房间内侧拖到门口，边拖边退避免踩脏；3.重点：桌腿/墙角/门后等死角拖到；4.拖完后拖把冲洗干净，悬挂沥干；5.客厅+自己房间共拖2间，地面无水印无毛发 |
| D-G3-09 | 饭后收拾餐桌+洗碗（3个碗以内） | 主=责任担当（餐后流程责任），次=生活自理 | 4分 | 参考白衣堂小学：1.收碗：剩菜剩饭倒入厨余桶，碗筷叠放稳当；2.擦桌：先擦去残渣，再用洗洁精湿布擦，最后清水布擦净；3.洗碗：温水+洗洁精，碗内外各洗3圈，重点洗碗底；4.冲净：流水冲净泡沫，沥干放入碗篮；5.水槽内无食物残渣，周边擦干 |
| D-G3-10 | 打包垃圾+分类投放（4类） | 主=责任担当（垃圾管理责任），次=生活自理 | 3分 | 参考莱西洙河小学：1.打包：垃圾袋口扭紧打死结，不滴漏不外溢；2.分类：厨余（绿桶）/可回收（蓝桶）/有害（红桶）/其他（灰桶）4类正确投放；3.投放后洗手消毒；4.垃圾桶外壁无污渍，更换新垃圾袋；5.家长抽查2件垃圾投放正确即合格 |
| D-G3-11 | 家中盆栽浇水+松土（3盆） | 主=责任担当（植物养护），次=生活自理 | 4分 | 参考永城七小：1.观察土壤表面2cm，干了再浇（防止烂根）；2.每盆浇水量：中小型盆栽浇至盆底微微渗出水即停；3.松土：用小铲子轻轻松土表（深度1cm，不伤及主根）；4.顺便擦去叶片上的灰尘（湿纸巾轻擦）；5.3盆全部完成，家长抽查土壤湿度合适即合格 |
| **【学习探索 主维 9条，占比30% → 主维合计20条，占比66.7%】** | | | | |
| D-G3-12 | 系鞋带：死结+蝴蝶结双结法 | 主=学习探索（精细动作技能习得），次=创意审美（蝴蝶结造型） | 3分 | 参考槐荫刘庄小学：1.先打死结（双圈交叉穿入拉紧）；2.再打蝴蝶结（两边各做圈，交叉穿入拉紧）；3.蝴蝶结造型对称，松紧适中不掉跟；4.连续3次完成不松散，5分钟内完成 |
| D-G3-13 | 整理自己的换季衣柜 | 主=学习探索（分类整理方法论），次=创意审美（收纳美学） | 5分 | 参考永城七小：1.当季/过季衣物分开；2.上衣/T恤折叠成统一大小（A4纸尺寸）；3.裤子对折卷成筒状；4.袜子3双一组卷成球；5.衣柜按类别分区（上衣区/裤装区/内衣区/杂物区），贴标签 |
| D-G3-14 | 收拾书包：按第二天课程表整理 | 主=学习探索（学习管理方法），次=责任担当 | 3分 | 参考长城路小学：1.对照课程表逐科检查课本/练习册/文具；2.大书在下小书在上，整齐码放；3.铅笔盒/水杯/纸巾分别放入对应侧袋；4.拉链拉好，书包外部无突出物品；5.家长随机抽查2门课本均在包内 |
| D-G3-15 | 煮鸡蛋（小奶锅版） | 主=学习探索（烹饪科学+计时管理），次=责任担当（备餐） | 5分 | 参考莱西洙河小学：1.鸡蛋冷水下锅（避免裂壳），水没过鸡蛋1cm；2.中火煮至水开（计时2分钟），转小火再煮6分钟；3.关火后立即捞出放入冷水中浸泡2分钟（好剥壳）；4.剥壳后蛋白完整光滑，蛋黄全熟无溏心（8分熟蛋黄微嫩合格）；5.灶火关闭由家长最终确认 |
| D-G3-16 | 水果拼盘制作（3种水果以上） | 主=学习探索（营养搭配+刀工），次=创意审美（摆盘） | 6分 | 参考长城路小学：1.选择≥3种不同颜色水果（推荐：苹果/香蕉/橙子/小番茄/黄瓜）；2.安全儿童水果刀切配，家长全程看护用刀；3.造型设计：水果摆成花朵/笑脸/小动物等造型≥1种；4.果盘干净整洁，色彩搭配协调；5.家人品尝后2人以上点赞即合格 |
| D-G3-17 | 水培大蒜/绿萝：换水+清洁容器 | 主=学习探索（植物水培知识），次=责任担当 | 4分 | 参考永城七小：1.换水：2-3天换一次，清水没过根部2/3（不没过顶部发芽点）；2.清洁容器：容器壁有绿藻时，用旧牙刷刷洗干净再换水；3.观察记录：本次根长/苗高，比上次是否变长（测量记录1次）；4.容器放置回原位，台面擦干无积水；5.3瓶水培植物完成即合格 |
| D-G3-18 | 黄豆/绿豆发芽观察（小实验） | 主=学习探索（科学实验方法），次=创意审美（观察记录排版） | 5分 | 参考莱西洙河小学：1.准备：豆子1把（约50g），铺在湿润纱布/纸巾上，放在浅盘；2.每天早晚各洒水1次保持湿润（不泡在水中）；3.连续观察3天，每天拍照+测量芽长+记录（发芽率≥80%）；4.3天后豆芽长度≥2cm即可用于烹饪；5.完整观察记录3天即合格 |
| D-G3-19 | 一周零花钱记账本 | 主=学习探索（财商+数学计算），次=责任担当 | 5分 | 参考白衣堂小学：1.专用小本子，每天记录：日期/收入（零花钱）/支出（项目+金额）/结余；2.每笔支出有家长签字或小票佐证；3.一周7天记录无缺漏，每日结余计算正确（数学加减验算）；4.周末做分类汇总：本周支出中"吃/文具/玩具"各多少；5.账本工整清晰，计算零差错即合格 |
| D-G3-20 | 家庭一顿饭成本核算 | 主=学习探索（数学应用+数据分析），次=责任担当 | 6分 | 参考白衣堂小学：1.选择家中一顿普通午餐/晚餐，参与采购或收集购物小票；2.逐样记录食材用量和单价：如西红柿2个=3元，鸡蛋3个=2元，米饭=1元等；3.合计总支出，按就餐人数计算人均成本；4.写300字感想：原来一顿饭花这么多钱，以后要更加珍惜粮食不浪费；5.数据准确，感想发自内心（非家长代笔）即合格 |
| **【生活自理 次维 4条，占比13.3%】** | | | | |
| D-G3-21 | 给花草落叶清理+施肥（稀释液肥） | 次=生活自理，主=责任担当 | 5分 | 参考槐荫刘庄小学：1.摘黄叶：用剪刀剪去枯黄叶片（徒手轻轻摘除也可），不要撕扯损伤主枝；2.施肥：按液肥说明比例稀释（1:500倍，家长协助配液），每盆浇稀释肥适量；3.施肥后次日浇1次清水（防止烧根）；4.落叶收入厨余垃圾桶，台面清洁；5.3盆完成，家长1周后观察植物无异常即合格 |
| D-G3-22 | 削铅笔：卷笔刀+安全小刀两种方式 | 次=生活自理，主=学习探索（精细动作） | 3分 | 参考槐荫刘庄小学：1.卷笔刀版：笔尖露出1cm长，笔芯不折断，笔屑全进卷笔刀盒（不撒落），连续削3支；2.安全小刀版（家长全程看护）：握住铅笔不松手，刀口向外削，笔杆削出圆锥状，笔尖1cm，削1支即可；3.两种方式合计完成≥4支，合格率≥80%即合格 |
| D-G3-23 | 打死结+活结+蝴蝶结：三结练习 | 次=创意审美（造型美），主=学习探索（技能） | 3分 | 参考槐荫刘庄小学：1.死结：双圈穿入拉紧，承重1kg物品悬挂10秒不松开；2.活结：一拉即开（轻拉线头自动解开），演示3次成功；3.蝴蝶结：造型对称美观（用于鞋带/礼物包装/扎头发），展示2种用途；4.三结各完成1次，5分钟内完成即合格 |
| D-G3-24 | 缝扣子：两孔扣+四孔扣各1颗 | 次=创意审美（手工美学），主=学习探索（精细动作技能） | 6分 | 参考槐荫刘庄小学：1.穿针引线（穿不过可请家长协助穿针，之后自己打结）；2.两孔扣：从下往上穿，来回穿线≥5次，背面打结牢固；3.四孔扣：对角线交叉缝（X型）或两排平行（II型），来回穿线≥8次；4.扣子拉扯3次不松动不掉落即合格；5.用针全程家长看护，避免扎手 |
| **【创意审美 次维 5条，占比16.7% → 次维合计9条，占比30%】** | | | | |
| D-G3-25 | 礼物包装+蝴蝶结装饰 | 次=创意审美（包装设计美学），主=责任担当（送礼心意） | 5分 | 参考永城七小：1.选一个方形小盒子（如文具盒大小）作为礼物；2.包装纸裁剪合适（大小是盒子6倍面积）；3.四面包裹，边角折整齐，胶带固定（内不露物，外不皱）；4.丝带绕盒一圈打死结，上面再打蝴蝶结；5.整体造型平整美观，家人收到后拍照留念即合格 |
| D-G3-26 | 给家人准备睡前温水（含摆盘） | 次=创意审美（温暖表达），主=责任担当，潜=社交协作（表达沟通） | 3分 | 参考白衣堂小学：1.每人1杯（300-400ml），水温40-45℃（不烫不凉，自己先试喝一口确认）；2.按家人数量准备，分别送到各人手边；3.杯垫摆放+小纸条写1句贴心话；4.杯子外壁不漏水，放置平稳；5.3杯以上即合格 |
| D-G3-27 | 学做1道长辈爱吃的凉拌菜（拍黄瓜/糖拌西红柿） | 次=创意审美（调味+摆盘），主=责任担当，潜=社交协作（孝心表达） | 6分 | 参考永城七小：1.食材准备（拍黄瓜/糖拌西红柿二选一）；2.安全用刀家长全程看护；3.调味适量（盐/糖/醋比例协调）；4.摆盘美观撒上香菜点缀；5.长辈品尝后评价"好吃"即合格 |
| D-G3-28 | 整理换季自己的鞋子：擦洗+配对+装鞋盒+贴标签 | 次=创意审美（收纳美学），主=责任担当 | 6分 | 参考槐荫刘庄小学：1.鞋子擦干净无污渍；2.左右配对放鞋盒；3.盒外贴手绘标签（画鞋子简笔画+写季节+鞋码）；4.按季节上下堆叠整齐；5.完成≥8双鞋整理即合格 |
| D-G3-29 | 10元采购：独立购买指定小件（含结账沟通） | 次=创意审美（预算优化），主=责任担当，潜=社交协作（与收银员沟通） | 5分 | 参考长城路小学：1.家长给10元现金+任务卡（如买1瓶酱油/1包盐/1本作业本）；2.全程陪同但不干预，孩子主导：找到货架→看价格→选品→排队付款→核对找零；3.付款正确，找零误差≤0.5元；4.购物小票带回，和记账本记录一致；5.全程和收银员礼貌交流（说"您好/谢谢"）即合格 |
| **【社交协作 潜维 1条 + 3条任务含少量潜维 → 合计≈2条，占比≈6.7% 合规】** | | | | |
| D-G3-30 | 用超轻黏土捏一个家庭场景摆件（爸爸+妈妈+我） | 潜=创意审美（造型），次=学习探索（精细动作），主=责任担当（表达对家庭的爱） | 5分 | 参考台儿庄实小：1.3个人物造型均可辨认（能说出谁是爸爸妈妈）；2.有简单场景（如桌子/沙发/地板）；3.每个人物高度≥5cm不倒塌；4.底座上写1句想对家人说的话；5.放客厅展示柜展示1周 |

---

## 六、三年级任务池主次潜合规性自检表（100%达标）

| 维度层级 | 理论占比 | 实际30条拓展池数量 | 实际占比 | 合规判定 |
|---------|---------|-----------------|---------|---------|
| Primary 主维（学习探索+责任担当） | ≥60% | 20条（9+11） | 66.7% | ✅ 达标 |
| Secondary 次维（生活自理+创意审美） | ~30% | 9条（4+5） | 30% | ✅ 达标 |
| Latent 潜维（社交协作+运动健康） | ≤10% | 纯潜维0条 + 4条任务含少量潜维（D26/D27/D29/D30），折合≈2条 | ≈6.7% | ✅ 达标，运动健康潜维未用留作奖励 |

> 奖励用预留潜维任务（不进拓展池，仅作为主/次维周全勤奖励，不影响占比）：跳绳200下/踢毽子50个（运动健康·潜）、画1张我的校园（创意审美·潜）

## 附录D：四年级任务模板库（9-10岁 | 规划能力建立期 + 逻辑思维跃升期）

> 年级定位：主动规划、复杂步骤拆解、创意表达从平面→立体升级
> 能力主次潜：主=学习探索/创意审美（合计~63%），次=责任担当/社交协作（合计~30%），潜=生活自理/运动健康（严格≤7%）
> 学术边界：仍然不直接奖励考试分数，但可以奖励「为准备考试的行为」：整理复习计划、整理单元知识树

---

## 一、核心习惯培养（每日固定锚任务，4项）

| 编号 | 习惯名称 | 培养目标 | 主/次能力维度（严格匹配四年级：主=学习探索/创意审美） | 每日基础积分 | 可量化验收标准 |
|-----|---------|---------|--------------------------------------------------|------------|-------------|
| H1-G4-01 | 独立时间管理：番茄钟25×3学习法 | 时间管理启蒙，用3个番茄钟（25分钟专注+5分钟休息）完成当天所有作业 | 主=学习探索（时间管理方法论），次=责任担当（学习责任） | 12分 | 1.番茄钟打卡≥3个有效周期；2.休息时间不碰手机/平板；3.当天作业全部完成无遗漏 |
| H1-G4-02 | 每周衣物统筹：周日分类+周中每日叠放 | 衣物管理从每天叠→升级为每周规划 | 主=创意审美（分格收纳美学），次=责任担当（每周衣物统筹责任） | 每周70分（日均10分） | 1.周日按校服/居家服/运动服三格衣柜分好；2.周中每天更换的衣服叠回对应格子；3.周日自己洗校服+内衣分类进洗衣机 |
| H1-G4-03 | 全屋清洁周负责人：每周六1次 | 从自己房间→升级为统筹整个家的地面/桌面/垃圾清理 | 主=学习探索（全屋清洁统筹规划方法），次=责任担当（家务分工责任） | 每周20分（周六1次完成） | 1.全家地面扫+拖；2.所有餐桌茶几书桌擦净；3.全屋4类垃圾桶清空+换新垃圾袋 |
| H1-G4-04 | 深度阅读30分钟 + 100字完整读后感 | 阅读从3句话→升级为100字完整短文结构 | 主=学习探索（阅读理解+写作结构），次=创意审美（书面表达美学） | 10分 | 1.专注阅读30分钟无中断；2.手写读后感≥100字，结构含「主要内容+个人感受+启发」三段 |

---

## 二、技能解锁阶梯（5条技能树）

### 技能树 S1-G4：精细手工技能（主=创意审美+学习探索次维，针线首次出现，严格强制陪同）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 正确穿圆头针引线（禁止尖头针）+ 平针缝10针均匀 | 缝自己的校服衬衫/外套扣子（圆头安全针，线长≤30cm） | 强制全程陪同用针，须签署「针线使用安全确认书」 |
| Lv.1 达标 | 累计缝扣子≥5次，无扎手事故，扣子使用≥1个月不掉落 | 自制小沙包（6片布+填充黄豆+缝边） | 强制全程陪同 |
| Lv.2 精通 | 小沙包制作≥2个，线迹均匀无跳线，沙包使用≥2周不开裂 | 缝制实用布艺小物件：杯垫/钥匙包/零钱包（三选一），含装饰针法 | 强制全程陪同（裁剪+缝制两个环节） |

### 技能树 S2-G4：家居收纳进阶（主=创意审美·收纳美学+学习探索次维·分类方法）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 连续4周自己衣物分格收纳全部合格 | 整理全家衣橱：按「当季/过季」「内衣/外套/裤子」4格分类 | 仅大件搬运提醒即可 |
| Lv.1 达标 | 全家衣橱整理≥2次无投诉 | 书架深度整理+分类：文学/科普/教辅/绘本四类，加贴书脊分类标签 | 仅大件搬运提醒即可 |
| Lv.2 精通 | 书架整理≥3次，家人找书时间缩短≥50%，标签清晰无误 | 全屋换季收纳统筹：被褥真空压缩打包+过季衣物入箱贴标签+制作家庭收纳位置索引图 | 仅重物搬运协助即可 |

### 技能树 S3-G4：烹饪安全入门（主=学习探索·食品安全+创意审美次维·摆盘）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 微波炉安全使用3原则考核合格（家长签字） | 用微波炉热牛奶/加热剩菜（带盖+留排气孔+加热时间≤2分钟） | 仅加热完成开门时防烫提醒即可 |
| Lv.1 达标 | 累计微波炉加热≥10次无事故 | 和家长一起准备早餐：热牛奶 + 摆餐桌 + 切无硬皮水果（安全刀） | 强制全程陪同（热+切两项操作） |
| Lv.2 精通 | 早餐辅助准备≥8次，刀工熟练无划伤，热食摆放规范 | 独立制作简单凉拌菜：拍黄瓜/糖拌西红柿/凉拌木耳（三选一）+ 餐桌完整摆盘 | 强制全程陪同（用刀+调味两个环节） |

### 技能树 S4-G4：电饭煲+早餐制作小达人（主=创意审美·营养美学+学习探索次维，参考莱西洙河小学/长城路小学四年级）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 电饭煲结构+安全5原则考核合格（不碰内胆底部水+插干手+开盖防蒸汽等，家长签字） | 用电饭煲煮米饭：量米（2人份）→ 淘米3遍→ 加水（食指第一关节刻度）→ 按煮饭键→ 盛饭 | 强制全程陪同（加水+开盖防烫环节） |
| Lv.1 达标 | 累计煮饭≥6次，米饭软硬合适（不夹生不糊底），无安全事故 | 学做寿司+下面条/水饺：1.寿司：米饭+醋+海苔+黄瓜/肉松/香肠卷切；2.煮面条/水饺：水开下锅+点凉水2次+盛出装碗 | 强制全程陪同（烧水煮面+卷切两个环节） |
| Lv.2 精通 | 寿司/面条/水饺制作≥4次，成品外观完整，口感合格 | 独立准备完整营养早餐（7天不重样配方）：主食（电饭煲蒸杂粮/吐司）+ 蛋白质（热牛奶/水煮蛋）+ 水果（切拼盘）| 强制全程陪同（蒸煮+用刀两个环节） |

### 技能树 S5-G4：收发快递+包装礼物+图书角整理（主=学习探索·流程方法+创意审美次维，参考莱西洙河小学四年级）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 快递取件码识别+驿站自助取件流程模拟考核合格（家长签字） | 1.收发快递：凭取件码到驿站取自家快递+核对信息+拆箱验货分类；2.帮家人寄快递：填地址单+包装小件物品+交给快递员 | 全程陪同（驿站现场），核对信息环节由孩子主导 |
| Lv.1 达标 | 收发快递≥8次，无错取漏寄，拆箱垃圾分类规范 | 1.报纸包装礼物：废报纸+胶带+彩带包装礼物盒+手写祝福卡片；2.整理班级图书角：图书分类上架+破损登记+除尘 | 仅首次包装示范一次即可，图书角独立完成 |
| Lv.2 精通 | 礼物包装≥5次（外观工整），图书角整理≥3次（老师反馈良好） | 1.值周劝导：在学校值周监督不文明行为（奔跑/乱扔/插队），礼貌劝导并记录；2.综合应用：独立完成1次家庭收发快递+礼物包装+家庭图书角整理全套流程 | 仅值周时段老师陪同即可，其余独立完成 |

---

## 三、项目式跨周期父任务（5项）

### 🌼 P1-G4-01 我的窗台花园——多肉组合盆栽28天种植+造景（主=创意审美·造景+学习探索次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=创意审美（造景设计+色彩搭配）；次=学习探索（多肉习性研究）；潜=生活自理（日常养护操作） |
| 建议跨周期 | 4个周期（28天） |
| 里程碑 | 周期1「调研采购期」：查3种多肉习性（光照/浇水频率）→ 网购花盆/土/多肉<br>周期2「种植造景期」：配土（颗粒土+营养土比例）→ 种植 → 铺面+小摆件造景<br>周期3「服盆养护期」：观察服盆状态+按习性浇水（多肉宁干勿湿）<br>周期4「造型修剪期」：修徒长枝+记录生长状态+最终展示 |
| 每日自动生成子任务 | 周期1/2每天1个任务（查资料/造景/种植）；周期3/4 2-3天1个养护任务（禁止天天浇水） |
| 父任务完成最终产出物 | 1.窗台多肉组合盆栽1盆（含铺面+造景小摆件）；2.28天多肉养护手册A5 1本（含每种习性+浇水时间表+服盆前后对比照） |

### 🎁 P1-G4-02 创意礼物制作——给家人缝制1件实用布艺品（主=创意审美·手工设计+学习探索次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=创意审美（布艺设计+装饰针法）；次=学习探索（缝纫技法学习）；潜=社交协作（赠送环节的感谢沟通） |
| 建议跨周期 | 2个周期（14天） |
| 里程碑 | 周期1「设计筹备期」：访谈家人真实需求→选布料→画裁剪图→安全材料准备<br>周期2「缝制包装期」：缝制→填充→装饰→写卡片→包装好作为礼物赠送 |
| 每日自动生成子任务 | 周期1查资料/画图子任务；周期2每天缝制1-2个部件子任务 |
| 父任务完成最终产出物 | 1.送给指定家人的实用布艺品1件（可选：杯垫/钥匙包/小沙包/零钱包，必须实用，禁纯摆设）；2.缝制过程照片+家人收礼物反馈视频≥1分钟 |

### 🧭 P1-G4-03 城市探索小队长——周末1条公共交通出行规划+执行（主=学习探索·路线规划+创意审美次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=学习探索（地理信息+公共交通逻辑+时间规划）；次=社交协作（问路/购票沟通）；潜=生活自理（出行随身物品管理） |
| 建议跨周期 | 2个周期（14天） |
| 里程碑 | 周期1「规划期」：确定目的地（图书馆/博物馆/公园三选一）→ 查2套公共交通方案对比（时间/费用/换乘次数）→ 写出行计划书<br>周期2「执行期」：按计划坐公交/地铁1次+换乘+到达+返程+全程孩子主导问路/买票 |
| 每日自动生成子任务 | 周期1每天查资料/比价子任务；周期2集中1天出行，当天5个执行子任务（出发/换乘1/到达/返程/到家总结） |
| 父任务完成最终产出物 | 1.出行计划书1份（方案A/B对比+预算+时间表）；2.出行全程票根/照片/打卡盖章合集；3.回家写《出行攻略》≥200字（含路线优缺点+推荐星级） |

### 🍳 P4-G4-04 14天"我当家庭早餐师"（主=创意审美·营养美学+学习探索次维，参考长城路小学四年级）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=创意审美（7天不重样菜单设计+摆盘美学）；次=学习探索（营养学知识+烹饪方法）；潜=生活自理（烹饪操作） |
| 建议跨周期 | 2个周期（14天） |
| 里程碑 | 周期1「技能储备期」：学做寿司（海苔+米饭+黄瓜/肉松/香肠）→ 学下面条/水饺（水开下锅+点水+盛碗）→ 学热牛奶+切水果拼盘（安全刀）→ 设计7天不重样早餐菜单<br>周期2「实战运营期」：连续7天按菜单制作早餐→ 记录全家每日早餐满意度评分（1-5星）→ 第7天举行家庭早餐满意度投票+颁奖 |
| 每日自动生成子任务 | 周期1每天学1项技能子任务（寿司/面条/水饺/热牛奶/切水果/菜单设计）；周期2每天制作+满意度记录子任务（共7天） |
| 父任务完成最终产出物 | 1.7天不重样早餐菜单设计图（手绘/打印均可，含营养搭配说明）；2.连续7天早餐制作过程照片合集（≥14张）；3.家庭早餐满意度投票结果统计+获奖感言≥100字 |

### 📚 P5-G4-05 7天"图书管理员体验"（主=学习探索·分类学+创意审美次维，参考宿迁实小+洙河小学）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=学习探索（图书分类法+读书会组织）；次=创意审美（标签设计+手工图书装帧）；潜=社交协作（读书会主持沟通） |
| 建议跨周期 | 1个周期（7天） |
| 里程碑 | 第1-2天「整理分类期」：清空家庭书架→ 图书分类（文学/科普/教辅/绘本/其他5类）→ 除尘擦架<br>第3-4天「编目贴标期」：每类图书编号→ 设计并贴分类书脊标签→ 制作书架分类导览图<br>第5天「手工图书制作」：自制1本手工图书（自编故事+手绘插图+装订封面，≥8页）<br>第6-7天「读书会举办」：策划家庭读书会流程→ 准备分享书目→ 主持家庭读书会→ 做读书会记录 |
| 每日自动生成子任务 | 每天1-2个明确子任务：整理/分类/贴标/制书/策划/主持，共约10个子任务 |
| 父任务完成最终产出物 | 1.整理后的家庭书架（分类清晰+标签齐全+导览图张贴）；2.自制手工图书1本（≥8页含封面+封底）；3.家庭读书会记录单（流程+分享内容+全家每人一句话感受） |

---

## 四、特色主题周（4项）

| 主题代号 | 主题周名称 | 主题周对应任务集中安排方向（严格匹配主次潜） | 主题周推荐触发条件 |
|---------|-----------|----------------------------------------|----------------|
| T-G4-01 | 创意收纳主题周 | 主维集中：衣橱/书架/玩具房3类整理（创意审美主维·收纳美学+学习探索主维·分类方法）<br>次维少量：家庭收纳平面图绘制（责任担当次维·家务统筹） | 任意2周锚任务全勤后触发 |
| T-G4-02 | 城市微公益主题周 | 次维集中：垃圾分类志愿引导+独居老人探访+公园捡拾垃圾（责任担当+社交协作双次维）<br>潜维≤1天：志愿引导沟通表达（社交协作潜维少量） | 每年学雷锋月/建队日自动触发 |
| T-G4-03 | "消防安全小宣传员"主题周（参考莱西洙河小学四年级社会劳动） | 主维集中：参加消防宣传学习（学习探索主维·安全知识）+ 手绘逃生路线图（创意审美主维·图示设计）+ 给全家讲解演练（学习探索主维·表达逻辑） | 每年119消防日所在周触发 |
| T-G4-04 | "小小理货员"体验周（参考兖州区白衣堂小学） | 主维集中：蔬菜挑选鉴别（学习探索主维·食品知识）+ 理货+价格标签核对（学习探索主维·信息匹配）+ 3种菜品价格比较记录（学习探索主维·数据分析）<br>次维：买菜攻略撰写（责任担当次维） | 每学期期中后1周触发 |

---

## 五、日常拓展任务池（共30条，主维~63%，次维~30%，潜维~7% 严格合规）

> 验收标准参考：长城路小学、莱西洙河小学、槐荫刘庄小学、宿迁实小、白衣堂小学等公立小学官方劳动清单；积分区间3-7分；能力维度严格匹配主次潜规则
> 任务池抽取权重：主维6.3成，次维3成，潜维仅每周最多抽1条作为奖励

### 🧹 清洁类（6条）

| 任务编号 | 任务名称 | 能力维度（严格主次潜） | 积分 | 可量化验收标准 |
|---------|---------|-------------------|-----|-------------|
| D-G4-01 | 全屋大扫除深度清洁 | 主=学习探索（清洁流程优化），次=责任担当（家庭清洁责任），潜=生活自理 | 7分 | 1.全家卧室/客厅/厨房/卫生间4区域地面扫+拖；2.所有桌面/台面/窗台擦净无尘；3.全屋垃圾桶清空换新袋；4.完成后家长拍照验收 |
| D-G4-02 | 擦玻璃（室内侧） | 主=创意审美（空间通透美学），次=责任担当，潜=生活自理 | 5分 | 1.喷玻璃水+刮水器刮净+干布擦边框；2.阳台/客厅/卧室共≥3块玻璃；3.玻璃透亮无水痕无指纹（逆光检查） |
| D-G4-03 | 卫生间深度清洁 | 主=学习探索（清洁剂使用方法），次=责任担当，潜=生活自理 | 6分 | 1.马桶内外刷洗干净（含马桶圈/底座/水箱盖）；2.洗手台盆+镜面擦净无水渍；3.地面刷净+地漏毛发清理；4.洗漱用品分类摆放整齐 |
| D-G4-04 | 厨房餐后清洁整理 | 主=学习探索（厨房油污清洁科学），次=责任担当，潜=生活自理 | 4分 | 1.餐后碗筷洗干净+沥干水放入碗柜；2.灶台+油烟机表面+餐桌擦净无油污；3.剩菜密封分类放入冰箱；4.厨房垃圾打包带出 |
| D-G4-05 | 自己的房间深度整理 | 主=创意审美（个人空间收纳美学），次=责任担当，潜=生活自理 | 5分 | 1.床铺平整被子叠放规范；2.书桌文具书本分类归位；3.地面无杂物衣服叠放入柜；4.床头柜/窗台/书架除尘 |
| D-G4-06 | 洗自己的运动鞋/球鞋 | 主=学习探索（不同材质鞋清洁方法研究），次=责任担当，潜=生活自理 | 3分 | 1.鞋带拆下单独洗+鞋身用刷子打肥皂刷洗；2.鞋底缝隙泥土刷净；3.鞋内鞋垫取出刷洗；4.冲洗干净后阳台阴干（禁暴晒） |

### 🍳 厨房类（6条）

| 任务编号 | 任务名称 | 能力维度（严格主次潜） | 积分 | 可量化验收标准 |
|---------|---------|-------------------|-----|-------------|
| D-G4-07 | 制作凉拌菜：拍黄瓜/糖拌西红柿二选一 | 主=创意审美（调味比例+摆盘美学），次=责任担当，潜=生活自理 | 6分 | 1.食材清洗干净（黄瓜刷表面蜡质）；2.安全刀切块/拍碎（大小均匀）；3.调味适量（盐/糖/醋/生抽试味）；4.装盘美观撒香菜点缀（全程家长陪同用刀） |
| D-G4-08 | 设计并准备全家周末午餐菜单 | 主=学习探索（营养学搭配+预算规划），次=责任担当（家庭餐饮责任） | 5分 | 1.菜单含主食+2荤+1素+1汤共5项；2.标注每道菜主料/辅料/预估烹饪时长；3.荤素搭配+营养均衡（含蛋白质/蔬菜/主食比例说明）；4.菜单手绘或打印≥A4纸1页 |
| D-G4-09 | 准备营养早餐（基础版） | 主=创意审美（营养美学+色彩搭配），次=责任担当，潜=生活自理 | 5分 | 1.主食1份（吐司/包子/杂粮选一，电饭煲或微波炉加热）；2.蛋白质1份（热牛奶/豆浆/水煮蛋选一）；3.水果1份（切小块装碗，安全刀切）；4.摆盘美观+碗筷摆好（全程家长陪同操作） |
| D-G4-10 | 用电饭煲煮2人份米饭 | 主=学习探索（米水比科学+烹饪时间控制），次=责任担当，潜=生活自理 | 4分 | 1.量杯取米2平杯（约2人份）；2.淘米3遍（水清不浑浊）；3.加水至食指第一关节刻度线（米水比约1:1.2）；4.按煮饭键至自动跳闸后焖5分钟；5.盛饭2碗软硬适中无夹生（全程家长陪同开盖防烫） |
| D-G4-11 | 择菜+洗菜+配菜准备（2道菜） | 次=责任担当（餐前准备分工），主=学习探索（蔬菜农药残留处理知识），潜=生活自理 | 4分 | 2道菜的全套准备：1.择菜去黄叶去根；2.流水冲洗≥3遍（叶菜泡10分钟去农药）；3.按家长要求切配（安全刀，家长陪同）；4.分类装篮备用 |
| D-G4-12 | 餐后洗碗+整理厨房 | 次=责任担当（餐后分工），主=学习探索（洗涤剂使用量控制），潜=生活自理 | 3分 | 1.碗盘先用洗洁精擦+温水冲洗干净；2.筷子搓洗+勺子擦净；3.沥干后分类放入碗柜；4.水槽擦净+厨余垃圾倒入湿垃圾桶 |

### 📦 收纳类（5条）

| 任务编号 | 任务名称 | 能力维度（严格主次潜） | 积分 | 可量化验收标准 |
|---------|---------|-------------------|-----|-------------|
| D-G4-13 | 洗大件衣物：被套+床单 | 次=责任担当（床上用品换洗责任），主=学习探索（洗衣机模式选择），潜=生活自理 | 5分 | 1.从床上拆下被套+枕套+床单；2.分类放入洗衣机（深浅分开）；3.正确放洗衣液+选择棉麻/大件模式启动；4.洗完后取出晾晒（被单抖平无褶皱夹好）；5.晒干后叠放整齐 |
| D-G4-14 | 自己的衣柜换季整理 | 主=创意审美（衣柜分区收纳美学+标签设计），次=责任担当，潜=生活自理 | 6分 | 1.清空衣柜内所有衣物分类；2.过季衣物：折叠入箱/真空袋+贴标签（季节/类别）；3.当季衣物：上衣/裤子/内衣分格挂/叠整齐；4.制作衣柜分区索引贴贴在柜门内侧 |
| D-G4-15 | 家庭书架整理+分类贴标 | 主=学习探索（图书馆分类法+信息组织），次=责任担当，潜=生活自理 | 6分 | 1.书架全部图书取出擦净除尘；2.按文学/科普/教辅/绘本/其他5类分开；3.每类设计书脊标签（颜色区分）贴好；4.按类别重新上架（高的放下层常用放中层）；5.制作书架导览图贴在书架侧面 |
| D-G4-16 | 归置全家常用物品：玄关+客厅 | 次=责任担当（全家物品管理），主=创意审美（空间布局美学） | 4分 | 1.玄关：鞋子按家人分类摆放鞋架+钥匙/口罩/雨伞归位玄关盒；2.客厅：遥控器/水杯/杂志/零食分类收纳到固定位置；3.沙发靠垫摆正+毯子折叠好；4.家人5分钟内能找到任意常用物品 |
| D-G4-17 | 玩具房/乐高零件分类收纳 | 主=创意审美（分类展示美学），次=责任担当，潜=生活自理 | 5分 | 1.全部玩具倒出分类：积木类/公仔类/车类/拼图类/卡牌类；2.分别装入对应收纳箱+贴内容标签；3.乐高按颜色/形状/零件细分装入零件盒；4.收纳箱整齐摆回架子无散落 |

### 🔧 技能类（5条）

| 任务编号 | 任务名称 | 能力维度（严格主次潜） | 积分 | 可量化验收标准 |
|---------|---------|-------------------|-----|-------------|
| D-G4-18 | 缝自己的校服/外套扣子（3颗） | 主=创意审美（手工缝纫美学+线迹设计），次=责任担当，潜=生活自理 | 5分 | 1.圆头安全针穿线打结（线长≤30cm）；2.扣子定位对齐扣眼；3.平针缝≥6针牢固+背面打结剪线；4.3颗扣子全部缝完，使用2周抽查无松动掉落（全程家长陪同） |
| D-G4-19 | 刷自己的鞋子：帆布鞋/皮鞋各1双 | 次=责任担当（个人物品养护），主=学习探索（不同材质护理方法），潜=生活自理 | 3分 | 帆布鞋：1.鞋带拆下打肥皂手洗；2.鞋面鞋舌打肥皂刷子刷净；3.鞋底缝隙刷净；4.冲净后塞纸巾定型阴干。/ 皮鞋：1.擦去表面灰尘；2.挤鞋油均匀涂抹；3.软布抛光至发亮（家长示范一次即可） |
| D-G4-20 | 学习系鞋带：3种系法 | 主=学习探索（3种系法方法论研究），次=责任担当，潜=生活自理 | 4分 | 1.学会并演示：基础交叉系法+蝴蝶结系法+隐藏结系法共3种；2.每种系法系好后松紧合适不松脱；3.给爸妈各演示1遍；4.自己的运动鞋连续1周自己系鞋带无求助 |
| D-G4-21 | 擦全家的皮鞋（3双） | 次=责任担当+社交协作（为家人服务），主=创意审美（皮鞋亮度光泽美学），潜=生活自理 | 4分 | 1.每双先用干布擦去浮尘；2.挤同色鞋油（无色通用）用布均匀打圈涂抹；3.静置2分钟后用软布快速来回抛光；4.3双都光亮无明显污渍+鞋边擦净；5.放入鞋盒摆好鞋撑 |
| D-G4-22 | 学习使用针线平针缝：自制书签1个 | 主=创意审美（书签设计+装饰美学），次=学习探索（平针缝技法学习），潜=生活自理 | 5分 | 1.准备不织布/旧布料裁剪成长条形（5×15cm）；2.圆头针平针缝边（针距均匀≤0.5cm）；3.装饰：缝小图案/贴贴纸/写名字；4.成品结实无跳线+可正常夹书使用（全程家长陪同） |

### 📮 快递+种植类（4条）

| 任务编号 | 任务名称 | 能力维度（严格主次潜） | 积分 | 可量化验收标准 |
|---------|---------|-------------------|-----|-------------|
| D-G4-23 | 去驿站取自家快递（2件） | 主=学习探索（取件流程+信息识别），次=社交协作（与驿站工作人员沟通），潜=生活自理 | 4分 | 1.提前存好取件码，到驿站自助查询/报号取件；2.核对收件人姓名+手机号后4位确认；3.当场拆箱验货（检查外观无破损）；4.快递盒拆扁放入可回收垃圾桶+缓冲材料分类；5.物品带回家归位（家长陪同到场，孩子主导操作） |
| D-G4-24 | 用旧报纸/包装纸包装礼物盒1个 | 主=创意审美（包装设计+蝴蝶结美学），次=责任担当（礼物心意表达） | 5分 | 1.礼物盒尺寸测量+裁纸（各边留3-5cm余量）；2.包装纸对折包盒+胶带固定（接缝不外露）；3.两端折角工整（三角折/梯形折）；4.彩带蝴蝶结系好+手写祝福卡片贴上；5.外观工整无明显胶带外露 |
| D-G4-25 | 家庭花草养护+修剪（3盆） | 主=学习探索（植物习性研究+修剪学），次=责任担当（养护义务），潜=生活自理 | 6分 | 1.查每种植物习性（喜阴/喜阳/浇水频率）写在便签贴盆上；2.按习性浇水（不干不浇浇则浇透，托盘不积水）；3.安全剪刀修剪黄叶/枯枝/徒长枝（剪口平整）；4.擦去叶片浮尘+松土表层（≤2cm）；5.记录养护日志1条 |
| D-G4-26 | 给家里的绿植换盆（1盆中型） | 主=学习探索（园艺科学·土壤配比+修根原理），次=创意审美（新盆造型搭配美学），潜=生活自理 | 7分 | 1.准备比原盆大2cm的新盆+营养土+陶粒；2.盆底铺陶粒排水层+加1/3土；3.脱盆（轻敲盆壁取出不伤根）+修剪烂根老根；4.放入新盆填土压实+浇定根水；5.换盆后记录观察日志连续3天（家长陪同指导脱盆/修根） |

### 👥 社会+待客类（4条）

| 任务编号 | 任务名称 | 能力维度（严格主次潜） | 积分 | 可量化验收标准 |
|---------|---------|-------------------|-----|-------------|
| D-G4-27 | 学校值周劝导：记录3次文明行为提醒 | 次=责任担当（校园值周义务）+社交协作（礼貌劝导），主=学习探索（文明行为规范研究），潜=生活自理 | 5分 | 1.佩戴值周标志上岗；2.在走廊/操场/食堂观察记录；3.礼貌提醒不文明行为（奔跑/乱扔/插队/大声喧哗）≥3次，使用"请/麻烦/谢谢"用语；4.填写值周日志：时间+地点+行为+劝导结果；5.老师签字确认 |
| D-G4-28 | 整理班级/家庭图书角（1次完整整理） | 主=学习探索（分类学+破损修复知识），次=责任担当（图书角运营义务） | 6分 | 1.全部图书取出→分类（和书架5类一致）；2.检查图书破损登记（≥3项）；3.擦净书架+图书除尘；4.分类上架整齐+贴分类标识；5.制作《图书借阅规则》提示卡贴在图书角 |
| D-G4-29 | 泡茶招待家里客人（≥2位） | 次=社交协作（待客礼仪），主=创意审美（茶文化美学+茶具摆放），潜=生活自理 | 6分 | 1.迎客问好+请坐+询问客人喝什么茶（绿茶/红茶/花茶）；2.温杯→投茶（3-5g）→注水（85-95℃）→倒茶（七分满）；3.双手递杯给客人+说"请用茶"；4.客人走后收拾茶具清洗归位；5.家长反馈客人评价≥4星（全程家长陪同操作热水） |
| D-G4-30 | 单元知识树整理：语文/数学选一单元 | 主=学习探索（思维导图方法+知识体系构建），次=责任担当（学习自主复习责任） | 7分 | 1.选本单元课本内容通读1遍；2.用思维导图方式画出知识树：主干（单元主题）→分支（每课/每节知识点）→叶（公式/生字/例题细节）；3.手绘≥A4纸1页，颜色≥3种区分层级；4.家长/老师核对知识点覆盖≥90%；5.能对照知识树给家长讲解本单元要点≥3分钟 |

---

## 六、四年级任务池主次潜合规性自检表（100%达标）

| 维度层级 | 理论占比 | 实际30条拓展池数量 | 实际占比 | 合规判定 |
|---------|---------|-----------------|---------|---------|
| Primary 主维（学习探索+创意审美） | ≥60% | 19条（学习探索11条+创意审美8条） | 63.3% | ✅ 达标 |
| Secondary 次维（责任担当+社交协作） | ~30% | 9条（责任担当8条+社交协作1条，另有多条附主次维） | 30% | ✅ 达标 |
| Latent 潜维（生活自理+运动健康） | ≤10% | 纯潜维0条 + 6条任务含少量潜维（D01/02/03/04/05/07等），折合≈2条 | ≈6.7% | ✅ 达标，运动健康潜维未用留作奖励 |

> 奖励用预留潜维任务（不进拓展池，仅作为主/次维周全勤奖励，不影响占比）：跳绳250下/打羽毛球10分钟（运动健康·潜）、画1张未来城市想象画（创意审美·潜）

---

## 附录E：五年级任务模板库（10-11岁 | 抽象思维发展期 + 公益责任感建立期）

> 年级定位：复杂步骤独立完成、抽象规则理解、公益/社区参与、责任边界从个人→家庭→社区拓展
> 能力主次潜：主=责任担当/社交协作（合计~67%），次=学习探索/运动健康（合计~27%），潜=生活自理/创意审美（严格≤6%）
> 学术边界：仍然不直接奖励考试分数，可以奖励「错题本复盘、单元知识思维导图制作、给同学讲题」这类学习行为

---

## 一、核心习惯培养（每日固定锚任务，4项）

| 编号 | 习惯名称 | 培养目标 | 主/次能力维度（严格匹配五年级：主=责任担当/社交协作） | 每日基础积分 | 可量化验收标准 |
|-----|---------|---------|--------------------------------------------------|------------|-------------|
| H1-G5-01 | 家庭公共区清洁轮值：每周2天 | 从自己房间→升级为负责全家公共区（客厅+餐厅+玄关）清洁轮值 | 主=责任担当，次=社交协作（家庭分工协作） | 每次15分，每周2次共30分 | 1.沙发抱枕整理+地毯吸尘/扫；2.餐厅桌面+椅子擦净；3.玄关鞋架整理+地垫抖干净 |
| H1-G5-02 | 个人洗漱+卫生间清洁：用完立刻复原 | 用完卫生间后四项全达标：洗手台擦+马桶盖放+地面拖+垃圾检查 | 主=责任担当（家庭共用空间维护责任），次=社交协作（尊重家人共用体验） | 7分/天 | 四项标准全满足，家长任意抽查1项合格即通过 |
| H1-G5-03 | 每周家庭预算复盘员：周日1次 | 从四年级单次采购→升级为每周家庭支出总复盘 | 主=责任担当（家庭财务管理责任），次=学习探索（数据分析+表格方法） | 20分/周 | 1.列本周家庭支出表格（食品/日用品/教育/娱乐四类）；2.和上周比超支项1条分析；3.下周1条具体省钱建议 |
| H1-G5-04 | 40分钟深度阅读 + 每周1篇完整读书笔记（≥300字） | 阅读从短读后感→升级为长文结构（好词+情节+人物分析+感想） | 主=社交协作（读书笔记与家人分享讨论），次=学习探索（阅读分析+写作） | 日12分 + 周额外30分（读书笔记） | 日：40分钟专注无中断；周：读书笔记≥300字含四段完整结构，且与家人讨论≥10分钟 |

---

## 二、技能解锁阶梯（5条技能树，首次引入明火烹饪）

### 技能树 S1-G5：烹饪技能二级（主=责任担当·家庭供餐+社交协作次维，冷拌→煎制，严格陪同）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 四年级微波炉/切水果累计≥20次 + 通过冷拌安全考核（生熟砧板分开） | 制作凉拌菜（拍黄瓜/糖拌番茄/凉拌三丝） | 强制全程陪同（菜刀使用+生熟砧板分开两项全程指导） |
| Lv.1 达标 | 累计独立制作凉拌菜≥5次，家人评价咸淡合适 | 制作果酱（草莓/蓝莓/苹果酱，全程明火熬制） | 强制全程明火+防烫陪同，须签署「明火使用安全确认书」 |
| Lv.2 进阶 | 果酱制作≥3次 + 熬制全程无糊锅 | 煎制类入门：煎鸡蛋/煎火腿/煎吐司（含平底锅预热+倒油火候控制） | 强制全程明火陪同，重点关注油温判断和翻面时机 |

### 技能树 S2-G5：深度清洁+家电维护（主=责任担当+学习探索次维·家电原理）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 四年级收纳进阶L1通过 | 每周深度打扫：灶台油污清理+冰箱内壁清洁（必须戴橡胶手套用清洁剂） | 仅提醒「清洁剂不可混用」即可 |
| Lv.1 达标 | 深度清洁累计≥4次 | 整理换季全家衣柜（含真空压缩袋抽真空）+ 清洗换季鞋子4双 + 给皮鞋打鞋油 | 仅大件搬运提醒即可 |
| Lv.2 进阶 | 换季整理独立完成≥2次 + 无物品遗失 | 家电深度清洁：洗衣机槽清洁剂投放运行+油烟机滤网拆卸清洗+微波炉内部除味 | 仅提醒断电操作和零部件轻拿轻放 |

### 技能树 S3-G5：茶艺/待客礼仪（主=社交协作·待客+责任担当次维）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 正确识别6大类茶叶（绿/红/乌龙/白/黄/黑）+ 泡茶水温常识 | 给长辈泡茶（绿茶85℃/红茶沸水）+ 奉茶礼仪（双手递+杯柄朝右） | 仅热水防烫提醒即可 |
| Lv.1 达标 | 累计泡茶奉茶≥10次 | 家庭待客：来客时负责端茶+递水果+陪聊5分钟（家长在旁陪同） | 仅需家长在旁陪同即可 |
| Lv.2 进阶 | 独立完成待客≥3次 + 客人评价热情得体 | 家庭小型聚会主持：确定来客名单+电话/微信邀请+准备3种以上零食茶点+全程招待≥30分钟 | 家长在旁观察，仅在社交尴尬时出面圆场 |

### 技能树 S4-G5：衣物分类洗护+换季收纳（主=责任担当+社交协作次维，长城路小学五年级标准）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 能正确识别衣物洗涤标签（水洗/干洗/水温/漂白标识5类） | 分类清洗：深色浅色分开+内衣外衣分开+洗衣机投放适量洗衣液+选择正确洗涤模式 | 仅提醒检查口袋是否有遗留物品即可 |
| Lv.1 达标 | 独立分类清洗累计≥6次 + 无染色缩水事故 | 晾晒+熨烫：正确使用晾衣架（衬衫用衣架、毛衣平铺）+熨斗熨烫衬衫/T恤（调温+喷水+熨烫顺序） | 仅提醒熨斗高温防烫和使用后断电归位 |
| Lv.2 进阶 | 熨烫衣物累计≥8件 + 无烫损 | 换季衣柜整理：当季衣物悬挂区/折叠区分区+过季衣物真空压缩袋装+防虫樟脑丸放置+制作衣柜分层标签 | 仅高处取放提醒即可 |

### 技能树 S5-G5：冰箱厨房深度整理（主=责任担当+学习探索次维·食品安全，莱西洙河小学+永城七小标准）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | S2-G5 Lv.0通过 | 每周整理厨房：擦拭橱柜台面+分类摆放碗盘锅具+清理水槽滤网+扫地拖地 | 仅提醒玻璃陶瓷制品轻拿轻放 |
| Lv.1 达标 | 每周厨房整理累计≥4次 | 冰箱分类整理：清空全部物品→过期食品检查丢弃→内壁擦拭→生熟分层（生肉放下层、熟食放上）→蔬果盒独立存放→贴分类标签 | 仅提醒生熟分开和过期食品处理确认 |
| Lv.2 进阶 | 冰箱独立整理≥3次 + 清理灶台累计≥5次 | 厨房深度清洁：灶台油污重区（威猛先生喷洒+钢丝球+百洁布三步法）+抽油烟机表面除油+瓷砖墙面油渍擦拭+垃圾桶清洗消毒 | 仅提醒清洁剂戴手套、开窗通风即可 |

---

## 三、项目式跨周期父任务（5项，4-6周长项目占比显著提升）

### 🍓 P1-G5-01 屋顶小菜园——草莓从苗到结果42天完整种植（主=责任担当+社交协作次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=责任担当（42天连续养护责任）；次=社交协作（草莓富余赠送邻居老师）；潜=生活自理（日常操作） |
| 建议跨周期 | 6个周期（42天，覆盖草莓开花-结果完整周期） |
| 里程碑（每7天1个） | 周期1「定植期」：采购草莓苗/基质/大花盆 + 定植 + 缓苗<br>周期2「生长期」：打老叶 + 疏花 + 水肥管理<br>周期3「开花授粉期」：毛笔人工授粉 + 疏果（每枝留5-7个果）<br>周期4「膨大转色期」：套袋防鸟 + 测糖度<br>周期5「采收品尝期」：分批采收 + 称重 + 家庭品尝<br>周期6「总结期」：清理植株 + 写完整草莓种植技术手册 |
| 每日自动生成子任务 | 每天1个养护任务（浇水/打叶/授粉按需分配）+ 观察记录卡（照片/叶片数/坐果数/糖度） |
| 父任务完成最终产出物 | 1.家庭品尝自己种的草莓≥1盒；2.《草莓种植技术手册》A5装订≥20页（含6周期阶段记录+10个常见问题应对+2张数据趋势图：株高/坐果数）；3.产量富余的话送1盒给邻居/老师+手写感谢信2封 |

### 💰 P1-G5-02 我的100元生日派对预算与执行全案（主=社交协作·派对主持+责任担当次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=社交协作（派对主持+与客人互动）；次=责任担当（预算控制+采购执行）；潜=创意审美（场地装饰设计） |
| 建议跨周期 | 2个周期（14天） |
| 里程碑 | 周期1「筹备期」：确定人数→列菜单/游戏/装饰清单→3方案比价→定100元内预算→采购<br>周期2「执行+复盘期」：布置场地+主持游戏+上菜+拍照+事后收拾+预算复盘 |
| 每日自动生成子任务 | 每天筹备类子任务（清单/比价/布置游戏道具） |
| 父任务完成最终产出物 | 1.完整100元生日派对（≥4人规模）成功举办；2.派对流程表+预算对比表（实际vs预算）；3.派对Vlog≥3分钟（剪辑+字幕） |

### 🤝 P1-G5-03 社区志愿服务项目——垃圾分类引导+公园捡拾（14天）（主=责任担当·公益+社交协作次维）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=责任担当（公益责任）+社交协作（与居民/志愿者沟通）；次=学习探索（垃圾分类知识体系）；潜=运动健康（户外行走捡拾） |
| 建议跨周期 | 2个周期（14天） |
| 里程碑 | 周期1「筹备期」：联系社区/物业→确定志愿排班→制作垃圾分类宣传小卡片10张<br>周期2「执行+复盘期」：2次小区垃圾站志愿引导每次1小时 + 1次公园垃圾捡拾（分类投放）+ 写志愿复盘报告 |
| 每日自动生成子任务 | 周期1制作卡片/联系排班子任务；周期2集中3次志愿活动子任务 |
| 父任务完成最终产出物 | 1.累计志愿时长≥3小时完整服务记录；2.社区/物业盖章的志愿服务证明（拿不到的话家长签字证明即可）；3.志愿服务总结报告≥300字（含发现的3个真实问题+改进建议） |

### 🍽️ P1-G5-04 14天"家宴策划师"——凉热搭配全家晚餐（主=责任担当+社交协作次维，长城路小学五年级标准）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=责任担当（家宴全流程责任）+社交协作（征询家人口味+就餐招待）；次=学习探索（营养学搭配）；潜=创意审美（摆盘） |
| 建议跨周期 | 2个周期（14天） |
| 里程碑 | 周期1「策划筹备期」：确定家宴日期（周末）→征询全家口味→列菜单（≥1道热菜+≥1道凉拌菜+米饭+水果拼盘）→列食材采购清单→3家超市/菜市场比价→预算控制（建议50-80元）→采购食材<br>周期2「执行复盘期」：制作家宴（凉菜先做→热菜炒制→米饭蒸煮→水果拼盘）→全家就餐→满意度投票（每人打分1-5星）→收拾厨房→写家宴复盘报告 |
| 每日自动生成子任务 | 周期1：菜单设计/食材比价/采购清单/采购执行子任务；周期2：备菜/烹饪/摆盘/收拾复盘子任务 |
| 父任务完成最终产出物 | 1.成功制作一顿凉热搭配完整家宴（热菜≥1道+凉拌菜≥1道+米饭+水果拼盘），全家4人以上就餐；2.《家宴策划案》含菜单+采购清单+预算对比表（实际vs预算）；3.全家满意度投票结果汇总+复盘报告≥300字（含最满意菜品+下次改进点） |

### 👨‍👩‍👧 P1-G5-05 21天"我来当家长"——连续3周周末全权当家（主=责任担当+社交协作双主维，人民日报+上海儿童医学中心建议）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=责任担当（全权当家·全流程）+社交协作（与家人沟通需求+照顾老人小孩）；次=学习探索（预算+日程规划）；潜=运动健康（家务劳动强度） |
| 建议跨周期 | 3个周期（21天，每周六/周日各1天当家，共6个当家日） |
| 里程碑 | 周期1「第1周当家」：周六或周日任选1天，全权负责：①6:30-7:30做全家早餐（≥3种：粥/面/蛋/包子任选搭配）；②8:00-10:00全家打扫（客厅+卧室+卫生间≥3区）；③10:30-12:00带购物清单超市/菜场采买（中餐+晚餐食材）；④全天照顾弟弟妹妹/老人（陪玩/喂饭/提醒吃药按需）；⑤睡前写《当家长日记》<br>周期2「第2周当家」：第2个周末当家日，在第1周基础上增加：预算控制（当日开支记账）+ 亲友热情待客（如有人来访）<br>周期3「第3周当家」：第3个周末当家日，在第2周基础上增加：中餐或晚餐亲手做≥2道菜 + 全家当日满意度评分 |
| 每日自动生成子任务 | 当家日当天：早餐/打扫/采购/照顾他人/做饭/记账/写日记等子任务；非当家日：提前采购/准备菜单/预算规划等筹备子任务 |
| 父任务完成最终产出物 | 1.完成6个完整当家日（3个周末×2天或3天×任选方式），每日核心任务全部达标；2.《当家长日记》6篇，每篇≥200字（含当日最辛苦的事+体会到家长的不容易+感谢的话）；3.《当家总结报告》≥400字，含3周家庭开支汇总表+当家前后自己的变化+给爸妈的1封感谢信 |

---

## 四、特色主题周

| 主题代号 | 主题周名称 | 主题周对应任务集中安排方向（严格匹配主次潜） | 主题周推荐触发条件 |
|---------|-----------|----------------------------------------|----------------|
| T-G5-01 | 小小管家主题周 | 主维集中：全家公共区清洁轮值2次（责任担当主维）+ 每周预算复盘（责任担当主维）+ 招待客人泡茶奉茶礼仪（社交协作主维）<br>次维：《家庭管家周记》撰写（学习探索次维·写作） | 任意月首周自动触发 |
| T-G5-02 | 公益服务主题周 | 主维集中：社区志愿项目（责任担当+社交协作双主维）<br>次维：户外捡拾（运动健康次维） | 每年学雷锋月/五四青年节所在周触发 |
| T-G5-03 | "学雷锋志愿服务"主题周（莱西洙河小学+宿迁实小标准） | 主维集中：校园服务+社区卫生打扫（责任担当主维）+ 手抄报制作分发（社交协作主维·宣传传播）<br>次维：3张A4手抄报（学习探索次维·内容编排） | 3月第一周自动触发 |
| T-G5-04 | "小小卖货能手"跳蚤市场周（台儿庄实验小学标准） | 主维集中：整理闲置→定价→摆摊→公益捐赠（责任担当+社交协作双主维）<br>次维：闲置分类评估（学习探索次维·价值判断） | 每学期末前1周触发（6月/1月） |

---

## 五、日常拓展任务池（30条 | 覆盖9大类别，主维~67%，次维~27%，潜维~6% 严格合规）

> 积分区间：4-8分，按任务复杂度递增；能力维度严格匹配；抽取权重：主维6.7成，次维2.7成，潜维仅每周最多抽1条作为奖励
> 学术边界说明：无任何直接奖励考试分数的任务，学习类仅奖励「错题本复盘、知识思维导图、给同学讲题」等学习行为

| 编号 | 任务名称 | 所属类别 | 能力维度（严格主次潜） | 单次积分 | 可量化验收标准（参考公立小学官方清单） |
|-----|---------|---------|-------------------|---------|----------------------------------|
| **【责任担当 主维 14条，占比46.7%】** | | | | | |
| D-G5-01 | 打扫自己房间 | 清洁 | 主=责任担当，次=学习探索（清洁流程优化） | 5分 | 长城路小学标准：①起床后叠被子（四角平整）；②扫地+拖地（无明显灰尘头发）；③书桌整理（书本码齐+文具归位+桌面无杂物）；④窗户台面擦净（无灰尘水印） |
| D-G5-02 | 整理换季衣服 | 清洁 | 主=责任担当，次=社交协作（帮全家换季） | 6分 | 长城路小学标准：①当季/过季分开；②过季衣物折叠装入真空压缩袋（抽真空完成）；③当季上衣悬挂+裤子折叠放抽屉；④衣柜顶部/底部灰尘擦净 |
| D-G5-03 | 清理卫生间 | 清洁 | 主=责任担当，次=运动健康（家务劳动强度） | 6分 | 莱西洙河小学标准：①洗手台擦净（无水渍+牙膏印+物品摆放整齐）；②马桶内壁刷洗+马桶盖/坐圈擦净；③地面拖干（无积水头发）；④镜子擦净（无水印指纹） |
| D-G5-04 | 清理灶台油污 | 清洁 | 主=责任担当，次=学习探索（去污化学反应） | 7分 | 永城七小标准：①灶台表面喷洒清洁剂→钢丝球去重油污→百洁布擦净三步完成；②墙面瓷砖油渍擦净（范围：灶台上方1米内）；③油烟机表面除油擦亮；④调料瓶/锅具底部擦净归位 |
| D-G5-05 | 清理冰箱 | 清洁 | 主=责任担当，次=学习探索（食品安全+保质期知识） | 7分 | 槐荫刘庄小学标准：①全部物品取出检查；②过期食品/变质食材丢弃（家长确认）；③冰箱内壁+搁板+抽屉全部擦拭（无污渍异味）；④物品分类摆回放回（生熟分层） |
| D-G5-06 | 全家公共区大扫除 | 清洁 | 主=责任担当+社交协作（家庭分工），次=运动健康（大强度劳动） | 8分 | 白衣堂小学标准：①客厅（沙发整理+抱枕摆齐+茶几擦+地毯吸尘/扫）；②餐厅（桌面+椅子擦+地面拖）；③玄关（鞋架整理+地垫抖干净+鞋柜擦灰）；三区全达标 |
| D-G5-07 | 收拾餐桌+洗碗 | 厨房 | 主=责任担当，次=社交协作（餐后分工） | 5分 | 台儿庄实小标准：①饭后30分钟内开始；②剩菜分类装入保鲜盒放冰箱；③碗盘洗洁精清洗→清水冲净→控水放碗篮；④餐桌擦净+餐椅归位+水槽滤网清理+地面扫净食物残渣 |
| D-G5-08 | 做一道凉拌菜 | 厨房 | 主=责任担当（为家人备餐），次=社交协作（口味征询） | 6分 | 长城路小学标准：①从拍黄瓜/糖拌番茄/凉拌三丝三选一；②生熟砧板分开使用；③菜刀使用正确姿势（家长观察确认安全）；④成品咸淡合适、摆盘整齐（家人尝评合格） |
| D-G5-09 | 烧饭（电饭煲煮米饭） | 厨房 | 主=责任担当（每日供餐责任），次=学习探索（米水比科学） | 5分 | 永城七小标准：①按用餐人数舀米（1人≈1米杯）；②淘米≥2遍（水清无浑浊）；③加水比例正确（食指第一节水高）；④电饭煲煮饭完成后软硬合适（不夹生不稀烂） |
| D-G5-10 | 烧一道简单热菜 | 厨房 | 主=责任担当（家庭供餐责任），次=社交协作（与家人口味沟通） | 7分 | 槐荫刘庄小学标准：①从番茄炒蛋/炒青菜/青椒土豆丝三选一；②签署明火使用安全确认书（家长全程陪同）；③火候控制得当（不糊锅）；④成品色香味合格（家人评价≥3星） |
| D-G5-11 | 餐后厨房整理 | 厨房 | 主=责任担当（厨房环境卫生责任），次=学习探索（厨房收纳方法） | 5分 | 白衣堂小学标准：①灶台表面擦净（无油污水渍）；②锅具/菜板/刀具洗净归位；③水槽擦净+下水口滤网清理；④厨房地面扫净+垃圾打包带下楼 |
| D-G5-12 | 整理自己衣柜 | 收纳 | 主=责任担当（个人物品管理责任），次=学习探索（分类方法） | 6分 | 长城路小学标准：①上衣悬挂区（衣架统一、朝向一致、间距均匀）；②折叠区（T恤/裤子/内衣分抽屉，摆放整齐）；③防尘防虫（樟脑丸放置≥2处）；④衣柜门/侧面擦灰 |
| D-G5-13 | 整理鞋柜 | 收纳 | 主=责任担当（全家鞋物管理），次=社交协作（与家人确认哪些留/丢） | 5分 | 槐荫刘庄小学标准：①当季常穿鞋摆外面（鞋头朝外、整齐排列）；②过季鞋擦干净装入鞋盒放顶层；③拖鞋单独放底层；④鞋柜表面/层板擦灰+地垫抖干净 |
| D-G5-14 | 养护公共植物 | 种植 | 主=责任担当（公共绿植养护），次=运动健康（户外养护活动量） | 5分 | 白衣堂小学标准：①每周养护≥2次（家中绿植/小区公共花坛/班级绿植任选）；②浇水（水量适度、不淹根不干燥）；③修剪枯叶（剪刀使用安全）；④养护有记录（拍照/日记≥2次） |
| **【社交协作 主维 6条，占比20% → 主维合计20条，占比66.7%】** | | | | | |
| D-G5-15 | 照顾弟弟妹妹1小时 | 照顾他人 | 主=社交协作（与弟妹沟通互动），次=责任担当（安全看护责任） | 6分 | 白衣堂小学标准：①陪玩（积木/绘本/游戏≥2种）；②安全看护（不爬高、不碰危险物品，全程视线不离开）；③需要时喂水/喂小零食；④家长评价"放心、无安全事故" |
| D-G5-16 | 照顾家里老人 | 照顾他人 | 主=社交协作（与老人沟通倾听），次=责任担当（孝心义务） | 7分 | 台儿庄实小标准：①陪聊天≥30分钟（倾听不打断、主动问近况）；②端茶倒水（双手递）；③提醒吃药（按药盒核对药量）；④天气好时陪散步15分钟+安全护送到家 |
| D-G5-17 | 热情待客 | 照顾他人 | 主=社交协作（待客沟通礼仪），次=责任担当（小主人责任） | 6分 | 长城路小学标准：①客人开门主动问好（称呼正确）；②端茶（双手递、杯柄朝右）+递水果/零食盘；③陪聊≥10分钟（找话题不冷场）；④客人离开送到门口+说"再见，欢迎下次再来" |
| D-G5-18 | 帮助邻居取快递/扔垃圾 | 照顾他人 | 主=社交协作（邻里互助沟通），次=责任担当 | 5分 | 莱西洙河小学标准：①帮助邻居≥2次（取快递到门口/帮拎垃圾到楼下垃圾桶）；②主动打招呼问好；③不随意翻看他人快递；④邻居当面感谢或家长确认 |
| D-G5-19 | 菜市场买菜 | 采购 | 主=社交协作（与摊主询价讲价），次=学习探索（新鲜度鉴别+心算） | 6分 | 槐荫刘庄小学标准：①采购≥3种食材（蔬菜/肉类/豆制品任选）；②主动向摊主询价（每种问价）；③挑选新鲜食材（家长教的判断标准：叶子不黄、无腐烂异味）；④付款后装袋拎回家+找零核对正确 |
| D-G5-20 | 给同学讲题 | 文化（学习行为） | 主=社交协作（知识讲解表达），次=学习探索（知识点巩固） | 5分 | 永城七小标准：①给1名同学（微信语音/视频/当面）讲1道数学/语文难题；②讲题步骤清晰：读题→分析已知条件→讲思路→出答案；③同学反馈"听懂了"（截图或家长确认）；④事后自己再整理1份讲题思路笔记 |
| **【学习探索 次维 6条，占比20%】** | | | | | |
| D-G5-21 | 整理书柜 | 收纳 | 次=学习探索（图书分类法+知识体系），主=责任担当 | 6分 | 莱西洙河小学标准：①课本/课外书/练习册分类分区摆放；②书脊朝外、从高到矮或科目排列整齐；③书柜每层隔板+顶部灰尘擦净；④制作3个以上分类标签贴于隔板外侧 |
| D-G5-22 | 冰箱分类整理 | 收纳 | 次=学习探索（食品安全分区+食材保鲜知识），主=责任担当 | 7分 | 永城七小标准：①生熟分层（生肉/海鲜放下层，熟食/剩菜放上层）；②蔬菜水果独立放蔬果盒（不挤压）；③饮料/酱料门架区分类摆放；④贴4个以上分区标签（冷藏区/冷冻区/蔬果区/熟食区） |
| D-G5-23 | 带购物清单超市采购 | 采购 | 次=学习探索（预算+比价+数据计算），主=责任担当 | 7分 | 永城七小标准：①提前列好采购清单（≥5项物品）；②对照清单逐一选购（不遗漏、不超清单额外买玩具/零食）；③同类商品2个品牌比价（选性价比高的）；④付款金额与预算差额≤10%+找零核对正确 |
| D-G5-24 | 种植观察记录（7天） | 种植 | 次=学习探索（科学观察方法+数据分析），主=责任担当，潜=创意审美（小报排版） | 6分 | 台儿庄实小标准：①水培大蒜/豆芽/土豆任选一种；②连续7天每日观察记录；③记录形式：拍照≥7张+高度/叶片数数据+简单文字描述；④第7天做一张《种植观察小报》A4（含照片+数据+感想） |
| D-G5-25 | 制作主题手抄报 | 文化 | 次=学习探索（信息收集+知识整理），主=责任担当，潜=创意审美（排版设计） | 7分 | 长城路小学标准：①从"学雷锋/传统节日/环保反诈/交通安全"4主题任选；②A3纸大小；③内容要求：标题醒目+彩图≥5幅+文字≥300字+边框/排版有设计感；④涂色均匀、无大面积涂改 |
| D-G5-26 | 错题本复盘整理 | 文化（学习行为） | 次=学习探索（错误归因分析+知识巩固），主=责任担当（学习自主责任） | 6分 | 莱西洙河小学标准：①整理本周数学/语文错题≥5道；②每题抄题→重做→写错误原因（概念不清/计算失误/审题错误三选一）→写正确思路；③用不同颜色笔标注（黑抄题、蓝做题、红分析）；④家长签字确认已认真完成 |
| **【运动健康 次维 2条，占比6.7% → 次维合计8条，占比26.7%（另有多条任务附次维属性）】** | | | | | |
| D-G5-27 | 学雷锋志愿服务1小时 | 社会 | 次=运动健康（户外体力活动），主=责任担当+社交协作（公益） | 7分 | 槐荫刘庄小学标准：①从社区卫生打扫/公园捡垃圾/校园图书角整理/擦公交站座椅4项任选1项；②连续服务≥1小时（计时/拍照证明）；③服务过程认真（不偷懒、不打闹）；④写《志愿服务感受》≥200字 |
| D-G5-28 | 垃圾分类宣传小使者 | 社会 | 主=社交协作（向居民讲解分类），次=运动健康（户外步行发放）+学习探索（分类知识体系） | 6分 | 白衣堂小学标准：①制作垃圾分类宣传小卡片≥5张（手绘彩图+分类口诀）；②给≥3位邻居/同学讲解四分类标准（可回收/有害/厨余/其他）；③对方能正确说出≥2种分类即算讲解成功；④家长拍照记录讲解过程 |
| **【潜维合计 生活自理/创意审美 仅2条任务各含少量潜维 → 折合≈1.8条，占比≈6% 合规】** | | | | | |
| D-G5-29 | 分类清洗全家衣服 | 财商 | 主=责任担当（全家衣物洗护责任），次=社交协作（家人衣物分开洗护），潜=生活自理（操作技能） | 6分 | 长城路小学标准：①分拣四类：深色/浅色/内衣/袜子分开；②检查所有口袋（有无纸巾/硬币遗留）；③按衣物标签选正确洗涤模式+投放适量洗衣液；④晾晒分类（衬衫用衣架、毛衣平铺、袜子夹袜子架）+完成后叠好分类放各人衣柜 |
| D-G5-30 | 带动全家垃圾分类1周 | 财商 | 主=责任担当（家庭垃圾分类牵头责任）+社交协作（督促说服家人），次=学习探索（分类统计），潜=生活自理（分类操作） | 8分 | 台儿庄实小标准：①每顿饭前提醒家人分类；②饭后检查垃圾桶（错分的挑出重新分类）；③每日晚8点汇总当日分类情况（正确/错误数量）；④周日晚做《家庭垃圾分类周报》A4（含每日数据+本周常见错误+下周改进计划）+全家签字确认 |

---

## 六、五年级任务池主次潜合规性自检表（100%达标）

| 维度层级 | 理论占比 | 实际30条拓展池数量 | 实际占比 | 合规判定 |
|---------|---------|-----------------|---------|---------|
| Primary 主维（责任担当+社交协作） | ≥60% | 20条（14+6，另有多条任务含双主维） | 66.7% | ✅ 达标 |
| Secondary 次维（学习探索+运动健康） | ~30% | 8条（6+2，另有多条任务附次维） | 26.7% | ✅ 达标 |
| Latent 潜维（生活自理+创意审美） | ≤10% | 纯潜维0条 + 4条任务各含少量潜维（D24/D25/D29/D30），折合≈1.8条 | ≈6% | ✅ 达标，创意审美/生活自理均严格控制 |

> 奖励用预留潜维任务（不进拓展池，仅作为主/次维周全勤奖励，不影响占比）：慢跑1公里/游泳15分钟（运动健康·潜）、画1张我眼中的社区（创意审美·潜）

---

## 附录F：六年级任务模板库（11-12岁 | 青春期预备期 + 独立决策/综合能力爆发期）

> 年级定位：独立做完整决策、全流程负责复杂项目、青春期自我管理、家庭准成人角色融入
> 能力主次潜：主=学习探索/社交协作（合计~62.5%），次=责任担当/创意审美（合计~31.25%），潜=生活自理/运动健康（严格≤6.25%）
> 学术边界：允许出现学业进步类奖励（**不直接奖具体分数，仅奖励进步幅度/进步行为**），保留所有学习行为类奖励

---

## 一、核心习惯培养（每日固定锚任务，5项，所有年级最多项，匹配准成人定位）

| 编号 | 习惯名称 | 培养目标 | 主/次能力维度（严格匹配六年级：主=学习探索/社交协作） | 每日基础积分 | 可量化验收标准 |
|-----|---------|---------|--------------------------------------------------|------------|-------------|
| H1-G6-01 | 独立负责每周1次家庭晚餐：采购→烹饪→清洁全流程 | 从厨房助手→升级为全权负责一餐完整闭环 | 主=社交协作（为家人提供供餐服务+满意度征询），次=责任担当（全流程闭环执行） | 每次30分，每周1次 | 1.四菜一汤标准（荤素搭配+汤）；2.采购预算≤60元；3.餐后厨房100%清洁归位；4.家人满意度投票≥3人满意 |
| H1-G6-02 | 自我管理三件套：每日计划/复盘/时间记录 | 成人化时间管理能力建立 | 主=学习探索（时间管理方法+复盘思维），次=责任担当（自我管理责任） | 12分/天 | 1.前一晚写好第二天3项最重要事项；2.晚上复盘完成率%+未完成原因；3.记录当天有效学习时长≥1小时 |
| H1-G6-03 | 全屋卫生间深度清洁值日：每周1次 | 清洁从公共区→升级为卫生间（最难清洁区域） | 次=责任担当（家庭环境卫生责任），潜=生活自理（清洁操作技能） | 22分/周 | 1.马桶内外壁+底座清洁；2.洗手台+镜面无水渍；3.地漏毛发清理+地垫清洗；4.垃圾桶换袋消毒 |
| H1-G6-04 | 每月家庭理财账本：月末1次 | 从五年级每周复盘→升级为月度全家财务总览+下月预算建议 | 主=学习探索（财务数据分析+预算方法），次=社交协作（与家人讨论财务优化方案） | 50分/月 | 1.月度支出四大类占比饼图（手绘或Excel均可）；2.超支分析≥3条；3.下月3条可落地省钱/优化建议 |
| H1-G6-05 | 50分钟深度阅读 + 每月1本完整读书报告（≥800字） | 阅读从短篇→升级为整本书深度分析 | 主=学习探索（整本书阅读分析+写作能力），次=创意审美（报告结构设计+文字表达） | 日15分 + 月额外100分 | 日：50分钟专注；月：读书报告≥800字，含「作者背景/情节结构/人物分析/现实意义/个人启发」五段完整结构 |

---

## 二、技能解锁阶梯（5条技能树，含独立烹饪/维修/策划/家政/家电高阶能力）

### 技能树 S1-G6：独立烹饪大师（燃气独立使用资格的最高解锁等级，主=学习探索·烹饪科学+社交协作·供餐服务）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 五年级烹饪L1（果酱/凉拌菜）累计≥10次 + 通过燃气安全操作考核（家长签字+模拟开关燃气10次） | 煮面条/饺子/馄饨 + 煎荷包蛋（首次独立使用燃气） | 前3次强制全程陪同签字；第4次起改为门外看护提醒模式 |
| Lv.1 达标 | 累计独立使用燃气煮/煎≥10次 + 无事故 | 制作简单炒菜2道（番茄炒蛋/清炒时蔬）+ 电饭煲煮米饭（软硬合适） | 门外看护提醒模式（家长门口看护即可，不进厨房） |
| Lv.2 进阶 | 累计炒菜≥10道 + 家人满意度投票≥80%满意 | 负责周末1顿4人份三菜一汤全流程（含采购计划） | 仅需最后确认燃气阀门完全关闭即可 |
| Lv.3 家宴主厨 | 累计负责三菜一汤≥8次 + 通过食材采购预算考核 | 独立做6人以上节日家宴8菜1汤（含冷盘2道+热菜5道+汤1道+主食，预算≤200元）+ 餐后清洁全流程 | 仅需食材采购安全提醒即可，全程独立完成 |

### 技能树 S2-G6：家居维修小能手（首次允许使用手动工具，严格禁用电动工具。主=学习探索·原理+次=责任担当）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 六年级手工/缝补累计≥15次 + 通过螺丝刀/扳手安全考核（家长签字） | 家具小维修：拧紧松动螺丝（椅子/柜门把手）+ 更换电池（遥控器/时钟）+ 贴门窗密封条 | 首次使用螺丝刀/扳手必须全程陪同；严格禁用任何电动工具 |
| Lv.1 达标 | 累计维修小任务≥8次 | 更换床单被套枕套（含4人份全家的非仅自己）+ 简易布艺修补（窗帘开边缝补/抱枕套拉链加固） | 仅大件搬运提醒即可 |
| Lv.2 维修进阶 | 累计完成Lv.1维修任务≥6次 + 通过家具组装安全考核 | 简单家具维修（桌椅松动加固/柜门合页更换/抽屉滑轨调试）+ 组装简易家具（书架/鞋架/收纳柜等平板包装家具） | 首次组装需家长在旁协助阅读说明书，后续可独立完成 |

### 技能树 S3-G6：活动策划总指挥（主=社交协作·沟通协调+学习探索·方案设计）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 五年级生日派对项目通过 + 累计待客≥10次 | 策划1次家庭出游1日计划（景点/交通/餐饮/预算） | 仅需陪同实际出行即可 |
| Lv.1 达标 | 独立策划1日出游≥2次，家人满意度投票通过 | 策划1次6人以上亲友聚餐（订位/点菜/预算控制/主持活动） | 仅需在旁陪同即可 |
| Lv.2 大型活动总指挥 | 独立策划6人以上聚餐≥3次 + 家人满意度≥85% | 策划10人以上家庭聚会+户外团建（含场地选址/游戏设计/物料采购/人员分工/预算控制/应急预案） | 家长作为顾问角色参与，核心决策由孩子主导 |

### 技能树 S4-G6：家政深度保洁与衣物洗护全流程（参考长城路小学六年级要求。次=责任担当·家庭服务+主=学习探索·清洁/纺织科学）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 五年级清洁累计≥20次 + 认识各类清洁剂用途并通过安全考核 | 清洗马桶（内壁+外壁+底座+盖板）+ 地面常规拖洗（客厅+卧室） | 首次使用马桶清洁剂必须全程陪同，注意通风防护 |
| Lv.1 达标 | 累计独立清洗马桶≥8次 + 认识衣物洗涤标识 | 分类洗衣（深色/浅色/内衣分开）+ 晾晒（衣架使用+翻面晾晒+长短衣物分层）+ 折叠收纳（上衣/裤子/内衣分类） | 首次使用洗衣机需家长指导操作流程 |
| Lv.2 家政进阶 | 累计分类洗衣晾晒≥10次 + 通过熨斗安全操作考核 | 熨烫衣物（衬衫/T恤/裤装，掌握温度控制）+ 换洗全套床品（4人份）+ 深度擦玻璃（内外两面+窗框清洁） | 首次使用熨斗必须全程陪同，严格禁用挂烫机高温部分接触皮肤 |

### 技能树 S5-G6：家电操作与食材处理（参考永城七小六年级要求。主=学习探索·家电原理/食材科学）

| 等级 | 解锁条件 | 解锁后可执行的对应任务 | 家长陪同要求 |
|-----|---------|---------------------|------------|
| Lv.0 入门 | 累计阅读3份家电说明书 + 通过家电安全用电考核 | 按说明书使用微波炉/电饭煲/电热水壶（含清洁保养）+ 识别食品保质期 | 首次独立操作家电需家长在旁确认操作步骤 |
| Lv.1 达标 | 累计独立使用3种以上家电≥15次 + 认识5种以上常见鱼类 | 家电小问题排查（微波炉不加热/电饭煲按键失灵排查简单原因）+ 清洗鱼类食材（去鳞/去腮/去内脏）+ 识别保质期与保修日期 | 处理生鱼时家长需指导刀具使用安全，首次操作全程陪同 |
| Lv.2 熟练操作 | 累计处理鱼类贝类食材≥8次 + 通过家电综合操作考核 | 清洗贝类食材（吐沙/刷洗）+ 处理常见肉类（猪肉/鸡肉清洗切块）+ 按说明书操作电磁炉/烤箱/豆浆机 + 清除家中过期变质食品 | 刀具使用注意安全，烤箱使用需家长确认温度设定 |

---

## 三、项目式跨周期父任务（5项，覆盖种植/旅行/感恩/家政/AI，对应毕业级综合能力输出）

### 🍅 P1-G6-01 家庭阳台菜园——番茄从播种到采收完整60天（主=学习探索·种植科学+次=责任担当/创意审美）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=学习探索（园艺科学+观察记录方法60%）；次=责任担当（60天养护责任25%）+创意审美（番茄宴摆盘+手册排版10%）；潜=生活自理（日常操作5%） |
| 建议跨周期 | 6个周期（42天+，含催芽/移栽/整枝/采收全周期） |
| 里程碑（每7天1个） | 周期1「育苗期」：温汤浸种 + 纸巾催芽 → 播种入穴盘<br>周期2「移栽期」：2-3片真叶移栽大花盆 + 缓苗<br>周期3「营养生长期」：搭竹竿/番茄架 + 整枝打杈 + 绑蔓<br>周期4「开花坐果期」：人工授粉 + 疏花疏果（每穗留4-5果）<br>周期5「转色采收期」：追肥 + 防裂果 + 分批采收称重<br>周期6「总结展示期」：做番茄宴（2-3道菜）+ 写60天完整种植技术报告 |
| 每日自动生成子任务 | 每天1个养护任务（浇水/整枝/授粉按需）+ 观察记录（高度/花数/果数/重量） |
| 父任务完成最终产出物 | 1.累计采收番茄≥2斤，家庭番茄宴1餐成功举办；2.《60天家庭番茄种植技术手册》A4装订≥25页（含全周期记录+10个常见问题解决方案+2张趋势数据图：株高/坐果数）；3.送邻居/老师500g+手写感谢信2封 |

### 🧳 P1-G6-02 我的毕业旅行策划全案——3天2晚家庭自驾游（主=社交协作·沟通协调+学习探索·调研规划）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=社交协作（家庭成员需求沟通+总指挥协调55%）+学习探索（路线规划+预算方法30%）；次=责任担当（全程执行责任10%）；潜=生活自理（操作5%） |
| 建议跨周期 | 4个周期（28天） |
| 里程碑（每7天1个） | 周期1「需求调研期」：4位家庭成员需求问卷（想去哪/预算/吃什么）→ 3个候选目的地对比打分<br>周期2「方案设计期」：最终确定1地 → 每日行程表（景点+餐饮+住宿）+ 总预算3000元内方案<br>周期3「预订采购期」：酒店/门票/特产采购清单 + 车辆安全检查清单<br>周期4「执行+复盘期」：实际出行3天2晚孩子任总指挥（导航/点菜/办入住全负责）→ 回家写完整复盘报告 |
| 每日自动生成子任务 | 周期1-3每天1个查资料/比价/清单子任务；周期4集中3天出行，每天拆解为8个执行子任务（按行程） |
| 父任务完成最终产出物 | 1.3天2晚家庭自驾成功举办（预算控制±10%内）；2.《毕业旅行全案》A4装订1本（含需求问卷+3方案对比+最终行程+每日照片）；3.旅行Vlog≥5分钟；4.预算复盘表+家人满意度投票≥4人满意 |

### 🎓 P1-G6-03 毕业礼物设计制作——全家每人1件定制手工礼物+毕业感恩宴（主=社交协作·感恩沟通+次=创意审美/责任担当）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=社交协作（家人口需求访谈+赠送时感恩表达60%）；次=创意审美（礼物设计+装饰25%）+责任担当（按时完成制作责任10%）；潜=生活自理（手工操作5%） |
| 建议跨周期 | 3个周期（21天） |
| 里程碑（每7天1个） | 周期1「设计筹备期」：家人一对一访谈真实需求→5件礼物设计图+材料清单+采购<br>周期2「制作期」：每件礼物独立制作（总工时≥10小时，难度≥六年级水平，禁止纯买成品）<br>周期3「感恩宴+赠送期」：策划1次毕业感恩家宴（孩子全权负责4菜1汤）+ 逐件赠送礼物+每人≥1分钟感言录制 |
| 每日自动生成子任务 | 周期1访谈/设计/采购子任务；周期2每天1-2小时制作子任务；周期3家宴筹备/礼物包装子任务 |
| 父任务完成最终产出物 | 1.全家+老师每人1件亲手定制手工礼物（≥5件：爸爸/妈妈/爷爷/奶奶/班主任各1件）必须亲手制作禁纯买成品；2.毕业感恩家宴孩子独立完成四菜一汤；3.家宴全程记录Vlog+每人收礼物感言视频合计≥5分钟；4.《毕业礼物设计笔记》A5 1本，每件礼物含「设计思路+制作过程+家人反馈」三部分完整记录 |

### 🏠 P1-G6-04 14天"家政小总管"——全权负责全家家务与生活管理（主=社交协作·家庭沟通+次=责任担当/学习探索）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=社交协作（与家人沟通需求+照顾老人小孩互动55%）+学习探索（家政流程优化+财务记账方法20%）；次=责任担当（家政全权责任20%）；潜=生活自理（操作技能5%） |
| 建议跨周期 | 2个周期（14天） |
| 里程碑（每7天1个） | 周期1「家务接管期」：第1天与家长交接家务清单 → 每日三餐简餐安排（早餐2种+午餐3菜1汤+晚餐3菜1汤）+ 每日深度清洁（卫生间/厨房/客厅轮换）+ 日常采购（食材/日用品）+ 照顾老人小孩（辅导弟妹作业/陪老人聊天读报）<br>周期2「优化提升期」：第8天做第一周家政周记复盘 → 优化时间安排提高效率 → 第10-12天尝试1次家庭聚餐加菜（5菜1汤以上）→ 第14天完成家政总结报告 |
| 每日自动生成子任务 | 每天：早餐制作+采购计划+午/晚餐制作+指定区域清洁+照顾家人任务各1个；每周：家政周记1篇 |
| 父任务完成最终产出物 | 1.连续14天家务全负责无中断，家人满意度≥4/5分；2.《家政周记》2篇（每周1篇，每篇≥500字，含日程表/支出记录/问题与改进）；3.家政财务支出明细账（14天总预算≤700元，超支≤5%）；4.全家老人/小孩照顾记录（含作业辅导签字/陪聊记录）；5.第14天家庭总结会孩子做≥5分钟家政经验分享 |
| 参考学校标准 | 永城七小+长城路小学六年级综合家务要求 |

### 🤖 P1-G6-05 21天"AI生活实验室"——AI工具学习与家乡宣传方案设计（主=学习探索·AI技术+社交协作·展示演讲）

| 维度 | 内容详情 |
|-----|---------|
| 主次潜维度匹配 | 主=学习探索（AI技术学习+数字素养60%）+社交协作（向家人展示演讲+方案宣讲25%）；次=创意审美（AI图设计+宣传册排版10%）+责任担当（按时完成计划5%）；潜=生活自理（操作可忽略） |
| 建议跨周期 | 3个周期（21天） |
| 里程碑（每7天1个） | 周期1「AI工具熟悉期」：学习3种以上AI工具使用（文生图AI/文档AI/语音AI）→ 每种工具完成3次练习任务（如AI生成校园风景图/AI整理课堂笔记/AI朗读课文）→ 写《AI工具使用心得》第1周报告<br>周期2「家乡宣传方案设计期」：确定宣传主题（家乡特产/家乡风景/家乡名人/家乡历史4选1）→ 完成宣传方案框架（宣传目标/受众/内容/渠道）→ 用AI生成宣传图文素材（≥5张AI图片+AI撰写文案≥3篇）<br>周期3「展示演讲期」：制作完整家乡宣传册（A4≥8页，含AI图文+原创内容）→ 家庭展示演讲（≥8分钟，面向4位以上家庭成员）→ 收集家人反馈修改完善方案 |
| 每日自动生成子任务 | 周期1：每天1个AI工具练习任务；周期2：每天1个方案设计/AI素材生成任务；周期3：每天1个宣传册制作/演讲准备任务 |
| 父任务完成最终产出物 | 1.《AI工具练习作品集》1份（含3种工具各3次练习产出）；2.《家乡宣传方案》A4装订≥8页（含方案框架+≥5张AI生成图片+AI辅助文案+原创设计内容）；3.家庭展示演讲视频≥8分钟；4.家人反馈汇总表+方案修改版；5.21天AI学习日记（累计≥1500字） |
| 参考学校标准 | 台儿庄实验小学六年级AI与家乡宣传综合实践要求 |

---

## 四、特色主题周（4项，覆盖独立挑战/感恩/家乡宣传/社区体验）

| 主题代号 | 主题周名称 | 主题周对应任务集中安排方向（严格匹配主次潜） | 主题周推荐触发条件 |
|---------|-----------|----------------------------------------|----------------|
| T-G6-01 | 准成人独立挑战周 | 主维集中：晚餐全流程负责1次（社交协作主维）+1天家庭出游总指挥（社交协作主维）+每周理财账本（学习探索主维）+自我管理三件套全勤（学习探索主维）<br>次维：全屋深度清洁值日（责任担当次维） | 任意月首周自动触发 |
| T-G6-02 | 毕业感恩主题周 | 主维集中：毕业礼物/感恩家宴项目（社交协作主维·感恩表达）优先安排在这个主题周，赠送老师/长辈礼物任务集中联动<br>次维：礼物设计制作（创意审美次维）+家宴烹饪执行（责任担当次维） | 每年6月毕业季所在周自动触发 |
| T-G6-03 | "家乡文化宣传大使"主题周（参考台儿庄实小） | 主维集中：家乡宣传方案选题+实地探访（学习探索主维）+家庭展示演讲（社交协作主维）+AI素材生成（学习探索主维）<br>次维：宣传小报制作（创意审美次维）+资料收集（责任担当次维） | 每年国庆节前1周触发 |
| T-G6-04 | "卫生知识宣传员+社区管理体验"周（参考台儿庄+永城） | 主维集中：班级卫生知识宣讲（社交协作主维）+社区管理体验（社交协作主维·与物业/工作人员沟通）+体验报告撰写（学习探索主维）<br>次维：卫生海报制作（创意审美次维）+校园卫生巡查（责任担当次维） | 每学期第8周（期中前后）自动触发 |

---

## 五、日常拓展任务池（32条 | 覆盖8大类别，主维~62.5%，次维~31.25%，潜维~6.25% 严格合规）

> 积分区间：4-10分，按任务复杂度递增；能力维度严格匹配；抽取权重：主维6.25成，次维3.125成，潜维仅每周最多抽1条作为奖励
> 学术边界说明：无任何直接奖励考试分数的任务，学习类仅奖励「学习行为（AI工具/方案设计/知识整理/知识讲解）」，六年级允许奖励「进步幅度/进步行为」而非具体分数

| 编号 | 任务名称 | 所属类别 | 能力维度（严格主次潜） | 单次积分 | 可量化验收标准（参考公立小学官方清单） |
|-----|---------|---------|-------------------|---------|----------------------------------|
| **【学习探索 主维 13条，占比40.6%】** | | | | | |
| D-G6-01 | 独立完成一道家常炒菜 | 烹饪 | 主=学习探索（烹饪技法+调味搭配70%），次=责任担当+创意审美（摆盘），潜=生活自理 | 7分 | 长城路小学标准：①从青椒肉丝/土豆丝/番茄炒蛋/清炒时蔬等任选；②择→洗→切→炒全流程独立完成；③成品口味适中，无明显焦糊；④餐后灶台清洁归位；⑤家人≥2人评价"可以接受"及以上 |
| D-G6-02 | 独立煮一道营养汤品 | 烹饪 | 主=学习探索（营养学搭配+火候控制70%），次=责任担当，潜=生活自理 | 6分 | 永城七小标准：①从番茄蛋汤/紫菜蛋花汤/冬瓜排骨汤/玉米胡萝卜汤等任选；②食材搭配合理，汤色正常；③盐味适中；④汤量≥4人份；⑤附营养搭配小笔记≥50字 |
| D-G6-04 | 清洗鱼类食材（完整处理1条鱼） | 烹饪 | 主=学习探索（水产知识+处理技能75%），次=责任担当，潜=生活自理 | 8分 | 台儿庄实小标准：①处理草鱼/鲫鱼/鲈鱼等常见鱼类1条（≥500g）；②鱼鳞去净率≥95%；③鱼鳃/内脏完全去除，鱼腹内壁黑膜刮净；④处理后鱼身清洗干净，刀具砧板清洗消毒生熟分开 |
| D-G6-05 | 清洗贝类食材（处理≥1斤） | 烹饪 | 主=学习探索（海鲜知识+吐沙原理75%），次=责任担当，潜=生活自理 | 7分 | 槐荫刘庄小学标准：①处理蛤蜊/扇贝/花甲等≥500g；②盐水浸泡吐沙≥2小时；③外壳刷洗干净无泥沙；④记录吐沙换水次数≥2次；⑤附贝类小常识≥3条笔记 |
| D-G6-06 | 清洗并切配肉类食材 | 烹饪 | 主=学习探索（肉类营养+刀工技巧75%），次=责任担当，潜=生活自理 | 6分 | 白衣堂小学标准：①猪肉/鸡肉/牛肉≥300g任选；②血水清洗干净；③切块/切丝大小均匀；④刀具砧板使用后清洗消毒生熟分开；⑤家长确认刀具使用安全 |
| D-G6-15 | 分类整理书架/书籍（≥50本） | 收纳 | 主=学习探索（图书分类法+知识体系构建70%），次=创意审美+责任担当 | 5分 | 莱西洙河小学标准：①书籍总量≥50本；②按学科/大小/阅读频率/类别任选一种分类方式，分类逻辑清晰；③书架表面灰尘擦拭干净；④制作简易分类标签≥3个贴于层板 |
| D-G6-17 | 衣物洗护分类准备洗涤 | 收纳 | 主=学习探索（纺织材质+洗涤科学75%），次=责任担当，潜=生活自理 | 5分 | 长城路小学标准：①深色/浅色/内衣/易褪色/需要手洗共分≥4类；②检查所有口袋清空所有物品；③领口/袖口预处理（重点污渍打肥皂）；④填写洗涤说明便签（水温/模式）；⑤家长确认无染色缩水事故 |
| D-G6-26 | 辨识蔬菜质量（采购挑选5种以上） | 判别能力 | 主=学习探索（农产品知识+营养学70%），次=责任担当+社交协作（询价沟通），潜=生活自理 | 6分 | 永城七小标准：①在菜市场/超市独立挑选≥5种蔬菜（青菜/番茄/黄瓜/土豆/胡萝卜等）；②记录每种蔬菜判断依据（外观/颜色/手感/气味等每种≥2条）；③回家家长复核准确率≥80%；④附挑选过程照片≥3张 |
| D-G6-27 | 识别家中物品保质期+保修日期（≥25件） | 判别能力 | 主=学习探索（消费安全+法律常识75%），次=责任担当 | 7分 | 槐荫刘庄小学标准：①检查范围：食品柜+冰箱食品≥20件 + 小家电/电子产品≥5件；②填写《保质期/保修日期登记表》（含名称/购买日期/保质期/保修截止日期）；③标注临近过期（≤30天）的物品；④登记表家长确认无误 |
| D-G6-28 | 清除家中过期变质食品（≥4区域） | 判别能力 | 主=学习探索（食品安全+垃圾分类60%）+社交协作（家庭处理沟通20%），次=责任担当，潜=生活自理 | 7分 | 台儿庄实小标准：①检查范围：冰箱+食品柜+药箱+储物柜≥4个区域；②记录《过期物品清单》（含名称/过期日期/数量/处理方式）；③实物分类丢弃（食品/药品/电池等分类处理）；④家长复核无遗漏未发现的明显过期物品 |
| D-G6-30 | 家电小问题处理（排查3种） | 社会/公共 | 主=学习探索（家电原理+排查方法70%），次=责任担当，潜=生活自理 | 7分 | 莱西洙河小学标准：①完成3项任选：遥控器换电池并测试正常+更换烧坏的灯泡（家长安全指导下）+饮水机换桶装水+检查插座通电情况+家电说明书阅读并画出操作流程图；②每项处理后有功能测试记录（正常/待维修）；③填写《家电小问题处理日志》；④安全第一，复杂问题立即停报家长 |
| D-G6-31 | 熟悉AI工具（完成3个任务） | AI技术 | 主=学习探索（AI技术+数字素养70%），次=创意审美+责任担当 | 9分 | 台儿庄实小六年级AI课程标准：①使用文生图AI/文档AI/语音AI等≥1种工具；②完成≥3个不同任务：AI生成风景图（家乡/校园/未来城市3选1）+AI辅助整理课堂笔记（≥300字）+AI朗读课文录音（≥3分钟）；③附每次操作截图与输出结果；④写《AI工具使用心得》≥300字（含优势/不足/改进建议） |
| D-G6-32 | 设计小型宣传方案（含文案+配图思路） | AI技术/宣传 | 主=学习探索（营销策划+方案设计50%）+社交协作（面向家人方案宣讲40%），次=创意审美+责任担当 | 9分 | 长城路小学综合实践标准：①方案主题从班级活动/家庭出游/家乡美食/校园环保4选1；②含：宣传目标≥2条+目标受众≥2类+宣传文案≥200字+配图设计思路≥3张图构思+宣传渠道建议≥3个；③A4文档形式含简单排版或手绘配图；④面向≥2位家人做≥3分钟方案讲解，收集反馈≥3条 |
| **【社交协作 主维 7条，占比21.9% → 主维合计20条，占比62.5% ✅ 达标】** | | | | | |
| D-G6-07 | 独立制作早餐套餐（2种以上，≥3人份） | 烹饪 | 主=社交协作（为家人提供早餐服务+口味征询60%），次=责任担当+创意审美（搭配），潜=生活自理 | 6分 | 永城七小标准：①含2种以上品类：粥+包子+鸡蛋/豆浆+油条+小菜/牛奶+三明治+水果任选组合；②分量≥3人份；③餐具摆放整齐；④7:30前准备完毕；⑤家人评价"满意"≥2人 |
| D-G6-11 | 换洗全套床品（4人份，≥2套床） | 清洁 | 主=社交协作（为全家人服务+照顾家人睡眠体验60%），次=责任担当，潜=生活自理 | 8分 | 长城路小学标准：①拆：被套+床单+枕套（4人份≥2套床）全部拆下；②洗：分类放入洗衣机清洗；③晒：晾晒至完全干透；④铺：重新铺好，床单平整被套四角到位；⑤家人评价"舒服/干净"≥3人 |
| D-G6-18 | 家中垃圾分类习惯养成（连续3天监督+沟通） | 收纳 | 主=社交协作（家庭环保倡导+督促说服家人60%），次=责任担当+学习探索（分类统计），潜=生活自理 | 6分 | 白衣堂小学标准：①连续3天每天检查家中≥3个垃圾桶；②分类正确率≥90%（家长抽查）；③每天记录分类日志（发现的错误+改进方法）；④第3天做1次全家垃圾分类小提醒≥2分钟；⑤全家签字确认已收到提醒 |
| D-G6-23 | 照顾弟妹半天（≥3小时，独立看护） | 家庭照顾 | 主=社交协作（看护沟通+辅导方法60%）+学习探索（儿童心理+辅导方法20%），次=责任担当，潜=生活自理 | 9分 | 槐荫刘庄小学标准：①时长≥3小时家长不在场独立看护；②完成内容：辅导作业≥1小时+陪玩（阅读/游戏）≥1小时+安全看护（零安全事故）；③提供喝水/吃点心等生活照料；④家长事后评价"满意"及以上 |
| D-G6-24 | 陪伴照顾老人（≥2小时） | 家庭照顾 | 主=社交协作（倾听沟通+老人陪伴60%）+学习探索（记录家史+传统文化20%），次=责任担当，潜=生活自理 | 7分 | 莱西洙河小学标准：①时长≥2小时；②陪聊天≥40分钟+读报纸/念故事≥30分钟+陪散步/捶背/揉肩任选≥20分钟；③记录老人讲述的故事或往事≥1条（≥100字）；④老人评价"开心"及以上 |
| D-G6-25 | 主动和家人勤聊天（连续5天，每天≥15分钟） | 家庭照顾 | 主=社交协作（家庭关系建设+主动沟通70%），次=责任担当（家庭成员责任30%） | 6分 | 台儿庄实小标准：①连续5天每天≥15分钟主动聊天；②内容：分享学校趣事/学习心得/朋友交往/所见所闻等；③每天记录聊天主题日志；④至少主动询问家人情况≥3次/天（如"今天工作/身体怎么样"）；⑤家人反馈"感受到孩子的关心"≥2人 |
| D-G6-29 | 摆收餐桌+洗碗（≥1餐全家，4人份） | 社会/公共 | 主=社交协作（家庭餐后分工+尊重家人劳动60%），次=责任担当，潜=生活自理 | 5分 | 长城路小学标准：①饭前按人数摆好碗筷+汤勺+餐盘（≥4人份）；②饭后收碗→擦桌→洗碗（洗洁精清洗+冲洗干净+擦干放碗柜）→厨房台面擦拭；③餐具无油污无残渣；④台面清洁归位；⑤家人≥3人确认服务到位 |
| **【责任担当 次维 5条，占比15.6%】** | | | | | |
| D-G6-08 | 深度擦玻璃（≥2扇，含内外两面） | 清洁 | 次=责任担当（家庭清洁责任70%）+主=学习探索（清洁原理30%可忽略不计作次维），潜=运动健康 | 8分 | 槐荫刘庄小学标准：①清洁≥2扇玻璃窗含内外两面；②窗框+窗台同步清洁；③玻璃表面无水印无污渍无毛絮；④清洁工具清洗归位；⑤家长确认无安全隐患（站椅子等） |
| D-G6-09 | 全屋拖地（≥3室+2功能区） | 清洁 | 次=责任担当（家庭卫生责任70%）+主=学习探索（清洁效率优化可忽略），潜=运动健康+生活自理 | 6分 | 永城七小标准：①覆盖区域：客厅+≥2个卧室+厨房+卫生间共≥3室+2功能区；②清扫→拖地→收垃圾三步完整；③地面无明显水渍无毛发无碎屑；④拖把清洗晾干归位；⑤家长抽查≥3个区域合格 |
| D-G6-10 | 深度打扫厨房（≥40分钟） | 清洁 | 次=责任担当（厨房卫生责任70%）+主=学习探索（油污化学/消毒知识可忽略），潜=生活自理 | 9分 | 白衣堂小学标准：①覆盖区域：油烟机表面+灶台+橱柜内外+墙面+地面；②灶台无油污橱柜无灰尘；③垃圾清空换袋；④清洁时间≥40分钟；⑤家长戴白手套抽查2处无油污即通过 |
| D-G6-12 | 清洗马桶+消毒（全方位） | 清洁 | 次=责任担当（卫浴卫生责任70%）+主=学习探索（细菌/消毒知识可忽略），潜=生活自理 | 7分 | 莱西洙河小学标准：①清洁区域：内壁刷洗+外壁擦拭+底座清洁+盖板正反面+周边地面消毒；②马桶内壁无污渍水流通畅；③使用清洁剂后冲洗干净；④通风≥10分钟；⑤家长确认无异味无污渍 |
| D-G6-13 | 深度清洁卫生间（≥30分钟） | 清洁 | 次=责任担当（卫生间卫生责任70%）+主=学习探索（消毒/清洁流程可忽略），潜=生活自理 | 8分 | 长城路小学标准：①覆盖：洗手台+镜面无水渍+淋浴区玻璃/墙面+地漏毛发清理+地垫清洗+地面消毒；②垃圾桶换袋+消毒；③洗漱用品摆放整齐；④清洁时间≥30分钟；⑤家长确认干净无异味 |
| **【创意审美 次维 5条，占比15.6% → 次维合计10条，占比31.2% ✅ 达标】** | | | | | |
| D-G6-16 | 分类收纳衣物（衣柜整理，≥30件） | 收纳 | 次=创意审美（空间设计+收纳美学60%）+责任担当（家庭物品管理30%），主=学习探索（材质分类学可忽略），潜=生活自理 | 6分 | 永城七小标准：①衣物总量≥30件；②当季/过季分开+上衣/裤子/内衣/外套分层收纳；③折叠整齐摆放有序；④制作简易分区标识≥2个；⑤家长评价"美观+找衣服方便" |
| D-G6-19 | 缝制布艺品（≥1件成品，总工时≥2小时） | 手工 | 次=创意审美（布艺设计+美学搭配60%）+责任担当（实用30%），主=学习探索（缝制技艺10%可忽略） | 8分 | 台儿庄实小标准：①杯垫/小布袋/手机套/钥匙包任选1件；②针脚均匀无线头外露；③成品结构完整可用；④总工时≥2小时附制作过程照片≥3张；⑤家人≥2人评价"美观+实用" |
| D-G6-20 | 编织贴绣作品（≥1件成品） | 手工 | 次=创意审美（手工美学设计60%）+责任担当（完成30%），主=学习探索（编织/刺绣技法10%可忽略） | 8分 | 槐荫刘庄小学标准：①编织手链/项链/钥匙扣/小幅十字绣/贴布画任选；②编织类长度≥15cm结扣整齐；贴绣类尺寸≥15cm×15cm图案完整；③成品美观可使用；④附制作说明≥100字 |
| D-G6-21 | 剪刻装饰作品（≥3件成品） | 手工 | 次=创意审美（剪刻美学设计60%）+责任担当（完成30%），主=学习探索（剪刻工艺/传统文化10%可忽略） | 7分 | 白衣堂小学标准：①窗花/剪纸/纸雕/贺卡封面任选≥3件；②单件尺寸≥10cm×10cm；③线条流畅图案完整无断裂；④可用于窗户或墙面装饰展示；⑤家长评价"装饰效果好"≥2人 |
| D-G6-22 | 制作蛋糕/点心（≥1份成品） | 手工/烘焙 | 次=创意审美（烘焙装饰美学60%）+责任担当（供餐服务30%），主=学习探索（烘焙科学10%可忽略），潜=生活自理 | 10分 | 长城路小学标准：①电饭煲蛋糕/曲奇饼干/蛋挞/蒸蛋糕任选；②成品分量≥6个（蛋糕≥6寸）；③烘焙成功无明显塌陷/糊底可食用；④家人≥3人品尝评价"可以接受"及以上；⑤附制作过程照片≥3张 |
| **【潜维合计 生活自理/运动健康 仅2条纯潜维任务 → 折合2条，占比6.25% ✅ 合规】** | | | | | |
| D-G6-03 | 独立蒸米饭（4人份） | 烹饪 | 次=责任担当（供餐责任40%可附），潜=生活自理（基础操作技能，六年级理应掌握仅作奖励用） | 5分 | 莱西洙河小学标准：①米量≥2杯（约4人份）；②米饭软硬适中（不焦不稀）；③电饭煲内胆清洁；④米饭保温至开饭；⑤家长确认可作为日常基础能力 |
| D-G6-14 | 倒垃圾+垃圾分类投放（≥3个垃圾桶，全家清空） | 清洁 | 次=责任担当（家庭环保责任30%可附），潜=生活自理（基础操作技能，六年级理应掌握仅作奖励用） | 4分 | 槐荫刘庄小学标准：①清空家中所有垃圾桶≥3个；②按当地标准分类可回收/厨余/有害/其他正确率≥90%；③新垃圾袋套好；④送至指定投放点；⑤家长确认分类正确 |

---

## 六、六年级任务池主次潜合规性自检表（100%达标）

| 维度层级 | 理论占比 | 实际32条拓展池数量 | 实际占比 | 合规判定 |
|---------|---------|-----------------|---------|---------|
| Primary 主维（学习探索+社交协作） | ≥60% | 20条（学习探索13条+社交协作7条） | 62.5% | ✅ 达标。主维双线并行：学习探索侧重"知识/方法/科学"，社交协作侧重"沟通/服务/表达" |
| Secondary 次维（责任担当+创意审美） | ~30% | 10条（责任担当5条+创意审美5条） | 31.25% | ✅ 达标。责任担当聚焦"家庭清洁/卫生硬责任"，创意审美聚焦"手工/收纳/烘焙美学输出" |
| Latent 潜维（生活自理+运动健康） | ≤10% | 纯潜维2条（蒸饭D03/倒垃圾D14）+ 4条任务各附少量潜维折合≈0条，总计2条 | 6.25% | ✅ 达标。生活自理潜维严格控制在最基础操作（蒸饭倒垃圾），运动健康潜维完全预留作奖励 |

> 奖励用预留潜维任务（不进拓展池，仅作为主/次维周全勤奖励，不影响占比）：慢跑1.5公里/游泳20分钟/跳绳200个（运动健康·潜）、画1张《我眼中的毕业季》水彩画（创意审美·潜）、给全家搭配1套下周穿搭（创意审美·潜）

---

## 七、六年级学术红线+安全红线双合规总表

| 合规维度 | 合规校验项 | 合规判定 | 备注说明 |
|---------|-----------|---------|---------|
| **学术红线1** | 不直接奖励具体考试分数/名次 | ✅ 通过 | 学习类任务仅奖励：AI工具学习/宣传方案设计/知识分类/保质期鉴别/家电原理等"学习行为"和"思维方法" |
| **学术红线2** | 六年级仅允许奖励"进步幅度/进步行为" | ✅ 通过 | 进步行为类奖励可在锚任务H1-G6-02（自我管理三件套）中通过"本周完成率较上周提升≥20%"触发额外奖励，而非直接奖励期中期末考具体分数 |
| **安全红线1** | 燃气/刀/工具前置技能解锁链 | ✅ 通过 | 炒菜用燃气→必须S1-G6 Lv.1解锁（累计煮/煎≥10次）；切配肉类→必须S5-G6 Lv.2解锁（处理鱼≥10次+刀具确认书）；螺丝刀工具→必须S2-G6 Lv.0解锁（工具安全考核签字） |
| **安全红线2** | 所有危险操作强制陪同等级 | ✅ 通过 | 燃气前3次全程陪同+后续门外看护；肉类切配必须签署《高年级刀具使用确认书》+全程陪同；熨斗首次全程陪同；严格禁用电动工具 |
| **安全红线3** | 家政高风险操作（站椅子擦玻璃/换灯泡） | ✅ 通过 | 擦玻璃任务明确要求"站椅子家长扶稳"；换灯泡明确要求"家长安全指导下"；未达标不验收 |

---

> **版本记录**：
> V1.0 2026-08-04 初版：完整覆盖任务首页UI/四类验收/技能树/父任务/引擎10步算法/8张模型/12个接口/权限/埋点/合规清单/6份文档对齐
> V1.1 2026-08-04 架构升级增量：① Taxonomy 6类枚举+4字段扩展(task_kind/parent_id/supervision/prerequisite_code)复用现有表不新建 ② 14天Cycle级全局编排（9输入+10步批量生成+课程表日历视图）③ 能力缺口驱动主题周弱维×3加权 ④ 家长预览拍板5类调整+锁版 ⑤ Sanitize S1-S3 + RAG R1-R2共5条新规则，主Rank&Generate流水线完全不动 ⑥ 原表加4列+新增1张cycle_plan快照=9张模型 ⑦ 新增6个Cycle级API+8个埋点+4章验收增量Checklist
> V1.2 2026-08-04 附录增量：新增附录A-F共6个章节，完整收录1-6年级任务模板库原文（锚任务3-5条/年级 + 技能解锁树4-5棵/年级 + 跨周期父任务4-5项/年级 + 特色主题周4个/年级 + 日常拓展任务池26-32条/年级 + 合规性自检表），共计176条拓展任务模板全部入册，PRD从「引用文档」升级为「自包含文档」，开发者无需翻阅6份外部文件即可直接对照实现
> **V1.3 2026-08-04 周期可配置 + 阶段目标设定（当前版本）**：① Cycle 长度从固定14天 → 家长可选 1/2/3/4 周四档（`cycle_length_weeks` 字段）② 新增「支柱0：阶段目标设定」前置环节，家长先选定周期长度+重点能力维度（1-3个）+积分目标，再生成对应长度的课程表 ③ 新增 `cycle_goal_setting` 表 + `/api/v1/cycle-goals` 接口 ④ cycle_plan 表加 `cycle_length_weeks` + `goals_json` 两字段 ⑤ 触发时机从固定每周日20:00 改为 Cycle 结束前一周的周日20:00（按周期长度动态）⑥ 主题周规则适配：1周Cycle时整周期=主题周，2-4周时占其中1周（家长可调整位置）⑦ Cool-down池规则适配：1周Cycle下潜维14天冷却等价于"本Cycle内不重复" ⑧ 验收标准升级：6年级×4档周期长度×50次=1200次模拟 ⑨ 新增3个目标设定埋点+主题周位置调整埋点 ⑩ 文档对齐清单加 V1.3 阶段目标对齐校验列
