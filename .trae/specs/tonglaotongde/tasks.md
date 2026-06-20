# 童劳童得 - 实施任务清单（Implementation Plan）

## 项目阶段划分

- **阶段 1**：基础设施（项目初始化、数据库、认证）
- **阶段 2**：核心业务模块（孩子档案、任务、积分、兑换）
- **阶段 3**：数据展示模块（成长记录、数据可视化）
- **阶段 4**：UI 完善与用户体验优化
- **阶段 5**：系统集成测试与部署

---

## 【阶段 1】基础设施

### Task 1.1：项目结构初始化

- **Priority**：P0
- **Depends On**：None
- **Description**：
  - 创建后端目录结构：`backend/` 下建立 `cmd/`, `internal/{config,handler,service,repository,model,middleware,util}`, `pkg/response/`
  - 创建前端目录结构：`frontend/` 下建立 `src/{components,pages,stores,services,hooks,types,utils,lib}`
  - 根目录创建 README.md 简要说明项目结构和启动方式
  - 配置 `.gitignore`（排除 node_modules, .env, binary, uploads 等）
- **Acceptance Criteria Addressed**：NFR-030 ~ NFR-034（技术栈规范）
- **Test Requirements**：
  - `programmatic`：`go build ./cmd/main.go` 能编译成功（无业务逻辑，仅空文件或 stub）
  - `programmatic`：前端 `npm install && npm run build` 能构建成功（空组件）
  - `human-judgment`：目录结构符合规范，命名清晰合理
- **Notes**：此任务是基础骨架，不实现业务逻辑，只保证项目能跑起来

### Task 1.2：后端数据库接入与 GORM 模型

- **Priority**：P0
- **Depends On**：Task 1.1
- **Description**：
  - 在 `backend/internal/model/` 下定义 6 个核心模型：`User`（家长账号 + 孩子档案，统一在一张表）、`Family`、`Task`、`Transaction`、`RedeemItem`、`Redeem`
  - 字段严格对齐 `spec.md` 第 8.2 节表结构定义：
    - **User**（取代旧的 User + Child）：`id, role(ENUM 'parent'/'child'), nickname, password(NULL 允许 role=child 无账号), avatar, family_id, gender, birthday, balance, created_at, updated_at`
      - `role = 'parent'`：家长账号，能登录，password 必填
      - `role = 'child'`：孩子档案，暂不登录（password 可 NULL），gender/birthday/balance 必填
      - **已移除 `current_child` 字段**——切换孩子由前端 localStorage 记忆，后端接口统一用 `?child_id=` 查询参数
    - Family: `id, name, created_at, updated_at`（无 invite_code 字段）
    - Task: `id, family_id, title, description, points(可为正负——奖惩任务), status(1/2/3/4), child_id, created_by, photo, deadline, created_at, updated_at`
    - Transaction: `id, child_id, type, amount, reason, related_id, related_type, balance_after, created_at`
    - RedeemItem: `id, family_id, name, description, points, image, category, stock, created_at, updated_at`
    - **Redeem（已简化）**：`id, child_id, item_id, points, created_at`——**已移除 status/reject_reason/reviewed_at**，点击兑换即完成
  - 配置 SQLite 数据库连接（使用 GORM + gorm.io/driver/sqlite）
  - 应用启动时自动调用 `db.AutoMigrate()` 创建所有表
  - 数据库文件默认路径：`./data/growpocket.db`
- **Acceptance Criteria Addressed**：NFR-010（数据隔离，通过 family_id 字段实现）, NFR-013（SQL 注入防护，GORM 自动处理）
- **Test Requirements**：
  - `programmatic`：首次启动后 data 目录下出现 `.db` 文件
  - `programmatic`：使用 SQLite 客户端查询 `sqlite_master`，确认 6 张表都存在
  - `programmatic`：每个表的字段和约束与 spec 中一致（至少验证关键字段存在）
  - `programmatic`：**User 表中 role=child 的记录包含 balance 字段；不存在 current_child 字段**
- **Notes**：模型字段使用 GORM 标签设置约束（primaryKey, size, not null, index 等）；**User 表通过 role 区分家长和孩子，方便后续扩展为孩子独立登录**

### Task 1.3：JWT 认证中间件与工具函数

- **Priority**：P0
- **Depends On**：Task 1.2
- **Description**：
  - 实现 JWT Token 生成和验证函数（HS256 算法）
  - Token 有效期：2 小时，payload 中包含 `user_id`, `family_id`, `nickname`
  - 实现 Gin 中间件：从 `Authorization: Bearer <token>` 解析 Token，验证有效性，将用户信息放入 `c.Set("user", userInfo)`
  - 实现密码哈希：使用 bcrypt 哈希存储，成本因子 12
  - 在 `pkg/response/response.go` 实现统一响应格式（`{code, message, data}`）
  - 实现统一错误处理：400/401/403/404/500 的响应封装
- **Acceptance Criteria Addressed**：NFR-011, NFR-012
- **Test Requirements**：
  - `programmatic`：生成的 Token 可被同一函数验证通过，过期 Token 返回无效
  - `programmatic`：同一密码的两次哈希结果不同，但都能验证通过
  - `programmatic`：使用无效 Token 访问需要登录的接口返回 401
  - `human-judgment`：错误响应格式符合 spec 第 9.1 和 9.2 节规范
- **Notes**：JWT_SECRET 从环境变量读取，开发环境可设置默认值；**Token 不再包含 role 字段**——所有登录用户都是家长

### Task 1.4：注册 / 登录接口

- **Priority**：P0
- **Depends On**：Task 1.3
- **Description**：
  - `POST /api/auth/register`：创建家长账号（users 表，role='parent'）→ 自动创建家庭（families 表，家庭名 = 家长昵称 + "家"）→ 生成 Token
  - `POST /api/auth/login`：查询用户（role='parent'）→ 验证密码 → 生成 Token → 返回用户信息（含家庭信息；**已移除 current_child 字段——前端通过 localStorage 管理当前选中孩子**）
  - `POST /api/auth/refresh`：验证当前 Token → 生成新 Token（可选，若开发期不需要可延后，但代码结构需支持）
  - `POST /api/auth/logout`：前端操作，后端无需状态（无状态 JWT），返回成功
- **Acceptance Criteria Addressed**：FR-001 ~ FR-004
- **Test Requirements**：
  - `programmatic`：注册后查询 users 表确认数据存在，password 字段为 bcrypt 哈希值
  - `programmatic`：注册后 families 表自动新增一条，user.family_id 正确关联
  - `programmatic`：登录成功返回包含 token 和 user 的标准响应
  - `programmatic`：使用错误密码登录返回 401
  - `human-judgment`：注册成功后自动登录跳转到首页的体验流畅
- **Notes**：**移除邀请码相关逻辑**——家庭不再需要邀请码加入

### Task 1.5：前端认证页面与状态管理

- **Priority**：P0
- **Depends On**：Task 1.4
- **Description**：
  - `/login` 页面：账号密码输入，注册链接
  - `/register` 页面：昵称、密码、确认密码，登录链接
  - `authStore`（Zustand）：保存 token 和 user 信息，提供 login/logout/register/isLoggedIn 方法
  - `childStore`（Zustand）：保存当前选中孩子信息，提供 `setCurrentChild`, `loadChildren` 方法（用于 Task 2.1）
  - 路由守卫：未登录时访问需要登录的页面自动跳转到 /login
  - API 请求封装：统一 axios 实例，自动添加 Authorization header，401 自动清理 token 并跳转登录
- **Acceptance Criteria Addressed**：FR-001 ~ FR-004
- **Test Requirements**：
  - `programmatic`：登录后刷新页面保持登录状态（token 存 localStorage）
  - `programmatic`：未登录访问 /home 自动跳转到 /login
  - `human-judgment`：表单有输入提示和错误提示（密码太短、两次密码不一致等）
- **Notes**：密码最少 6 位，前端先做简单校验

---

## 【阶段 2】核心业务模块

### Task 2.1：孩子档案管理

- **Priority**：P0
- **Depends On**：Task 1.5
- **Description**：
  - 后端：`POST /api/children` 添加孩子档案（实际上是插入 users 表一条 `role='child'` 记录；字段：nickname，可选 gender/birthday；balance 默认 0）
  - 后端：`GET /api/children` 获取家庭下所有孩子列表（含积分余额，查询 users 表 where role='child' AND family_id=当前家庭）
  - 后端：`GET /api/children/{id}` 获取单个孩子详情
  - 后端：`PUT /api/children/{id}` 更新孩子信息（nickname, gender, birthday, avatar）
  - 后端：`DELETE /api/children/{id}` 删除孩子档案（有历史数据时提示确认）
  - **已移除**：`PUT /api/children/{id}/switch`——切换孩子由前端 localStorage 记忆，后端接口全部通过 `?child_id=` 查询参数识别目标孩子
  - 后端：`PUT /api/family/name` 修改家庭名称
  - 前端 `/family` 页面：展示孩子列表（姓名+头像+积分），添加孩子表单，编辑/删除操作，家庭名称修改入口
  - 前端顶部导航：显示所有孩子的切换 Tab（如有 ≥1 个孩子），点击切换时仅更新前端 localStorage `current_child_id`，随后页面自动调用各接口（接口中 ?child_id= 新ID）
- **Acceptance Criteria Addressed**：FR-010 ~ FR-017
- **Test Requirements**：
  - `programmatic`：添加孩子后 **users 表**新增一条 `role='child'` 记录，family_id 正确，balance=0
  - `programmatic`：GET /api/children 只返回 `role='child'` 且 family_id=当前家庭的记录，不返回家长账号
  - `programmatic`：删除孩子时若有历史数据（tasks/transactions/redeems 关联），应提示但允许强制删除
  - `programmatic`：家庭名称修改后 families.name 更新成功
  - `human-judgment`：孩子切换 Tab 体验流畅，切换后（前端更新 localStorage）页面数据自动刷新为对应孩子
- **Notes**：MVP 阶段头像为系统默认头像（根据姓名首字母生成彩色图标），暂不提供上传功能；后续可扩展

### Task 2.2：任务管理 - 创建与列表

- **Priority**：P0
- **Depends On**：Task 2.1
- **Description**：
  - 后端：`POST /api/tasks` 创建任务（校验 points > 0，child_id 为家庭内的孩子档案 ID）；status 默认 1（进行中）
  - 后端：`GET /api/tasks` 获取任务列表，支持 `?status=&child_id=&page=&page_size=`；默认查询当前选中孩子的任务
  - 后端：`GET /api/tasks/{id}` 获取任务详情
  - 后端：`PUT /api/tasks/{id}` 更新任务（仅 status ≤ 2 的任务可编辑——进行中/待验收）
  - 后端：`DELETE /api/tasks/{id}` 删除任务（仅 status ≤ 2 的任务可删除）
  - 前端 `/tasks` 页面：任务列表，状态 Tab 切换（全部/进行中/待验收/已完成/已拒绝）
  - 前端 `/tasks/create` 页面：创建任务表单（标题、描述、积分、截止时间、指派给哪个孩子——默认当前选中孩子）
  - 前端首页：显示当前选中孩子的进行中任务（限前 3-5 条）和待验收任务（含缩略图预览）
- **Acceptance Criteria Addressed**：FR-020 ~ FR-022, FR-026, FR-027
- **Test Requirements**：
  - `programmatic`：创建任务时 points 为负数返回 400
  - `programmatic`：任务创建后 status = 1（进行中），child_id 正确
  - `programmatic`：任务列表分页参数正常工作，按 child_id 筛选正确
  - `programmatic`：已完成任务再次编辑返回 400 或 403
  - `human-judgment`：任务卡片信息清晰，状态用不同颜色标签直观区分（进行中-蓝、待验收-橙、已完成-绿、已拒绝-红）
- **Notes**：**移除「待领取」状态（status=0）**——任务创建后直接为「进行中」（status=1），简化流程

### Task 2.3：任务状态流转（提交 / 验收）

- **Priority**：P0
- **Depends On**：Task 2.2
- **Description**：
  - 后端：`PUT /api/tasks/{id}/submit` 提交验收（status 1→2，保存成果照片 URL）
  - 后端：`PUT /api/tasks/{id}/review` 家长验收（status 2→3 或 2→4）
    - 通过：生成 Transaction（type=0 income, child_id=任务孩子, amount=实际评分, reason=`完成任务：{task.title}`），更新 `users(role=child).balance += points`，更新 `task.status=3`
    - 拒绝：`task.status=4`，不改变积分，可选记录拒绝理由（reason 字段）
  - **事务保证**：验收通过的"发放积分"必须原子操作（使用数据库事务——task.status 更新 + transaction 插入 + balance 更新三者要么全部成功要么全部回滚）
  - 文件上传：保存到 `backend/uploads/`，返回可访问 URL（`/uploads/xxx.png`）；图片类型限制 jpg/png/gif，大小 ≤5MB
  - 前端 `/tasks/:id` 页面：显示任务详情、当前状态指示；进行中状态显示「上传成果并提交验收」按钮和图片上传组件；待验收状态显示「验收通过 / 拒绝」按钮
  - 已拒绝状态的任务支持重新提交成果（变为待验收）
- **Acceptance Criteria Addressed**：FR-023 ~ FR-025, FR-032, NFR-014
- **Test Requirements**：
  - `programmatic`：提交成果后 status = 2，photo 字段有值
  - `programmatic`：验收通过后：① task.status = 3 ② 生成一条 transaction ③ users(role=child).balance = 原余额 + 实际评分 ④ transaction.balance_after = users(role=child).balance
  - `programmatic`：验收拒绝后：task.status = 4，users(role=child).balance 不变，不生成 transaction
  - `programmatic`：验收通过事务性：模拟 balance 更新失败，确认 task.status 不更新、无 transaction 记录
  - `programmatic`：上传超过 5MB 的图片返回 400
  - `programmatic`：上传非图片文件返回 400
  - `human-judgment`：上传照片预览清晰，验收操作有确认弹窗防止误操作
- **Notes**：**移除「领取」步骤**——家长创建任务时已指派给特定孩子，任务直接从「进行中」开始

### Task 2.4：积分管理 - 余额 / 明细 / 手动调整（= 创建奖惩任务）

- **Priority**：P0
- **Depends On**：Task 2.3
- **Description**：
  - 后端：`GET /api/score/balance` 返回指定孩子的积分余额（**`?child_id=` 必填**，不再依赖 current_child）
  - 后端：`GET /api/score/history` 返回积分变动记录（支持分页，`?child_id=` 必填）；记录字段：amount（正数）、type（0 收入 / 1 支出）、reason、balance_after、created_at
  - 后端：`POST /api/score/add` **手动加积分 = 创建一条 status=3（已完成）的任务**：校验 child_id 属于当前家庭，校验 points > 0 → 创建 tasks 表记录（title=传入的标题，points=传入积分，photo=可选上传的凭证照片 URL，status=3，created_by=当前家长）→ 生成 Transaction（type=0 income）→ 更新 `users(role=child).balance += points`
  - 后端：`POST /api/score/deduct` **手动减积分 = 创建一条 status=3（已完成）的任务**：校验 child_id 属于当前家庭，校验 balance ≥ points → 创建 tasks 表记录（points 为负数，photo 可选，status=3）→ 生成 Transaction（type=1 expense）→ 更新 `users(role=child).balance -= points`
  - **事务保证**：手动加减积分的「任务创建 + 积分更新 + transaction 插入」三者必须原子操作（数据库事务）
  - 前端 `/score` 页面：当前选中孩子积分余额卡片、积分趋势折线图、积分变动列表（时间倒序）、手动加减积分弹窗（输入积分值 + 标题 + 描述 + 可选凭证照片上传）
  - 前端顶部孩子 Tab 切换：切换后积分余额和历史自动刷新为新孩子数据
- **Acceptance Criteria Addressed**：FR-030 ~ FR-034
- **Test Requirements**：
  - `programmatic`：每次积分变动后 Transaction.balance_after = `users(role=child).balance`（查询验证一致性）
  - `programmatic`：手动减积分超过余额返回 400
  - `programmatic`：手动加/减积分后 **tasks 表新增一条 status=3 且 photo 字段可选**，同时 transaction 和 users.balance 都正确更新
  - `programmatic`：**若上传了凭证照片（photo 不为空），成长相册 GET /api/growth/album 应能查到该任务**
  - `programmatic`：尝试给不属于自己家庭的孩子加积分返回 403 或 400
  - `human-judgment`：积分明细列表按时间倒序显示，收入绿色、支出红色，显示变动后余额；奖惩任务的照片能在成长相册看到

### Task 2.5：积分商城 - 商品管理

- **Priority**：P0
- **Depends On**：Task 2.4
- **Description**：
  - 后端：`POST /api/redeem/items` 创建商品（name、points、category、可选 description 和 image）
  - 后端：`GET /api/redeem/items` 获取商品列表（分页 + category 筛选 + stock > 0 或 stock = -1 才显示可兑换）
  - 后端：`PUT /api/redeem/items/{id}` 更新商品（name、description、points、image、category、stock）
  - 后端：`DELETE /api/redeem/items/{id}` 删除商品（软删除——将 stock 设为 0 或添加 deleted 标记；已有兑换记录保留商品信息）
  - 前端 `/redeem` 页面：Tab 分类（全部/物质奖励/体验奖励/特权奖励）、商品网格卡片、家长视角显示「创建商品」按钮；显示当前选中孩子积分是否足够兑换
  - 前端 `/redeem/items/create` 页面：创建商品表单
- **Acceptance Criteria Addressed**：FR-040 ~ FR-044
- **Test Requirements**：
  - `programmatic`：商品 category 只能是 0/1/2，其他值返回 400
  - `programmatic`：删除商品后 GET /items 不包含该商品（或 stock=0 过滤），但已有兑换记录中仍能查询到商品信息
  - `programmatic`：商品列表分页正常工作
  - `human-judgment`：商品卡片样式精美，显示图片/名称/所需积分，积分足够时高亮兑换按钮
- **Notes**：stock = -1 表示无限库存（默认）；stock = 0 不显示；stock > 0 显示剩余数量

### Task 2.6：积分商城 - 直接兑换（无审核）

- **Priority**：P0
- **Depends On**：Task 2.5
- **Description**：
  - 后端：`POST /api/redeems` 为指定孩子发起兑换（**`child_id` 必填**）：校验 child.balance >= item.points，校验 stock != 0 → **立即原子扣除 balance → 创建 redeem 记录（无 status 字段，兑换即完成）→ stock -= 1（stock != -1 时）**
  - 后端：`GET /api/redeems` 获取兑换记录（分页 + `?child_id=` 筛选；**已移除 `?status=` 筛选**——所有记录即已完成）
  - **已移除**：`PUT /api/redeems/{id}/review`（不再需要审核环节）
  - **事务保证**：兑换操作「balance 扣减 + redeem 创建 + stock 扣减」三者必须原子操作（数据库事务），并发安全
  - 前端 `/redeem` 页面：商品卡片上显示「兑换」按钮，点击弹窗确认（显示"消耗 XX 积分兑换 {商品名}"）；积分不足/库存为0时按钮禁用+提示
  - 前端兑换记录：在商城页底部或单独 Tab 展示所有兑换历史，不再区分为待审核/已通过/已拒绝
- **Acceptance Criteria Addressed**：FR-045 ~ FR-047
- **Test Requirements**：
  - `programmatic`：兑换成功后 `users(role=child).balance = 原余额 - item.points`，redeems 表新增一条记录（无 status 字段），stock -= 1（有限库存时）
  - `programmatic`：积分不足时兑换返回 400 { message: "积分不足" }
  - `programmatic`：stock=0 时兑换返回 400 { message: "库存不足" }
  - `programmatic`：并发测试——同一孩子同时发起两次兑换（余额刚够），第二笔应返回积分不足；不同孩子并发兑换同一商品时 stock 计算正确
  - `human-judgment`：兑换确认弹窗清晰（显示"消耗 XX 积分兑换 {商品名}"），操作后积分余额有过渡动画

---

## 【阶段 3】数据展示模块

### Task 3.1：成长相册

- **Priority**：P1
- **Depends On**：Task 2.3（成果照片在任务提交时已存储）
- **Description**：
  - 后端：`GET /api/growth/album` 返回指定孩子的成果照片列表（分页，`?child_id=` 必填）；从 tasks 表中查询 `photo IS NOT NULL AND (status IN (2, 3) OR (status=3 AND points != 0))` 且 child_id = 指定孩子
    - **说明**：照片来源包括（a）常规任务提交验收时上传的成果照片；（b）手动加/减积分时上传的凭证照片（此时任务 status=3 且 points 为正负）
  - 响应字段：task_id、task_title、photo（URL）、points、created_at
  - 前端 `/growth` 页面顶部：网格布局的照片墙，点击图片查看大图模态框（含任务标题和获得的积分）
- **Acceptance Criteria Addressed**：FR-050
- **Test Requirements**：
  - `programmatic`：仅返回有照片的任务，不包含无照片的任务
  - `programmatic`：按 `?child_id=` 筛选正确，切换孩子后只显示对应孩子的照片
  - `programmatic`：分页正常工作
  - `human-judgment`：相册布局美观（网格或瀑布流），点击可查看大图，显示任务标题和积分

### Task 3.2：成长时间线

- **Priority**：P1
- **Depends On**：Task 3.1
- **Description**：
  - 后端：`GET /api/growth/timeline` 返回成长时间线事件（最近 30 天，`?days=` 可调整；`?child_id=` 必填）
  - 数据来源：
    - 完成任务（tasks.status=3）：标题 `完成任务：{title}`，points 正数
    - **奖惩任务（tasks.status=3 且 title 非"完成任务"格式）**：标题 = task.title，points 为正负（加积分正数、减积分负数）
    - 兑换商品（redeems）：标题 `兑换：{item.name}`，points 负数
    - 手动加减分（transactions.related_type IS NULL）：标题 = reason，points = type=0 时 +amount，type=1 时 -amount
  - 按日期分组，同一天多个事件聚合显示
  - 前端 `/growth` 页面下半部分：时间线样式展示事件，按日期从新到旧排列；事件显示标题、积分变动、时间
- **Acceptance Criteria Addressed**：FR-051
- **Test Requirements**：
  - `programmatic`：时间线包含三类事件，日期分组正确
  - `programmatic`：无数据时返回空数组（前端显示"暂无成长记录"）
  - `human-judgment`：时间线样式直观，日期分隔清晰，正积分数绿色、负数红色

### Task 3.3：积分趋势图

- **Priority**：P1
- **Depends On**：Task 2.4
- **Description**：
  - 后端：`GET /api/score/trend` 返回最近 N 天（默认 7 天，`?days=` 可调整）每天结束时的积分余额
  - 数据生成逻辑：从 transactions 表中查询当前孩子的所有记录，按日期聚合，计算每日余额；若无交易日期则沿用前一日余额；第一日前默认为 0
  - 返回格式：`[{ date: "2024-01-10", balance: 100 }, ...]`
  - 前端 `/score` 页面：使用 recharts（或同等库）渲染折线图；提供"近7天/近30天"切换按钮
- **Acceptance Criteria Addressed**：FR-035
- **Test Requirements**：
  - `programmatic`：返回的数据点数量 = 请求的天数
  - `programmatic`：最后一天的余额 = children.balance 当前值
  - `programmatic`：无任何交易的孩子返回从 0 开始的线（或全 0 数据）
  - `human-judgment`：图表样式与整体风格一致，趋势走向清晰可读

### Task 3.4：首页聚合

- **Priority**：P1
- **Depends On**：Task 3.3
- **Description**：
  - 前端 `/home` 页面：整合所有前面模块的关键信息
  - 顶部：孩子切换 Tab（显示孩子姓名+积分）
  - 积分卡片：当前选中孩子积分余额（大号数字），今日变动提示
  - 快捷操作：「发布任务」「创建商品」「积分调整」三个大按钮
  - 今日进行中任务：卡片列表（含「提交成果」快捷按钮）
  - 待验收任务提醒：数量 + 卡片列表（含缩略图预览 + 「验收」快捷按钮）
  - 未添加任何孩子时：显示「添加第一个孩子」引导卡片
- **Acceptance Criteria Addressed**：G1-G6
- **Test Requirements**：
  - `programmatic`：切换孩子 Tab 后，积分余额和任务列表都刷新为对应孩子数据
  - `programmatic`：未添加孩子时首页显示引导内容，不报错
  - `human-judgment`：首页布局合理、信息密度适中，最重要信息在首屏可见；操作按钮位置明显

---

## 【阶段 4】用户体验优化

### Task 4.1：消息提示与操作反馈

- **Priority**：P2
- **Depends On**：Task 3.4
- **Description**：
  - 全局 Toast 组件：成功（绿色对勾）、失败（红色叉号）、加载中（旋转图标）三种状态
  - 所有异步操作期间显示 loading 状态（按钮不可重复点击——disabled + loading icon）
  - 操作成功/失败后显示 Toast 提示（2-3 秒自动消失）
  - 危险操作（删除任务、删除孩子、兑换商品确认）添加二次确认弹窗
  - 积分变动时余额数字有动画效果（从旧值过渡到新值，1 秒内完成）
  - 表单提交支持 Enter 键触发
- **Acceptance Criteria Addressed**：NFR-022, NFR-023
- **Test Requirements**：
  - `programmatic`：网络请求失败时页面不卡死（loading 状态能被错误流程清除，重试机制）
  - `human-judgment`：反馈及时不拖沓（Toast 出现时机 ≤0.5 秒），确认弹窗文案清晰，操作流程流畅

### Task 4.2：响应式布局与移动端优化

- **Priority**：P2
- **Depends On**：Task 4.1
- **Description**：
  - 桌面端（≥1024px）：内容最大宽度限制（1200px 居中），双列布局（左侧导航+右侧内容）或单卡片网格
  - 平板端（768-1024px）：单列布局，卡片网格自适应
  - 移动端（≥375px）：单列布局，元素紧凑，按钮增大
  - 手机端底部 Tab 导航：首页、任务、商城、成长、我的（5 个入口）
  - 桌面端顶部导航：Logo（童劳童得） + 孩子切换 + 页面标题 + 消息铃铛 + 家长头像下拉菜单（个人中心/退出）
  - 表单元素宽度自适应（移动端填满屏幕宽度）
- **Acceptance Criteria Addressed**：NFR-020, NFR-021
- **Test Requirements**：
  - `human-judgment`：Chrome DevTools 中测试 375px、768px、1440px，无横向滚动条，无元素溢出
  - `human-judgment`：手机端可点击区域 ≥ 40×40px，点击准确率高

### Task 4.3：视觉设计完善

- **Priority**：P2
- **Depends On**：Task 4.2
- **Description**：
  - 将 spec 第 10.4 节色彩系统转化为全局 CSS/Tailwind 变量
  - 任务状态标签样式统一：进行中-蓝色、待验收-橙色、已完成-绿色、已拒绝-红色
  - 卡片统一圆角 16px，阴影柔和
  - 积分数字使用等宽字体或大号粗体（≥24px 或 text-3xl）
  - 孩子头像：根据姓名首字母生成彩色圆形头像（字母在正中）
  - 空状态页面：无任务、无商品、无兑换、无记录时显示优雅的占位插图 + 提示文案 + 快捷操作按钮（如"发布第一个任务"）
- **Acceptance Criteria Addressed**：NFR-021（视觉层次）
- **Test Requirements**：
  - `human-judgment`：色彩使用符合规范，不出现未定义的颜色
  - `human-judgment`：空状态提示友好，不使用户迷茫，提供下一步操作引导

---

## 【阶段 5】系统集成测试与部署

### Task 5.1：后端单元测试

- **Priority**：P1
- **Depends On**：Task 4.3
- **Description**：
  - 核心业务 Service 单元测试（Go testing 框架）：
    - TaskService.ReviewTask：验收通过时 users(role=child).balance 和 transactions 一致性；验收拒绝不改变积分
    - TaskService.SubmitTask：照片上传验证，状态流转 1→2
    - **TaskService.CreateRewardTask**：手动加/减积分 → 创建一条 status=3 的任务 + 生成 transaction + 原子更新 balance；photo 字段可选
    - RedeemService.CreateRedeem：积分不足时返回错误；积分足够时立即扣除余额 + 创建记录 + 扣 stock（**无审核，一步完成**）
    - ScoreService.AddPoints / DeductPoints：本质 = 调用 TaskService.CreateRewardTask（points 正负），验证积分变动和 balance_after 一致性
    - **（已移除 RedeemService.ReviewRedeem）**：不再需要审核接口
    - **（已移除 ChildService.SwitchChild）**：切换孩子由前端 localStorage 管理
  - 权限/隔离测试：尝试访问/修改其他家庭数据应失败
  - 测试使用独立的 SQLite 数据库文件（`:memory:` 或 `test_*.db`），每个测试结束后清理
- **Acceptance Criteria Addressed**：间接覆盖所有 FR 和部分 NFR
- **Test Requirements**：
  - `programmatic`：`go test ./...` 全部通过
  - `programmatic`：每个核心 Service 方法至少 1 个 success case + 1 个 fail case
  - 测试覆盖率：核心 Service 包 ≥ 70%

### Task 5.2：端到端集成测试

- **Priority**：P2
- **Depends On**：Task 5.1
- **Description**：
  - 使用工具（Postman collection / curl 脚本 / Go 代码测试）模拟完整用户流程：
    1. 家长注册 → 2. 添加孩子（2 个孩子用于测试切换）→ 3. 发布任务 → 4. 提交成果 → 5. 验收（通过）→ 6. 查看积分 → 7. **手动加积分（含凭证照片=奖惩任务）** → 8. 发布商品 → 9. **兑换商品（立即扣积分）** → 10. 查看成长相册和时间线（验证相册中既有任务照片也有奖惩任务凭证照片）→ 11. 切换孩子 → 重复流程 3-10
  - 验证每一步的数据库状态一致性
- **Acceptance Criteria Addressed**：端到端验证 G1-G6
- **Test Requirements**：
  - `programmatic`：完整流程脚本执行无错误，最终数据库数据一致
  - `programmatic`：切换孩子后所有查询都指向新孩子
  - `human-judgment`：用户体验流畅，从注册到使用无明显障碍

### Task 5.3：部署准备

- **Priority**：P2
- **Depends On**：Task 5.2
- **Description**：
  - 后端：`go build -o growpocket ./cmd/main.go` 生成可执行文件
  - 前端：`npm run build` 构建到 `frontend/dist/`
  - 部署方案：单服务器部署——后端作为静态文件服务器提供前端 dist 目录（或使用 Nginx 反向代理）
  - 环境变量：JWT_SECRET（默认开发值）、DB_PATH（默认 ./data/growpocket.db）、UPLOAD_DIR（默认 ./uploads）、PORT（默认 8080）
  - 文档：README 中添加启动步骤、环境变量说明、注意事项（如第一次运行自动创建目录）
- **Acceptance Criteria Addressed**：系统可被实际部署运行
- **Test Requirements**：
  - `programmatic`：在全新环境（Docker 容器或虚拟机）中按 README 步骤能成功启动并注册第一个用户
  - `human-judgment`：README 部署说明清晰，步骤完整，无遗漏
