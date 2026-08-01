# GrowPocket v3 升级 Spec

> **来源**：基于 `.trae/documents/PRD-童劳童得-v3.md` 生成
> **前置版本**：`.trae/specs/tonglaotongde/spec.md`（v2，已标记为历史版本）
> **变更性质**：重大版本升级——从"任务-积分-兑换"工具型应用升级为"AI 驱动的儿童能力成长陪伴平台"

## Why

GrowPocket v2 是"任务-积分-兑换"的工具型应用，存在三大问题：
1. **无 AI 集成**：所谓"AI 智能推荐"实为规则评分算法，无法提供个性化陪伴与对话
2. **成长模块扁平**：仅有数量型勋章计数，缺少多维度能力评估，无法回答"孩子在哪些能力上有提升"
3. **儿童画像单薄**：仅收集姓名/性别/生日，无法支撑 AI 个性化任务生成

v3 通过引入 AI 助理（种子精灵 IP）、六大能力维度系统、AI 任务生成、游戏化问卷四大模块，将产品从"家长手动管理"进化为"AI 基于能力画像自动驱动成长"。

## What Changes

### 底部 Tab 结构调整
- **新增** 助手 Tab（默认首页，AI 助理对话）
- **改名** 任务 Tab（原首页，保留手动任务 + 新增 AI 任务）
- **合并** 成长 Tab（原成长 + 商城，移除勋章系统，新增能力维度雷达图）
- **保留** 社区 Tab（新增成长故事分享联动）
- **拓展** 设置 Tab（儿童信息收集改造为游戏化问卷）

### 新增模块
- **IP 形象**：种子精灵"小芽"，5 阶段进化机制（种子→萌芽→小苗→小树→大树）
- **能力维度系统**：综合中国核心素养+CASEL+Gardner+蒙台梭利+埃里克森的六大维度
- **AI 助理**：对话式交互，支持查询/提交任务、查询积分、家长目标设置
- **AI 任务生成**：每日基于能力短板+家长目标自动创建 1-3 个任务
- **阶段回顾**：AI 生成成长故事，重新评估能力维度
- **游戏化问卷**：参考 MBTI 形式，分阶段投放（注册/每周/回顾）

### 数据模型变更
- **新增 9 个模型**：AbilityDimension / ChildAbilityScore / GrowthCycle / Goal / Questionnaire / QuestionnaireAnswer / ChatSession / ChatMessage / GrowthStory
- **修改 3 个模型**：Task（新增 ability_dimension_id 等）、TaskTemplate、CommunityShare
- **废弃 4 个模型**：Achievement / UserAchievement / UserCounter / AchievementAward（勋章系统移除）**BREAKING**

### BREAKING Changes
- 移除勋章系统相关 4 个模型及 API
- 商城从独立 Tab 降级为成长页内兑换入口
- Tab 顺序与结构变化（5 个 Tab 重新排列）

## Impact

- **Affected specs**：
  - `.trae/specs/tonglaotongde/spec.md`（v2，已标记历史）
  - `.trae/specs/community-module/spec.md`（新增成长故事分享类型）
- **Affected code**：
  - 后端：`backend/internal/model/`（新增 9 模型、修改 Task、删除 4 勋章模型）、`backend/internal/service/`（新增 AI/能力维度/问卷/对话服务）、`backend/internal/handler/`（新增对应 handler）、`backend/cmd/main.go`（路由注册）
  - 前端：`frontend/src/components/BottomNav.tsx`（Tab 调整）、`frontend/src/pages/`（新增 AssistantPage、重构 GrowthPage、拓展 SettingsPage）、`frontend/src/services/`（新增 AI/能力维度/问卷 API）、`frontend/src/types/index.ts`（类型定义）、`frontend/src/App.tsx`（路由）
- **IP 参考图**：`.trae/documents/ip-reference-official.png`（官方风格基准）

## ADDED Requirements

### Requirement: IP 形象系统（种子精灵）
系统 SHALL 提供种子精灵"小芽"作为 AI 助理的视觉载体，贯穿助手 Tab、设置问卷、成长回顾、任务标识，形态随儿童能力成长指数（0-100）进化为 5 个阶段。

#### Scenario: IP 形态随成长指数进化
- **WHEN** 儿童六大能力维度平均分（成长指数）从 19 变为 21
- **THEN** IP 形态从"种子"阶段进化为"萌芽"阶段，播放进化动画

#### Scenario: 阶段回顾触发特殊配饰
- **WHEN** 家长完成阶段回顾
- **THEN** IP 精灵戴上"成长徽章"配饰（如小皇冠），记录里程碑

### Requirement: 助手 Tab（AI 助理对话）
系统 SHALL 提供助手 Tab 作为 App 默认首页，以 IP 形象为头像，支持自然语言对话，自动构造上下文（儿童信息/任务/成长/目标），识别 8 种意图并执行对应动作。

#### Scenario: 查询任务
- **WHEN** 用户输入"我今天有什么任务？"
- **THEN** AI 识别意图为"查询任务"，返回今日任务列表，IP 表情切换为"鼓励"

#### Scenario: 家长通过对话设置阶段目标
- **WHEN** 家长输入"给小明设定这周的目标"
- **THEN** AI 识别家长权限，进入目标设置流程，引导设置维度+目标分值+周期
- **AND** 目标写入 Goal 表

#### Scenario: 儿童无法触发家长专属意图
- **WHEN** 儿童角色输入"生成本月成长回顾"
- **THEN** AI 拒绝执行，返回"这个功能需要家长操作哦~"

### Requirement: 能力维度系统
系统 SHALL 提供六大能力维度（生活自理/独立自主/动手实践/学习认知/社交情感/身心健康），每个任务关联 1 主维度 + 0-2 次维度，任务完成后按难度权重累加维度分值（0-100）。

#### Scenario: 任务完成更新能力维度
- **WHEN** 一个 medium 难度、主维度"动手实践"、次维度"生活自理"的任务验收通过
- **THEN** 动手实践维度 +2 分，生活自理维度 +1 分（次维度权重 × 0.5）

#### Scenario: 能力徽章触发
- **WHEN** 某维度分值首次达到 30/60/90
- **THEN** 触发对应铜/银/金能力徽章，可在成长页和社区展示

### Requirement: AI 每日任务生成
系统 SHALL 每日固定时间基于儿童能力短板、家长阶段目标、历史任务偏好、年龄适龄性，自动生成 1-3 个任务，状态为"待确认"，家长可审核/调整/拒绝，当日未审核自动生效。

#### Scenario: AI 每日生成任务
- **WHEN** 每日早 8:00 触发
- **AND** 儿童最弱维度为"社交情感"，家长目标为"提升社交情感 10 分"
- **THEN** 生成 1-3 个主维度为"社交情感"的任务，带 IP 标识，状态为"待确认"

#### Scenario: 家长审核 AI 任务
- **WHEN** 家长在任务 Tab 看到 AI 任务并点击"调整"
- **THEN** 可修改任务标题/积分/难度，确认后状态变为"进行中"

### Requirement: 阶段回顾与成长故事生成
系统 SHALL 支持家长在成长页触发阶段回顾，AI 基于周期内任务/能力数据/相册生成成长故事，故事可分享到社区，回顾后触发问卷重新评估能力维度并进入下个周期。

#### Scenario: 生成成长故事
- **WHEN** 家长点击"阶段回顾"按钮
- **THEN** AI 读取周期内数据，生成成长故事（含任务摘要、能力提升、相册精选）
- **AND** 触发回顾问卷（12 题，每维度 2 题）
- **AND** 重新评估能力维度，判定 IP 进化，生成下周期目标建议

### Requirement: 游戏化问卷系统
系统 SHALL 提供与 IP 形象交互的游戏化问卷，参考 MBTI 形式（情境选择题+行为频率自评），分阶段投放（注册 6 题/每周 6 题/回顾 12 题），答案映射到能力维度分值，完成问卷奖励积分。

#### Scenario: 注册时触发初始问卷
- **WHEN** 家长创建儿童档案后
- **THEN** 进入 6 题初始问卷（每维度 1 题），IP 作为提问者引导，答题进度以探险地图呈现
- **AND** 完成后计算初始维度分值，奖励 50 积分

#### Scenario: 答案映射能力维度
- **WHEN** 用户回答"周末妈妈让你帮忙做饭，你会..."选择"独立完成简单菜品"
- **THEN** 该选项对应"动手实践"维度 5 分，累加到维度得分

### Requirement: 成长 Tab 重构
系统 SHALL 重构成长 Tab，移除勋章系统，以六维能力雷达图为核心展示，保留相册与时间线，合并商城兑换入口，新增阶段回顾浮动按钮（家长权限）。

#### Scenario: 成长页展示能力雷达图
- **WHEN** 用户进入成长 Tab
- **THEN** 顶部展示六维雷达图 + 成长指数 + 当前 IP 形态
- **AND** 中部展示成长相册与时间线
- **AND** 底部展示积分兑换入口

### Requirement: 任务与能力维度关联
系统 SHALL 要求创建任务时必须选择 1 个主能力维度（手动与 AI 任务均需），可选 0-2 个次要维度，任务详情页展示"本任务提升的能力维度"及预期分值。

#### Scenario: 创建任务未选择维度
- **WHEN** 用户创建任务但未选择主能力维度
- **THEN** 阻止保存，提示"请选择本任务提升的能力维度"

## MODIFIED Requirements

### Requirement: 底部 Tab 导航
底部 Tab 结构从 v2 的"首页→商城→成长→社区→设置"调整为 v3 的"助手→任务→成长→社区→设置"，助手 Tab 作为默认首页。

#### Scenario: 切换 Tab
- **WHEN** 用户点击底部"助手"Tab
- **THEN** 路由跳转到 /assistant，IP 精灵迎宾动画播放

### Requirement: 商城兑换入口
商城从独立 Tab 降级为成长页内的兑换入口，核心兑换逻辑（扣分/扣库存）不变。

#### Scenario: 从成长页进入商城
- **WHEN** 用户在成长 Tab 点击"积分兑换"区块
- **THEN** 跳转到商城兑换子页面，展示商品列表

### Requirement: 社区分享类型
社区分享类型新增"growth_story"类型，支持分享成长故事。

#### Scenario: 分享成长故事
- **WHEN** 家长在阶段回顾后点击"分享到社区"
- **THEN** 创建一条 share_type="growth_story" 的社区动态，含能力提升摘要

## REMOVED Requirements

### Requirement: 勋章系统
**Reason**：勋章系统仅基于数量计数，无法反映多维度能力成长，被能力维度系统取代
**Migration**：
- 废弃模型：Achievement / UserAchievement / UserCounter / AchievementAward
- 旧勋章数据归档（不删除，仅下线 API 与前端展示）
- 前端移除勋章相关页面与组件（AchievementSettingsPage / AchievementEditPage）
- 设置页"自定义勋章"入口移除

### Requirement: 商城独立 Tab
**Reason**：商城从独立 Tab 降级为成长页内兑换入口，减少 Tab 数量，聚焦成长主题
**Migration**：
- BottomNav 移除 mall Tab
- MallPage 路由保留但改为子页面入口
- 兑换核心逻辑不变
