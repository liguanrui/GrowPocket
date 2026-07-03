# 社区模块 - 验证清单

## 数据库与模型层
- [ ] 检查点 1: 8 个社区相关模型（CommunityShare, CommunityLike, CommunityComment, CharityProject, CharityDonation, CharityActivity, ActivityParticipant, Game, GamePlay）均正确定义了主键、索引、外键关系和 JSON tag
- [ ] 检查点 2: `database.Init()` 的 AutoMigrate 列表中包含所有新增模型，服务启动时表创建成功且无错误
- [ ] 检查点 3: 所有状态常量（如 ShareType, ActivityStatus, GameType, Difficulty 等）有命名常量定义，避免魔法数字
- [ ] 检查点 4: seed 数据（3 个公益项目 + 游戏题目）首次启动正确插入，且幂等（不重复插入）

## 后端 API 层
- [ ] 检查点 5: 社区分享 CRUD API：`POST/GET/DELETE /api/community/shares` 正常工作
- [ ] 检查点 6: 点赞和评论 API：`POST/DELETE /api/community/shares/:id/like`、`POST/GET /api/community/shares/:id/comments` 正常工作
- [ ] 检查点 7: 公益项目列表/参与 API：`GET /api/community/charity-projects`、`POST /api/community/charity-projects/:id/join` 正常工作
- [ ] 检查点 8: 公益活动 CRUD API：`GET/POST/DELETE /api/community/activities`、报名和完成 API 正常工作
- [ ] 检查点 9: 博弈游戏 API：`GET /api/community/games`、`POST /api/community/games/:id/play` 正常工作
- [ ] 检查点 10: 所有 API 响应格式与现有系统一致（`{code:0, message:"success", data:{...}}`）
- [ ] 检查点 11: 所有写操作 API 正确使用 JWT 认证中间件，未登录访问返回 401
- [ ] 检查点 12: 所有 API 的路由在 `backend/cmd/main.go` 的 `authorized` 组中正确注册
- [ ] 检查点 13: 分页 API 返回格式与现有 pattern 一致：`{items:[...], total:N, page:1, page_size:20}`
- [ ] 检查点 14: 删除操作仅允许创建者家庭执行，他人尝试删除返回 403 或参数错误

## 积分与 Transaction 集成
- [ ] 检查点 15: 参与公益项目时，Transaction 表中新增一条 type=0、amount=项目奖励分、reason="参与公益项目：{项目名}"的记录
- [ ] 检查点 16: 完成公益活动时，Transaction 表中新增一条对应记录，child.balance 正确增加
- [ ] 检查点 17: 完成博弈游戏时（答对/符合长度要求），Transaction 表中新增一条对应记录，child.balance 正确增加
- [ ] 检查点 18: 游戏次数超限不生成 Transaction，也不修改余额
- [ ] 检查点 19: 首页积分卡片数值与实际 child.balance 一致（因使用同一数据源，应自动同步）

## 前端导航与路由（UI 验证）
- [ ] 检查点 20: BottomNav 显示 6 个标签：首页、任务、商城、成长、家庭、社区
- [ ] 检查点 21: "社区"标签使用 Globe 图标，激活态正确显示 `bg-primary/10` + 橙色文字
- [ ] 检查点 22: 点击"社区"正确跳转到 `/community` 路由
- [ ] 检查点 23: 社区主页面正确加载，不被现有路由规则干扰
- [ ] 检查点 24: 社区内部 4 个子 Tab（动态/公益项目/公益活动/博弈游戏）可以相互切换
- [ ] 检查点 25: 从其他页面（如首页/任务页）返回社区页面时状态保持正常

## UI 设计系统一致性（视觉检查）
- [ ] 检查点 26: 社区主页使用 `from-emerald-500 to-green-600` 渐变顶部区域
- [ ] 检查点 27: 所有内容区域包裹在 `max-w-lg mx-auto` 内，移动端全宽，桌面端居中
- [ ] 检查点 28: 所有卡片使用 `bg-card rounded-2xl shadow-sm` 风格，与首页卡片一致
- [ ] 检查点 29: 所有按钮使用 `rounded-xl` 圆角，主色按钮 `bg-primary text-white`
- [ ] 检查点 30: 文字颜色遵循 text-primary / text-secondary / text-tertiary 三档系统
- [ ] 检查点 31: 页面背景色 `bg-bg`（#FFF8F0），卡片背景 `card`（#FFFFFF）
- [ ] 检查点 32: 所有页面包含 `pb-24` 以预留底部导航空间
- [ ] 检查点 33: 所有 lucide-react 图标使用正确的尺寸和颜色，未引用不存在的图标
- [ ] 检查点 34: 响应式布局：在 320px 窄屏和 1200px 宽屏下均正常显示（内容居中，无水平滚动）

## 社区主页与动态 Feed（UI 交互检查）
- [ ] 检查点 35: 社区主页显示动态 feed Tab（默认激活）
- [ ] 检查点 36: 顶部 4 个子模块快捷入口正确显示，点击跳转到对应 Tab
- [ ] 检查点 37: 每张分享卡片显示：头像、昵称、类型标签、相对时间、照片、标题、描述、积分（如适用）、点赞按钮、评论按钮
- [ ] 检查点 38: 动态 feed 加载时显示 loading 状态（spinner 或 skeleton）
- [ ] 检查点 39: 动态 feed 为空时显示空状态组件（图标 + 标题 + 描述 + CTA 按钮）
- [ ] 检查点 40: 右下角浮动"发表"按钮正确显示（Plus 图标 + 圆形橙色背景）
- [ ] 检查点 41: Tab 切换栏（动态/公益项目/公益活动/博弈游戏）激活态正确高亮为 `bg-primary text-white`

## 成长回忆分享功能（UI 交互检查）
- [ ] 检查点 42: 点击浮动"发表"按钮打开 ShareModal，界面样式与现有系统一致
- [ ] 检查点 43: ShareModal 中可预览照片、输入标题、输入描述、选择标签、查看关联任务信息
- [ ] 检查点 44: 标签按钮切换时激活态（橙色背景白色文字）和非激活态（灰色背景）视觉对比清晰
- [ ] 检查点 45: 点赞按钮点击后图标从空心 Heart 变为实心红色 Heart，数字 +1，150ms 内完成动画
- [ ] 检查点 46: 取消点赞时图标恢复空心，数字 -1
- [ ] 检查点 47: 点击评论按钮打开 CommentModal，显示评论列表、输入框、发布按钮
- [ ] 检查点 48: 自己发布的分享右上角显示"更多"图标，点击可删除；他人分享无此按钮
- [ ] 检查点 49: 删除时弹出二次确认对话框，取消关闭，确认后从列表移除

## 公益项目模块（UI 交互检查）
- [ ] 检查点 50: 公益项目 Tab 显示绿色主题渐变区域（from-green-500 to-emerald-600）
- [ ] 检查点 51: 3 个公益项目卡片（捐书/捐衣服/捐玩具）垂直排列，每张卡片显示项目图标、名称、描述、积分、参与按钮
- [ ] 检查点 52: 点击"参与"按钮打开 3 步流程模态框
- [ ] 检查点 53: 流程步骤 1 正确显示项目介绍、奖励积分、"开始填写"按钮
- [ ] 检查点 54: 流程步骤 2 根据项目类型显示不同的表单字段（捐书显示书名+数量，捐衣服显示类型+数量，捐玩具显示类型+数量+新旧程度）
- [ ] 检查点 55: 流程步骤 2 的上传照片区域为虚线边框，视觉上提示可点击上传
- [ ] 检查点 56: 流程步骤 3 显示绿色 Check 大图标、大号积分奖励数字、"继续浏览"和"查看积分记录"按钮
- [ ] 检查点 57: 我的参与记录列表显示在项目卡片下方，记录显示项目名称、时间、获得积分

## 公益活动模块（UI 交互检查）
- [ ] 检查点 58: 公益活动 Tab 显示蓝色主题渐变区域，右上角"发起活动"按钮
- [ ] 检查点 59: Tab 筛选栏（全部/捡垃圾/老人院/植树/博弈游戏）工作正常，各类型活动数量显示正确
- [ ] 检查点 60: 活动卡片显示大图标图片区域，状态标签使用不同颜色区分（绿色招募、蓝色进行、灰色结束）
- [ ] 检查点 61: 活动详情显示时间、地点、5/10 已报名格式正确
- [ ] 检查点 62: 底部操作栏显示积分奖励（参与者+80，组织者+100）+ 报名按钮/已报名按钮
- [ ] 检查点 63: 点击"发起活动"打开全屏幕创建活动模态框，字段完整（标题、类型、时间、地点、人数、描述）
- [ ] 检查点 64: 活动类型按钮组（pill 风格：捡垃圾/老人院/植树/博弈游戏/其他）支持选择，激活态高亮
- [ ] 检查点 65: 活动详情页显示发起者信息、参与者网格，不同报名状态显示正确的底部按钮
- [ ] 检查点 66: 报名满员时按钮变为"已满员"并禁用
- [ ] 检查点 67: 博弈游戏类活动在列表中显示 Brain 图标，区分于其他活动（Broom/HeartHandshake/TreePine）

## 组件文件结构（代码层验证）
- [ ] 检查点 68: `frontend/src/services/community.ts` 存在，包含所有社区相关 API 函数和 TypeScript 接口定义
- [ ] 检查点 69: `frontend/src/pages/CommunityPage.tsx` 存在并作为社区主页面组件
- [ ] 检查点 70: `frontend/src/components/community/` 目录下包含以下组件文件：ShareCard、CharityProjectCard、CharityActivityCard、CommentModal、ShareModal、ActivityCreateModal、LikeButton、EmptyState、SuccessModal（不含 GameTypeCard）
- [ ] 检查点 71: `frontend/src/components/BottomNav.tsx` 已更新包含"社区"（Globe 图标）为第 6 个 Tab
- [ ] 检查点 72: `frontend/src/App.tsx` 已更新包含社区路由 `path: "community"`

## Service 文件与类型定义
- [ ] 检查点 73: `community.ts` 定义了 `Share`、`Comment`、`CharityProject`、`Donation`、`CharityActivity`、`ActivityParticipant` 等 TypeScript 接口（不含 Game、GamePlay）
- [ ] 检查点 74: 接口字段与后端返回 JSON 数据结构一致（字段名 snake_case 或 camelCase 转换正确）
- [ ] 检查点 75: API 调用使用统一的 request 工具函数（与 tasks.ts、growth.ts 相同模式）
- [ ] 检查点 76: 分页参数 `{ page, page_size, sort, filter }` 支持并正确传递给后端

## 状态与错误处理
- [ ] 检查点 78: 所有列表页面加载时显示"加载中..."或 skeleton placeholder
- [ ] 检查点 79: 网络错误时显示友好的错误提示（错误信息 + 重试按钮）
- [ ] 检查点 80: 用户输入的文本内容（标题、描述、评论）有长度限制，超过限制时显示提示
- [ ] 检查点 81: API 乐观更新（如点赞）失败时正确回滚状态，避免 UI 与数据不一致
- [ ] 检查点 82: 模态框打开时有背景遮罩，点击背景或 ESC 键可关闭
- [ ] 检查点 83: 上传图片支持图片预览，上传失败时有错误提示

## 端到端与集成验证
- [ ] 检查点 84: `npm run dev` 启动前端无编译错误，`go run ./cmd/main.go` 启动后端无编译错误
- [ ] 检查点 85: 浏览器访问 `http://localhost:5173/community` 能正常加载社区页面并从 API 获取数据
- [ ] 检查点 86: 完整的用户旅程测试：登录 → 首页 → 社区 → 浏览公益项目 → 参与项目 → 返回首页查看积分更新 → 积分正确增加
- [ ] 检查点 87: 另一家庭账号登录后，能看到前一个家庭发布的分享内容（社区内容公开可见）
- [ ] 检查点 88: 数据隔离：不同家庭登录后只能删除自己发布的分享
- [ ] 检查点 89: 完整的活动流程：家庭 A 发起"捡垃圾"活动 → 家庭 B 浏览并报名 → 家庭 B 标记完成 → 积分正确发放（参与者+80）
- [ ] 检查点 90: 完整的博弈游戏类活动流程：家庭 A 发起"逻辑推理游戏"活动 → 家庭 B 报名 → 活动结束 → 家庭 B 标记完成 → 积分正确发放
- [ ] 检查点 91: 发布分享后立即刷新页面，新分享在动态 feed 中正确显示（排序按 created_at desc）
- [ ] 检查点 92: 所有页面的 font-size、line-height、颜色与现有页面视觉风格一致（对比 HomePage / GrowthPage / TaskListPage）
- [ ] 检查点 93: 无控制台 JavaScript 错误，所有点击和表单交互正常
- [ ] 检查点 94: 组件命名、文件命名规范与项目其他部分一致（PascalCase 组件、kebab-case 文件名或遵循现有风格）
