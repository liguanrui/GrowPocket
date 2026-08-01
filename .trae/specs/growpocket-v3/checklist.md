# Checklist

## Phase 1：基础设施（P0）

### Task 1: 数据模型变更与数据库迁移
- [x] 9 个新模型文件存在于 `backend/internal/model/`（AbilityDimension / ChildAbilityScore / GrowthCycle / Goal / Questionnaire / QuestionnaireAnswer / ChatSession / ChatMessage / GrowthStory）
- [x] Task 模型包含 `AbilityDimensionID`、`AIGenerated`、`SecondaryDimensions` 字段
- [x] TaskTemplate 模型包含 `AbilityDimensionID` 字段
- [x] CommunityShare 模型 share_type 支持 "growth_story" 类型
- [x] `database.go` 的 AutoMigrate 已注册 9 个新模型
- [x] 数据库初始化后存在 6 条预置能力维度数据
- [x] 勋章系统 4 个模型已从 AutoMigrate 移除（数据未删除）

### Task 2: 能力维度后端服务与 API
- [x] `ability_service.go` 实现维度查询、得分查询/更新、任务完成累加逻辑
- [x] 能力分值累加规则正确（主维度按难度 easy=1/medium=2/hard=3，次维度 × 0.5）
- [x] `ability_handler.go` 实现 3 个 API（GET /api/abilities、GET /api/abilities/scores/:child_id、GET /api/abilities/growth-index/:child_id）
- [x] 任务验收通过后能力维度分值自动更新
- [x] 能力徽章触发逻辑正确（维度分值首次达 30/60/90 触发铜/银/金）
- [x] 路由已在 `main.go` 注册

### Task 3: 底部 Tab 结构调整
- [x] `BottomNav.tsx` 的 navItems 为 [助手/任务/成长/社区/设置] 5 项
- [x] `App.tsx` 路由表包含 /assistant 路由
- [x] 默认路由指向 /assistant
- [x] MainLayout 的 activeTab 推算逻辑适配新路由
- [x] 点击 5 个 Tab 切换正常

### Task 4: 任务 Tab 适配能力维度
- [x] `types/index.ts` 包含 Task 新字段与 AbilityDimension/ChildAbilityScore 类型
- [x] 创建任务 API 请求体包含 abilityDimensionId
- [x] `CreateTaskPage.tsx` 包含能力维度必填选择器
- [x] 未选择维度时阻止保存并提示
- [x] 任务详情页展示"本任务提升的能力维度"及预期分值
- [x] `services/ability.ts` 封装了能力维度查询 API

### Task 5: 成长 Tab 重构
- [x] `main.go` 已移除 /api/achievements 路由注册
- [x] `GrowthPage.tsx` 移除勋章 section
- [x] `GrowthPage.tsx` 新增六维能力雷达图（Recharts RadarChart）
- [x] 雷达图旁展示成长指数与 IP 形态占位
- [x] 成长相册与时间线保留正常
- [x] 时间线支持"能力提升"事件类型
- [x] 成长页底部包含"积分兑换"入口，点击跳转商城
- [x] `AchievementSettingsPage.tsx` 和 `AchievementEditPage.tsx` 路由已移除
- [x] 设置页"自定义勋章"入口已移除

## Phase 2：AI 能力（P1）

### Task 6: AI 集成基础与助手 Tab 页面
- [x] `config.go` 包含 AI 配置项（API Key、Model、BaseURL）
- [x] `ai_service.go` 封装 LLM 调用（对话/任务生成/成长故事生成）
- [x] `chat_service.go` 实现上下文构造（儿童信息/任务/成长/目标）
- [x] `chat_handler.go` 实现 POST /api/chat/message、GET /api/chat/history/:child_id
- [x] 支持 8 种意图识别（查询任务/提交任务/查询积分/查询能力/查询精灵/家长设置目标/家长回顾/闲聊陪伴）
- [x] 权限校验正确（儿童无法触发家长专属意图）
- [x] `AssistantPage.tsx` 对话窗口 UI 完整（消息列表+输入框+IP 头像）
- [x] IP 头像随精灵阶段变化
- [x] `services/chat.ts` 封装对话 API
- [x] IP 表情根据响应语义切换（6 种表情）

### Task 7: AI 每日任务生成
- [x] `task_generation_service.go` 实现每日任务生成逻辑
- [x] 生成依据包含：能力短板、家长目标、历史偏好、年龄适龄性
- [x] 定时触发正常（每日 08:00）
- [x] 生成的任务 ai_generated=true，状态为"待确认"
- [x] 家长审核 API（PUT /api/tasks/:id/ai-review）实现
- [x] 前端 AI 任务卡片显示 IP 标识
- [x] 前端"调整"按钮可用，可修改标题/积分/难度

### Task 8: 阶段周期与目标管理
- [x] `growth_cycle_service.go` 实现周期创建、目标设置、进度查询
- [x] `growth_cycle_handler.go` 实现 3 个 API（创建周期/设置目标/查询当前周期）
- [x] 助手 Tab 对话中可触发"家长设置目标"流程
- [x] 成长页"阶段回顾"浮动按钮仅家长可见

### Task 9: 阶段回顾与成长故事生成
- [x] `growth_story_service.go` 实现阶段回顾完整流程
- [x] 回顾流程包含：读取数据→生成故事→触发问卷→重新评估→IP 进化判定→下周期建议
- [x] `growth_story_handler.go` 实现 2 个 API（生成故事/查询故事）
- [x] 成长故事展示页面完整（故事内容+能力摘要+相册精选）
- [x] 成长故事可分享到社区（share_type="growth_story"）
- [x] CommunityPage 支持展示 growth_story 类型卡片

## Phase 3：游戏化与体验完善（P2）

### Task 10: 游戏化问卷系统
- [x] 问卷题库数据结构完整（题目/维度映射/选项/分值）
- [x] 题库覆盖 6 个维度，每维度 5-8 题
- [x] `questionnaire_service.go` 实现按阶段获取/提交/计算/奖励逻辑
- [x] 注册时问卷 6 题（每维度 1 题）
- [x] 每周问卷 6 题（轮换维度）
- [x] 回顾问卷 12 题（每维度 2 题）
- [x] 初始维度分值计算正确（得分之和 ÷ 题数 × 20，映射到 0-100）
- [x] 完成问卷积分奖励正确（注册 50/每周 20/回顾 30）
- [x] `QuestionnairePage.tsx` 游戏化 UI 完整（IP 提问+探险地图+情境故事）
- [x] 创建儿童档案后自动跳转初始问卷
- [x] 每周问卷推送入口正常

### Task 11: IP 形象视觉资源与动画
- [x] 5 个进化阶段静态形象制作完成（种子/萌芽/小苗/小树/大树）
- [x] 6 种基础表情变体制作完成
- [x] 关键动画制作完成（迎宾/进化/庆祝/徽章佩戴）
- [x] 视觉风格与 `.trae/documents/ip-reference-official.png` 一致
- [x] `IPAvatar.tsx` 组件根据成长指数渲染对应阶段
- [x] `IPAvatar.tsx` 支持表情切换与动画播放
- [x] 助手 Tab 头像接入 IPAvatar
- [x] 任务卡片标识接入 IPAvatar
- [x] 成长页雷达图旁接入 IPAvatar
- [x] 问卷提问者接入 IPAvatar

### Task 12: 社区成长故事分享完善
- [x] CommunityShare 模型 share_type 支持 "growth_story" 且关联 growth_story_id
- [x] CommunityPage 动态列表展示成长故事卡片样式
- [x] 成长故事卡片展示能力提升摘要
- [x] 成长故事详情页"分享到社区"按钮可用

## 交叉验证

- [x] IP 形象在所有模块（助手/任务/成长/设置/社区）风格一致
- [x] 能力维度分值在任务完成→成长页雷达图→助手 Tab 查询 三处数据一致
- [x] 成长指数 = 六维平均分，IP 进化阶段与成长指数对应正确（0-20 种子/20-40 萌芽/40-60 小苗/60-80 小树/80-100 大树）
- [x] 家长专属功能（设置目标/阶段回顾）权限校验在对话与页面入口均生效
- [x] 勋章系统相关 API 与前端入口完全下线，无残留引用
- [x] 商城兑换流程从成长页入口进入，核心逻辑（扣分/扣库存）正常

## 修复任务

### Task 13: 后端家长专属功能权限校验
- [x] JWTClaims 含 Role 字段，GenerateJWT 接受 role 参数
- [x] middleware.GetRole(c) 可获取当前用户角色
- [x] auth_service Login/Register 调用 GenerateJWT 时传入 user.Role
- [x] growth_story_handler.GenerateStory 校验家长权限（非家长返回 403）
- [x] growth_cycle_handler.SetGoal 校验家长权限（非家长返回 403）
- [x] jwt_test.go 适配新签名并新增 Role 解析测试
- [x] go build 通过
- [x] go test ./pkg/util/... 通过
