# 童劳童得 - 验证清单（Verification Checklist）

## 一、基础设施验证

### 1.1 项目结构与构建

- [ ] 后端项目结构符合规范（`cmd/`, `internal/{config,handler,service,repository,model,middleware,util}`, `pkg/response/`）
- [ ] `go build ./cmd/main.go` 能成功编译
- [ ] 前端项目结构符合规范（`src/{components,pages,stores,services,hooks,types,utils,lib}`）
- [ ] `npm install && npm run build` 能成功构建
- [ ] `.gitignore` 正确排除 `node_modules/`, `.env`, `*.db`, `uploads/`, `dist/`

### 1.2 数据库模型

- [ ] **`users` 表存在（家长和孩子共用一张表），包含字段：`id, role, nickname, password, avatar, family_id, gender, birthday, balance, created_at, updated_at`**
  - **`role` 枚举 `'parent'` / `'child'`**：区分家长账号和孩子档案
  - **`password` 可为 NULL（role='child' 的孩子暂不登录）**
  - **`balance` 仅 role='child' 时有意义**（家长 role='parent' 的 balance 可为 0 或 NULL）
  - **`gender/birthday` 仅 role='child' 有意义**
- [ ] `families` 表存在，包含字段：`id, name, created_at, updated_at`（**无 invite_code 字段**）
- [ ] **已移除 `children` 表**——孩子档案已合并到 users 表（role='child'）
- [ ] `tasks` 表存在，包含字段：`id, family_id, title, description, points(**可正可负,奖惩任务**), status, child_id, created_by, photo, deadline, created_at, updated_at`
- [ ] `transactions` 表存在，包含字段：`id, child_id, type, amount, reason, related_id, related_type, balance_after, created_at`
- [ ] `redeem_items` 表存在，包含字段：`id, family_id, name, description, points, image, category, stock, created_at, updated_at`
- [ ] **`redeems` 表存在（已简化），包含字段：`id, child_id, item_id, points, created_at`**
  - **已移除 `status / reject_reason / reviewed_at` 字段**——无审核环节
- [ ] 首次启动应用能自动创建所有表（AutoMigrate）
- [ ] `password` 字段不为明文，长度 ≥ 60（bcrypt 哈希特征）
- [ ] **`users(role='child').balance` 字段为整型，默认值 0**
- [ ] **已移除 `current_child` 字段**——切换孩子由前端 localStorage 记忆

### 1.3 认证与安全

- [ ] JWT Token 使用 HS256 算法签名
- [ ] Token 包含 `user_id`, `family_id`, `nickname` 信息（**无 role 字段**）
- [ ] Token 有效期为 2 小时
- [ ] 密码使用 bcrypt 哈希存储（cost ≥ 10，推荐 12）
- [ ] 未携带有效 Token 请求需要登录的接口返回 401
- [ ] 所有 API 响应格式统一为 `{ code, message, data }`

---

## 二、用户流程验证

### 2.1 注册 / 登录

- [ ] 注册新用户：输入昵称和密码 → 成功 → 返回 Token 和 user
- [ ] 注册成功后：users 表新增一条，families 表自动新增一条（家庭名 = 昵称 + "家"），user.family_id = 新家庭 id
- [ ] 使用已注册的昵称重新注册返回错误（昵称已存在）
- [ ] 使用正确密码登录成功，返回 Token
- [ ] 使用错误密码登录返回 401
- [ ] 登录后刷新页面保持登录状态（Token 存 localStorage）
- [ ] 未登录访问 /home 自动跳转到 /login
- [ ] 登录后若家庭尚未添加任何孩子，首页显示「添加第一个孩子」引导

### 2.2 孩子档案管理

- [ ] 家长能获取家庭成员列表（**users 表中查询 role='child' 的孩子 + 积分余额**）
- [ ] `POST /api/children` 能添加孩子（实际是插入 users 表 role='child' 记录，至少需要 nickname）
- [ ] **已移除 `PUT /api/children/{id}/switch`**——切换孩子由前端 localStorage 管理，后端通过 `?child_id=` 参数识别
- [ ] 前端点击孩子 Tab 后，localStorage 记录当前 child_id，所有页面自动刷新为对应孩子数据
- [ ] 能更新孩子信息（nickname、性别、生日、头像）
- [ ] 能删除孩子档案；删除时若该孩子有历史数据（任务/积分/兑换记录），应提示确认但允许强制删除
- [ ] `PUT /api/family/name` 能修改家庭名称

### 2.3 任务发布

- [ ] 家长能创建任务：填写 title、points、child_id（指派给某个孩子）、deadline（可选） → 成功
- [ ] 任务创建后 status = 1（进行中），**无"待领取"状态**
- [ ] 任务 points 必须为正整数，否则返回 400
- [ ] child_id 必须是家庭内的孩子，否则返回 400
- [ ] 任务出现在任务列表和当前孩子的首页
- [ ] 家长能编辑进行中/待验收任务（status ≤ 2）的 title、points、deadline
- [ ] 家长能删除进行中/待验收任务
- [ ] 家长不能编辑/删除已完成/已拒绝任务（status > 2）

### 2.4 任务状态流转（核心闭环）

- [ ] 家长提交成果：上传照片，status 1 → 2（待验收）
- [ ] 照片上传限制 ≤ 5MB，超出限制返回错误
- [ ] 照片类型限制：仅 jpg/png/gif，其他类型返回错误
- [ ] 上传的照片文件存储在 uploads/ 目录，文件名使用 UUID/时间戳而非原始文件名
- [ ] 家长在首页或任务页能看到待验收提醒（含缩略图预览）
- [ ] 家长验收通过：status 2 → 3（已完成），生成一条 Transaction（type=0 收入），**`users(role='child').balance`** 增加
- [ ] 验收通过事务性：若任意一步失败则整体回滚（task.status 不更新、无 transaction 记录）
- [ ] 家长验收拒绝：status 2 → 4（已拒绝），不改变积分
- [ ] 已拒绝的任务支持重新提交成果（重新上传照片 → status 变为 2 待验收）
- [ ] 积分变动后，Transaction.balance_after 与 `users(role='child').balance` 一致

### 2.5 积分管理

- [ ] 用户能看到当前选中孩子的积分余额
- [ ] 顶部孩子 Tab 显示每个孩子的积分余额
- [ ] 能看到积分变动明细（时间倒序，分页）
- [ ] 明细包含原因、金额（收入正数 / 支出负数，用不同颜色显示）、变动后余额
- [ ] **家长能手动加积分（POST /score/add）—— 指定 child_id、title、description；**可选上传凭证照片**；本质是创建一条 status=3 且 points>0 的任务记录
- [ ] **家长能手动减积分（POST /score/deduct）—— 指定 child_id、title、description；可选上传凭证照片；本质是创建一条 status=3 且 points<0 的任务记录**
- [ ] 手动减积分时：余额不足返回 400
- [ ] 尝试给不属于自己家庭的孩子加/减积分返回 403 或 400
- [ ] **积分趋势图最后一天余额 = `users(role='child').balance` 当前值**
- [ ] **手动加/减积分时若上传了照片，该照片在成长相册中应能查询到**

### 2.6 积分商城 - 商品

- [ ] 家长能创建商品：name、points、category、可选 description 和 image，成功
- [ ] 商品 category 只能是 0/1/2（物质/体验/特权奖励），其他值返回 400
- [ ] 商品列表按时间倒序显示（或热度排序）
- [ ] 商品列表能按 category 筛选（Tab 切换）
- [ ] 商品图片能正常显示（上传后可通过 URL 访问）
- [ ] 家长能编辑现有商品
- [ ] 家长能删除商品，删除后不出现在列表，但已有兑换记录中仍能查询到商品信息（通过 redeem.item_id 关联查询）
- [ ] stock = 0 时不可兑换（按钮变灰或隐藏）；stock = -1 表示无限库存
- [ ] 并发兑换同一商品（有限库存）时，最终 stock 数量正确（不超卖）

### 2.7 积分商城 - 直接兑换（无审核）

- [ ] 指定孩子积分 ≥ 商品 points 时能发起兑换（child_id 必填）
- [ ] **兑换立即完成**：`users(role='child').balance` 立即扣除 points，redeems 表新增记录（**无 status 字段**），stock（有限时）立即 -1
- [ ] 积分不足时兑换返回 400 { message: "积分不足" }
- [ ] stock=0 时兑换返回 400 { message: "库存不足" }
- [ ] **已移除 `PUT /api/redeems/{id}/review` 接口**——不再需要审核通过/拒绝流程
- [ ] 兑换记录列表（GET /api/redeems）按时间倒序显示（**不再按 status 筛选**）
- [ ] 兑换记录中 child_id 必须属于当前家庭，否则返回 403
- [ ] 前端兑换确认弹窗显示"消耗 XX 积分兑换 {商品名}"，操作后余额立即更新并显示过渡动画

---

## 三、数据展示验证

### 3.1 成长相册

- [ ] 相册页展示指定孩子（`?child_id=` 必填）**两类照片**：（a）status=2 或 3 的任务成果照片；（b）**status=3 且 photo 不为空的奖惩任务凭证照片**
- [ ] 不包含无照片的任务
- [ ] 点击照片能查看大图（模态框或放大效果）
- [ ] 每张照片下方显示任务标题和获得的积分（奖惩任务显示 ± 对应积分）
- [ ] 按时间倒序排列（最新的照片在前面）
- [ ] 切换孩子后只显示新孩子的照片
- [ ] **完成一次手动加积分并上传照片后，该照片应出现在成长相册中**

### 3.2 成长时间线

- [ ] 时间线展示**四类事件**：完成任务、**奖惩任务**、兑换商品、手动加减分
- [ ] 事件按日期分组，日期从新到旧排列
- [ ] 任务完成事件显示：标题"完成任务：xxx"，正积分数
- [ ] **奖惩任务事件显示：标题 = task.title（如"期中考试进步奖"），± 积分数**
- [ ] 兑换事件显示：标题"兑换：xxx"，负积分数（或红色显示）
- [ ] 手动加减分显示：reason 作为标题，±积分数
- [ ] 切换孩子后只显示新孩子的事件
- [ ] 无数据时显示"暂无成长记录"友好提示

### 3.3 首页聚合

- [ ] 家长视角首页：显示孩子切换 Tab + 当前选中孩子积分 + 今日任务 + 待验收数量（**已移除待审核数量**）
- [ ] 切换孩子 Tab 后，所有数据刷新为对应孩子的
- [ ] 快捷操作按钮：发布任务、创建商品、积分调整（三个大按钮或卡片入口）
- [ ] 今日进行中任务列表：显示任务标题、积分、截止时间（如有）、「提交成果」快捷按钮
- [ ] 待验收任务列表：显示缩略图、标题、积分、「验收」快捷按钮
- [ ] 首页信息密度适中，关键操作入口明显
- [ ] 未添加任何孩子时：显示「添加第一个孩子」引导卡片（不报错）

---

## 四、用户体验验证

### 4.1 视觉与交互

- [ ] 整体色彩符合规范（主色阳光橙 #FF9500，暖色背景）
- [ ] 任务状态用不同颜色标签区分（进行中-蓝、待验收-橙、已完成-绿、已拒绝-红）
- [ ] 卡片圆角样式统一（16px），阴影柔和
- [ ] 字号层级清晰（正文 16px、标题 18-24px、大积分 ≥ 24px）
- [ ] 孩子头像：根据姓名首字母生成彩色圆形头像（字母居中）
- [ ] 空状态有友好的提示和占位插图 + 快捷操作按钮

### 4.2 操作反馈

- [ ] 所有异步操作期间显示 loading 状态（按钮不可重复点击——disabled + loading icon）
- [ ] 操作成功后显示成功 Toast 提示（2-3 秒自动消失）
- [ ] 操作失败后显示明确的错误信息（不只是"出错了"）
- [ ] 危险操作（删除任务、**兑换商品确认**、删除孩子）有二次确认弹窗
- [ ] 积分变动时余额数字有动画效果（从旧值过渡到新值）
- [ ] 表单提交时 Enter 键能触发提交
- [ ] 网络请求失败时页面不卡死（loading 能被错误流程清除，有重试入口）

### 4.3 响应式

- [ ] 手机端（375px）：无横向滚动条，元素不溢出
- [ ] 平板端（768px）：布局正常，卡片网格自适应
- [ ] 桌面端（≥1024px）：最大宽度限制，内容居中
- [ ] 手机端按钮可点击区域 ≥ 40×40px
- [ ] 手机端导航：底部 Tab（首页/任务/商城/成长/我的）
- [ ] 桌面端导航：顶部菜单 + 孩子切换 Tab

---

## 五、数据隔离与安全验证

### 5.1 家庭数据隔离

- [ ] 来自 A 家庭的用户查询任务列表不包含 B 家庭的任务
- [ ] 来自 A 家庭的用户查询商品列表不包含 B 家庭的商品
- [ ] 来自 A 家庭的用户查询积分历史不包含 B 家庭的记录
- [ ] 尝试访问/修改其他家庭的孩子档案（通过直接改 URL 或 child_id 参数）返回 403 或 400
- [ ] 尝试访问/修改其他家庭的任务详情返回 403 或 404

### 5.2 文件上传安全

- [ ] 仅接受 JPG/PNG/GIF 格式
- [ ] 文件大小 ≤ 5MB
- [ ] 上传的文件存储在 uploads/ 目录，能通过 URL 访问
- [ ] 文件名重新生成（使用 UUID 或时间戳），不使用原始文件名避免路径遍历
- [ ] 上传目录 uploads/ 存在且有写入权限
- [ ] 数据目录 data/ 存在且有写入权限

---

## 六、集成测试验证

- [ ] 完整流程脚本可自动执行：注册 → 添加孩子 → 发布任务 → 提交成果 → 验收（通过）→ 查看积分 → **手动加积分（上传凭证照片）** → 发布商品 → **兑换商品（立即扣积分+库存）** → **查看成长相册（任务照片+奖惩任务凭证照片）** → 查看时间线 → 切换孩子 → 重复
- [ ] 脚本执行完成后数据库数据一致、无错误
- [ ] `go test ./...` 全部通过
- [ ] 核心 Service 层测试覆盖率 ≥ 70%
- [ ] 无未处理的 panic 或 500 错误在正常流程中出现

---

## 七、部署验证

- [ ] README 中包含清晰的后端启动步骤
- [ ] README 中包含清晰的前端启动步骤
- [ ] README 中包含环境变量说明（JWT_SECRET, DB_PATH, UPLOAD_DIR, PORT）
- [ ] 构建脚本存在且可执行
- [ ] 在全新环境中按 README 能成功启动并注册第一个用户
- [ ] 上传目录 uploads/ 存在且有写入权限
- [ ] 数据目录 data/ 存在且有写入权限
