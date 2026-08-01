# Tasks

> 基于 PRD-v3 的 3 个 Phase 规划，按依赖关系排序。Phase 1（P0）为基础设施，必须先完成。

## Phase 1：基础设施（P0）

- [x] Task 1: 数据模型变更与数据库迁移
  - [ ] SubTask 1.1: 新增 9 个模型文件（AbilityDimension / ChildAbilityScore / GrowthCycle / Goal / Questionnaire / QuestionnaireAnswer / ChatSession / ChatMessage / GrowthStory）到 `backend/internal/model/`
  - [ ] SubTask 1.2: 修改 Task 模型，新增 `AbilityDimensionID`、`AIGenerated`、`SecondaryDimensions`（JSON）字段
  - [ ] SubTask 1.3: 修改 TaskTemplate 模型，新增 `AbilityDimensionID` 字段
  - [ ] SubTask 1.4: 修改 CommunityShare 模型，share_type 新增 "growth_story" 类型
  - [ ] SubTask 1.5: 在 `backend/internal/database/database.go` 注册新模型到 AutoMigrate
  - [ ] SubTask 1.6: 编写能力维度初始化脚本，预置 6 个维度数据（名称/描述/icon/研究来源）
  - [ ] SubTask 1.7: 废弃勋章系统模型（Achievement/UserAchievement/UserCounter/AchievementAward），从 AutoMigrate 移除，保留数据不删除
  - **验证**：启动后端，数据库表结构正确创建，6 个维度预置数据可查询

- [x] Task 2: 能力维度后端服务与 API
  - [ ] SubTask 2.1: 创建 `backend/internal/service/ability_service.go`，实现维度查询、儿童能力得分查询/更新、任务完成时按映射规则累加分值（主维度按难度权重 easy=1/medium=2/hard=3，次维度 × 0.5）
  - [ ] SubTask 2.2: 创建 `backend/internal/handler/ability_handler.go`，实现 GET /api/abilities（查询维度列表）、GET /api/abilities/scores/:child_id（查询儿童能力得分）、GET /api/abilities/growth-index/:child_id（查询成长指数）
  - [ ] SubTask 2.3: 在任务验收通过（task_service.go 的 review 逻辑）后调用 ability_service 更新能力维度分值
  - [ ] SubTask 2.4: 实现能力徽章触发逻辑（维度分值首次达 30/60/90 时触发铜/银/金）
  - [ ] SubTask 2.5: 在 `backend/cmd/main.go` 注册路由
  - **验证**：API 可返回 6 维度数据，任务验收后能力得分正确累加

- [x] Task 3: 底部 Tab 结构调整
  - [ ] SubTask 3.1: 修改 `frontend/src/components/BottomNav.tsx`，navItems 调整为 [助手/任务/成长/社区/设置]，图标改为 [Bot/ListTodo/Trophy/Globe/Settings] 或同等
  - [ ] SubTask 3.2: 修改 `frontend/src/App.tsx` 路由表，新增 /assistant 路由，将原 /home 改为 /tasks（或保留 /home 但组件改为任务页），默认路由指向 /assistant
  - [ ] SubTask 3.3: 调整 MainLayout 的 activeTab 推算逻辑，适配新路由
  - **验证**：底部显示 5 个新 Tab，点击切换正常，默认进入助手 Tab

- [x] Task 4: 任务 Tab 适配能力维度
  - [ ] SubTask 4.1: 修改 `frontend/src/types/index.ts`，Task 类型新增 abilityDimensionId/aiGenerated/secondaryDimensions 字段，新增 AbilityDimension/ChildAbilityScore 类型
  - [ ] SubTask 4.2: 修改 `frontend/src/services/tasks.ts`，创建任务 API 请求体新增 abilityDimensionId 字段
  - [ ] SubTask 4.3: 修改 `frontend/src/pages/CreateTaskPage.tsx`，新增"能力维度"必填选择器（6 个维度可选），未选择时阻止保存
  - [ ] SubTask 4.4: 修改任务详情页（TaskDetailPage），展示"本任务提升的能力维度"及预期分值
  - [ ] SubTask 4.5: 新增 `frontend/src/services/ability.ts`，封装能力维度查询 API
  - **验证**：创建任务时必须选择维度，任务详情页展示能力提升信息

- [x] Task 5: 成长 Tab 重构（移除勋章，新增能力雷达图，合并商城入口）
  - [ ] SubTask 5.1: 后端：移除勋章相关 API 路由（/api/achievements）从 main.go，handler/service 文件保留但不再注册
  - [ ] SubTask 5.2: 前端：重构 `frontend/src/pages/GrowthPage.tsx`，移除勋章 section，新增六维能力雷达图（使用 Recharts RadarChart）+ 成长指数 + 当前 IP 形态占位
  - [ ] SubTask 5.3: 保留成长相册与时间线 section，时间线新增"能力提升"事件类型展示
  - [ ] SubTask 5.4: 在成长页底部新增"积分兑换"入口区块，点击跳转到 MallPage（保留为子页面）
  - [ ] SubTask 5.5: 前端移除 `frontend/src/pages/AchievementSettingsPage.tsx` 和 `AchievementEditPage.tsx` 的路由引用，设置页移除"自定义勋章"入口
  - **验证**：成长页展示雷达图，相册时间线正常，商城入口可用，勋章相关入口已下线

## Phase 2：AI 能力（P1）

- [x] Task 6: AI 集成基础与助手 Tab 页面
  - [ ] SubTask 6.1: 后端配置 LLM 提供商（在 config.go 新增 AI 相关配置项：API Key、Model、BaseURL）
  - [ ] SubTask 6.2: 创建 `backend/internal/service/ai_service.go`，封装 LLM 调用（对话接口、任务生成接口、成长故事生成接口）
  - [ ] SubTask 6.3: 创建 `backend/internal/service/chat_service.go`，实现对话上下文构造（儿童信息/任务/成长/目标 → System Prompt）、对话会话管理
  - [ ] SubTask 6.4: 创建 `backend/internal/handler/chat_handler.go`，实现 POST /api/chat/message（发送消息）、GET /api/chat/history/:child_id（查询历史）
  - [ ] SubTask 6.5: 意图识别与权限校验（8 种意图：查询任务/提交任务/查询积分/查询能力/查询精灵/家长设置目标/家长回顾/闲聊陪伴）
  - [ ] SubTask 6.6: 前端：创建 `frontend/src/pages/AssistantPage.tsx`，对话窗口 UI（消息列表+输入框+IP 头像），IP 头像随精灵阶段变化
  - [ ] SubTask 6.7: 前端：创建 `frontend/src/services/chat.ts`，封装对话 API
  - [ ] SubTask 6.8: 前端：实现 IP 表情切换逻辑（根据 AI 响应语义切换 6 种表情）
  - **验证**：助手 Tab 可对话，能正确识别意图并返回数据，IP 表情切换正常

- [x] Task 7: AI 每日任务生成
  - [ ] SubTask 7.1: 创建 `backend/internal/service/task_generation_service.go`，实现每日任务生成逻辑（读取能力短板+家长目标+历史偏好+年龄 → 调用 LLM → 解析返回 → 写入 Task 表，ai_generated=true，status=1）
  - [ ] SubTask 7.2: 实现定时触发（可用 cron 库或系统定时器，每日 08:00 触发）
  - [ ] SubTask 7.3: 后端：实现家长审核 API（PUT /api/tasks/:id/ai-review，支持确认/调整/拒绝）
  - [ ] SubTask 7.4: 前端：任务列表中 AI 任务卡片显示 IP 精灵标识，新增"调整"按钮
  - [ ] SubTask 7.5: 前端：AI 任务审核弹窗（可修改标题/积分/难度后确认）
  - **验证**：每日自动生成 1-3 个 AI 任务，家长可审核调整

- [x] Task 8: 阶段周期与目标管理
  - [ ] SubTask 8.1: 创建 `backend/internal/service/growth_cycle_service.go`，实现周期创建、目标设置、目标进度查询
  - [ ] SubTask 8.2: 创建 `backend/internal/handler/growth_cycle_handler.go`，实现 POST /api/growth-cycles（创建周期）、POST /api/growth-cycles/:id/goals（设置目标）、GET /api/growth-cycles/current/:child_id（查询当前周期）
  - [ ] SubTask 8.3: 前端：在助手 Tab 对话中集成"家长设置目标"流程（通过对话引导设置维度+目标分值+周期）
  - [ ] SubTask 8.4: 前端：成长页新增"阶段回顾"浮动按钮（仅家长可见）
  - **验证**：家长可通过对话设置目标，成长页可见当前周期进度

- [x] Task 9: 阶段回顾与成长故事生成
  - [x] SubTask 9.1: 创建 `backend/internal/service/growth_story_service.go`，实现阶段回顾流程（读取周期数据 → 调用 LLM 生成故事 → 触发回顾问卷 → 重新评估能力维度 → 判定 IP 进化 → 生成下周期建议）
  - [x] SubTask 9.2: 创建 `backend/internal/handler/growth_story_handler.go`，实现 POST /api/growth-stories/:cycle_id（生成故事）、GET /api/growth-stories/:cycle_id（查询故事）
  - [x] SubTask 9.3: 前端：成长故事展示页面（展示故事内容+能力提升摘要+相册精选）
  - [x] SubTask 9.4: 前端：成长故事分享到社区（调用社区分享 API，share_type="growth_story"）
  - [x] SubTask 9.5: 社区模块前端适配：CommunityPage 动态列表支持展示 growth_story 类型卡片
  - **验证**：家长可触发回顾，生成成长故事，可分享到社区

## Phase 3：游戏化与体验完善（P2）

- [x] Task 10: 游戏化问卷系统
  - [ ] SubTask 10.1: 设计问卷题库数据结构（每题含：题目文本、维度映射、选项数组、每个选项的分值），预置到数据库或 JSON 配置文件
  - [ ] SubTask 10.2: 创建 `backend/internal/service/questionnaire_service.go`，实现按阶段（注册/每周/回顾）获取问卷、提交答案、计算维度分值、发放积分奖励
  - [ ] SubTask 10.3: 创建 `backend/internal/handler/questionnaire_handler.go`，实现 GET /api/questionnaires/:stage（获取问卷）、POST /api/questionnaires/submit（提交答案）
  - [ ] SubTask 10.4: 前端：创建 `frontend/src/pages/QuestionnairePage.tsx`，游戏化问卷 UI（IP 提问者+探险地图进度+情境故事包装）
  - [ ] SubTask 10.5: 前端：修改 `frontend/src/pages/FamilySettingsPage.tsx`，创建儿童档案后跳转到初始问卷
  - [ ] SubTask 10.6: 前端：每周问卷推送提示（在助手 Tab 或首页展示入口）
  - **验证**：注册时触发 6 题问卷，答题后能力维度初始分值正确计算

- [x] Task 11: IP 形象视觉资源与动画
  - [ ] SubTask 11.1: 基于 `.trae/documents/ip-reference-official.png` 风格基准，制作 5 个进化阶段的静态形象（种子/萌芽/小苗/小树/大树）
  - [ ] SubTask 11.2: 制作 6 种基础表情变体（开心/鼓励/思考/惊讶/安慰/骄傲）
  - [ ] SubTask 11.3: 制作关键动画（迎宾挥手/进化过渡/任务完成庆祝/阶段回顾徽章佩戴）
  - [ ] SubTask 11.4: 前端：创建 `frontend/src/components/IPAvatar.tsx` 组件，根据成长指数渲染对应阶段形象，支持表情切换与动画播放
  - [ ] SubTask 11.5: 前端：在各模块接入 IPAvatar 组件（助手 Tab 头像/任务卡片标识/成长页雷达图旁/问卷提问者）
  - **验证**：IP 形象在所有模块一致呈现，随成长指数进化

- [x] Task 12: 社区成长故事分享完善
  - [x] SubTask 12.1: 后端：CommunityShare 模型 share_type 支持 "growth_story"，关联 growth_story_id
  - [x] SubTask 12.2: 前端：CommunityPage 动态列表新增成长故事卡片样式（展示能力提升摘要+故事预览）
  - [x] SubTask 12.3: 前端：成长故事详情页新增"分享到社区"按钮
  - **验证**：成长故事可分享，社区正确展示

## 修复任务（验证发现）

- [x] Task 13: 后端家长专属功能权限校验
  - [x] SubTask 13.1: 在 `backend/pkg/util/jwt.go` 的 JWTClaims 增加 `Role string` 字段，GenerateJWT 函数签名增加 role 参数
  - [x] SubTask 13.2: 在 `backend/internal/middleware/jwt.go` 增加 `RoleKey` 常量和 `GetRole(c *gin.Context) string` 函数
  - [x] SubTask 13.3: 修改 `backend/internal/handler/auth_handler.go` 的 Login/Register，调用 GenerateJWT 时传入用户 role
  - [x] SubTask 13.4: 在 `backend/internal/handler/growth_story_handler.go` 的 GenerateStory 入口校验 `middleware.GetRole(c) == "parent"`，非家长返回 403
  - [x] SubTask 13.5: 在 `backend/internal/handler/growth_cycle_handler.go` 的 SetGoal 入口校验家长权限
  - **验证**：go build 通过，孩子角色调用生成故事/设置目标 API 返回 403

# Task Dependencies

- Task 2 依赖 Task 1（数据模型）
- Task 4 依赖 Task 2（能力维度 API）
- Task 5 依赖 Task 2（能力维度 API 用于雷达图）
- Task 6 依赖 Task 1（ChatSession/ChatMessage 模型）、Task 2（能力数据用于上下文）
- Task 7 依赖 Task 6（AI 服务）、Task 8（家长目标作为生成依据）
- Task 8 依赖 Task 1（GrowthCycle/Goal 模型）
- Task 9 依赖 Task 8（周期数据）、Task 6（AI 服务）、Task 10（回顾问卷）
- Task 10 依赖 Task 1（Questionnaire 模型）、Task 2（维度分值计算）
- Task 11 依赖 Task 2（成长指数触发进化）、Task 6（助手 Tab 接入）
- Task 12 依赖 Task 9（成长故事数据源）

## 可并行任务
- Task 3（Tab 调整）与 Task 1（数据模型）可并行
- Task 11（IP 视觉资源）可与 Task 6/7/8 并行（视觉制作不阻塞后端）
- Task 12（社区分享）可在 Task 9 完成后与 Task 10/11 并行
