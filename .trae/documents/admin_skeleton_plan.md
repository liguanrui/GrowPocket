# GrowPocket 后端管理后台 Admin 骨架实现计划

## 一、项目背景与目标

为 GrowPocket 后端新增独立的管理后台（admin）基础骨架，与家长端 JWT 体系完全隔离，支持管理员登录、权限控制（super_admin/admin/viewer 三级角色）、管理员 CRUD、操作日志审计等基础能力，确保 `go build` 通过。

## 二、代码风格约定（基于现有代码分析）

- **模块名**: `growpocket`（go.mod 中定义）
- **模型定义**: `internal/model/` 下，GORM tags + JSON tags，常量定义角色枚举
- **中间件**: `internal/middleware/` 下，gin.HandlerFunc 返回，contextKey 类型作 key
- **Service 层**: `internal/service/` 下，NewXxxService() 构造函数，结构体方法封装业务
- **Handler 层**: `internal/handler/` 下，NewXxxHandler(cfg) 构造，BindJSON + 调 service + util.OK/Fail
- **统一响应**: `pkg/util/response.go` 提供 OK / FailBadRequest / FailUnauthorized / FailForbidden / FailNotFound / FailInternal
- **密码哈希**: `pkg/util/password.go` 用 bcrypt（HashPassword / CheckPassword）
- **JWT**: `pkg/util/jwt.go` 用 github.com/golang-jwt/jwt/v5，HS256，RegisteredClaims
- **配置**: `internal/config/config.go` 通过 getEnv / getEnvInt 读取 env，给默认值
- **路由注册**: `cmd/main.go` 中 public / authorized 两个 Group，admin 新增 adminPublic / adminAuthorized 组
- **分页**: `pkg/util/pagination.go` 已提供 GetPagination + PaginatedResponse，直接复用

## 三、实现步骤与文件变更清单

### 步骤 1：新增模型 `internal/model/admin.go`
**新建文件**，包含：
1. **角色常量**：`AdminRoleSuperAdmin = "super_admin"` / `AdminRoleAdmin = "admin"` / `AdminRoleViewer = "viewer"`
2. **AdminUser 表**：
   - ID (primaryKey)
   - Username (size:50, uniqueIndex, not null)
   - Password (size:255, json:"-")
   - Nickname (size:50)
   - Role (size:20, default:"admin", index)
   - IsActive (default:true)
   - LastLoginAt (*time.Time)
   - LastLoginIP (size:50)
   - CreatedAt / UpdatedAt
3. **AdminOperationLog 表**：
   - ID (primaryKey)
   - AdminID (uint, index)
   - AdminName (size:50)
   - Action (size:100, index)
   - TargetType (size:50)
   - TargetID (uint)
   - Detail (type:text，存 JSON 字符串)
   - IP (size:50)
   - UserAgent (size:500)
   - CreatedAt (index)

---

### 步骤 2：扩展 `pkg/util/jwt.go` 新增 Admin JWT 独立体系
**修改现有文件**（不修改原有 JWTClaims/GenerateJWT/ParseJWT），新增：
1. `AdminJWTClaims` 结构体：`AdminID uint` + `Username string` + `Role string` + `jwt.RegisteredClaims`
2. `GenerateAdminJWT(adminID uint, username, role, secret string, durationHour int) (string, error)`
3. `ParseAdminJWT(tokenStr, secret string) (*AdminJWTClaims, error)`

Issuer 统一用 `"growpocket-admin"` 与家长端区分。

---

### 步骤 3：新增中间件 `internal/middleware/admin_jwt.go`
**新建文件**，参考 `jwt.go` 风格：
1. **contextKey 常量**：`AdminUserIDKey` / `AdminUsernameKey` / `AdminRoleKey`
2. `AdminJWTAuth(adminSecret string) gin.HandlerFunc`：
   - 从 `Authorization: Bearer xxx` 取 token
   - 调 `util.ParseAdminJWT` 解析
   - Set 到 context（AdminUserIDKey=uint, AdminUsernameKey=string, AdminRoleKey=string）
   - 失败则 `util.FailUnauthorized` + `c.Abort()`
3. `RequireAdminRole(roles ...string) gin.HandlerFunc`：
   - 从 context 取 AdminRoleKey
   - 不在白名单内则 `util.FailForbidden` + `c.Abort()`
4. **辅助函数**：`GetAdminUserID(c) uint` / `GetAdminUsername(c) string` / `GetAdminRole(c) string`

---

### 步骤 4：新增 Service `internal/service/admin_service.go`
**新建文件**，核心结构体 `AdminAuthService`：
1. `NewAdminAuthService(cfg *config.Config) *AdminAuthService`：保存 cfg，bcrypt cost=12（后续 HashPassword 时若现有 util 默认是 DefaultCost=10，则在 service 层单独用 bcrypt.GenerateFromPassword with cost=12，或修改 util.HashPassword 支持自定义 cost → **方案**：在 service 内部直接调用 bcrypt，不修改现有 util 以保持兼容）
2. `Login(username, password, clientIP string) (*model.AdminUser, string, error)`：
   - 按 username 查 DB
   - bcrypt 校验密码
   - 检查 `IsActive == true`
   - 更新 `LastLoginAt` 和 `LastLoginIP = clientIP`
   - 调 `util.GenerateAdminJWT` 生成 token 返回
3. `ChangePassword(adminID uint, oldPwd, newPwd string) error`：
   - 查 admin 记录
   - 校验旧密码
   - 新密码 bcrypt 哈希后更新
4. `ListAdmins() ([]model.AdminUser, error)`：返回所有管理员（按 ID 升序）
5. `CreateAdmin(u *model.AdminUser, password string) error`：
   - Username 唯一性检查
   - Password bcrypt 哈希后写入 u.Password
   - Create 到 DB
6. `UpdateAdmin(id uint, u *model.AdminUser) error`：只更新 Nickname / Role / IsActive（不改 Password）
7. `DeleteAdmin(id uint) error`：软删除？不，直接 Delete（AdminUser 没 DeletedAt 字段，硬删）
8. `SeedInitialSuperAdmin(initPassword string) error`：
   - `SELECT COUNT(*) FROM admin_users`，若 > 0 直接返回
   - 若 `initPassword == ""`：用 `crypto/rand` 生成 16 位随机密码（字母+数字），`log.Warnf` 输出：`"首次启动自动生成超级管理员临时密码: admin / %s ，请登录后立即修改"`
   - 否则用 initPassword
   - 插入：Username="admin", Role=AdminRoleSuperAdmin, Nickname="超级管理员", IsActive=true, Password=bcrypt hash
9. `RecordOperationLog(adminID uint, adminName, action, targetType string, targetID uint, detail, ip, userAgent string)`：
   - 构造 AdminOperationLog，Create 到 DB（异步 or 同步？**同步**，简单可靠，失败只 log 不 panic）

---

### 步骤 5：新增 Handler `internal/handler/admin_handler.go`
**新建文件**，参考 `auth.go` 风格：

#### 构造函数
- `NewAdminAuthHandler(cfg *config.Config) *AdminAuthHandler`：内部初始化 AdminAuthService
- `NewAdminHandler() *AdminHandler`：管理员 CRUD + 日志查询的 handler（也可合并为一个 AdminHandler，简化设计 → **方案**：合并为单个 `AdminHandler`，`NewAdminHandler(cfg)`，减少文件数）

**最终方案**：单个 `AdminHandler` 结构体，带 `cfg` 和 `service *service.AdminAuthService`，一个构造函数 `NewAdminHandler(cfg *config.Config)`。

#### Handler 方法
1. **Login(c)**：
   - BindJSON: `{Username string, Password string}`
   - 调 `service.Login(username, password, c.ClientIP())`
   - 成功后异步/同步调 `service.RecordOperationLog(adminID, adminName, "admin.auth.login", "", 0, "", c.ClientIP(), c.Request.UserAgent())`
   - 返回 `util.OK(c, gin.H{"token": token, "admin": {...}})`（admin 不含 password）
2. **Refresh(c)**：
   - 用 AdminJWTAuth 已解析的 claims → 取 GetAdminUserID/GetAdminUsername/GetAdminRole
   - 重新签发新 token（有效期重置）
   - 返回 `{"token": newToken}`
3. **Me(c)**：
   - GetAdminUserID 查 DB
   - 返回 admin 信息（不含 password）
4. **ChangePassword(c)**：
   - BindJSON: `{OldPassword string, NewPassword string}`
   - 调 service.ChangePassword
   - 记录日志 action="admin.auth.change_password"
5. **ListAdmins(c)**：
   - 需要 `RequireAdminRole(AdminRoleSuperAdmin)`
   - service.ListAdmins 返回
6. **CreateAdmin(c)**：
   - super_admin 专属
   - BindJSON: `{Username, Nickname, Role, Password, IsActive}`
   - 校验 Password 长度 >= 8，否则 FailBadRequest
   - Username 长度 2-50
   - 调 service.CreateAdmin
   - 记录日志 action="admin.user.create", targetType="admin_user", targetID=newID, detail=JSON
7. **UpdateAdmin(c)**：
   - super_admin 专属
   - URL param `:id`
   - BindJSON 允许更新的字段
   - 调 service.UpdateAdmin
   - 记录日志
8. **DeleteAdmin(c)**：
   - super_admin 专属
   - URL param `:id`
   - 调 service.DeleteAdmin（禁止删除自己，加判断：id == GetAdminUserID → FailBadRequest）
   - 记录日志
9. **ListOperationLogs(c)**：
   - 登录即可访问（所有管理员）
   - 分页用 `util.GetPagination(c)`
   - 可选筛选：`admin_id` (query uint) / `action` (query string) / `date_from` (query YYYY-MM-DD) / `date_to` (query YYYY-MM-DD)
   - 按 created_at DESC
   - 返回 PaginatedResponse

---

### 步骤 6：修改 `internal/config/config.go`
**修改现有文件**的 `Config` 结构体和 `Load()`：

新增字段：
```go
AdminJWTSecret     string  // env: ADMIN_JWT_SECRET, default: "growpocket-admin-secret-change-in-production"
AdminJWTExpireHour int     // env: ADMIN_JWT_EXPIRE_HOUR, default: 8
AdminInitPassword  string  // env: ADMIN_INIT_PASSWORD, default: ""
```

Load() 中加载完后，**若 AdminJWTSecret 是默认值**，`log.Warnf("警告: ADMIN_JWT_SECRET 使用默认值，生产环境不安全，请设置环境变量")`。

---

### 步骤 7：修改 `internal/database/database.go`
**修改现有文件**的 `Init()` 函数中 `AutoMigrate` 列表，在最后追加：
```go
&model.AdminUser{},
&model.AdminOperationLog{},
```

---

### 步骤 8：修改 `cmd/main.go`
**修改现有文件**，按现有结构新增路由：

1. 在 `authorized` 路由组结束 `}` 之后，新增：
```go
// === 管理后台 Admin 路由 ===
adminService := service.NewAdminAuthService(cfg)
adminHandler := handler.NewAdminHandler(cfg).WithService(adminService)

// admin 公开路由（无需登录）
adminPublic := r.Group("/api/admin")
{
    adminPublic.POST("/auth/login", adminHandler.Login)
}

// admin 需登录路由
adminAuthorized := r.Group("/api/admin")
adminAuthorized.Use(middleware.AdminJWTAuth(cfg.AdminJWTSecret))
{
    // 认证相关
    adminAuthorized.POST("/auth/refresh", adminHandler.Refresh)
    adminAuthorized.GET("/auth/me", adminHandler.Me)
    adminAuthorized.PUT("/auth/password", adminHandler.ChangePassword)

    // 管理员管理（super_admin 专属）
    adminUsers := adminAuthorized.Group("/users")
    adminUsers.Use(middleware.RequireAdminRole(model.AdminRoleSuperAdmin))
    {
        adminUsers.GET("", adminHandler.ListAdmins)
        adminUsers.POST("", adminHandler.CreateAdmin)
        adminUsers.PUT("/:id", adminHandler.UpdateAdmin)
        adminUsers.DELETE("/:id", adminHandler.DeleteAdmin)
    }

    // 系统日志
    adminAuthorized.GET("/system/logs", adminHandler.ListOperationLogs)

    // TODO 阶段 2: 用户管理 /api/admin/users（家长端用户）
    // TODO 阶段 2: 任务模板管理 /api/admin/task-templates
    // TODO 阶段 2: 内容审核 /api/admin/moderation/*
    // TODO 阶段 3: 数据统计 /api/admin/stats/*
    // TODO 阶段 3: 公益项目 /api/admin/charity/*
    // TODO 阶段 3: 系统配置 /api/admin/settings
}
```

2. 在 `r.Run(":" + cfg.Port)` **之前**（即路由注册完之后），调用：
```go
// 初始化超级管理员（空库时自动创建）
if err := adminService.SeedInitialSuperAdmin(cfg.AdminInitPassword); err != nil {
    log.Fatalf("初始化超级管理员失败: %v", err)
}
```

---

### 步骤 9：确认 `pkg/util/response.go` 的 FailForbidden
经检查，`response.go:43-45` **已存在** `FailForbidden`，无需修改。此步骤跳过。

---

### 步骤 10：编译验证
执行：
```bash
cd /Users/Admin1/Workhome/GrowPocket/backend
go build ./cmd/main.go
```
如有编译错误，迭代修复直至通过。

## 四、关键设计决策

| 决策项 | 选择 | 理由 |
|---|---|---|
| Admin JWT 与家长端是否隔离 | 完全隔离（独立 Claims/Generate/Parse + 独立 Secret） | 安全隔离，避免 token 跨体系误用 |
| Admin 密码 bcrypt cost | cost=12（家长端 util 默认 cost=10） | 管理员账号更敏感，强度更高；在 service 层直接调用 bcrypt，不修改现有 util 保持兼容 |
| Handler 是否分 AdminAuthHandler / AdminHandler | 合并为一个 AdminHandler | 文件更少，阶段 1 接口不多 |
| 删除管理员是否允许删自己 | 禁止 | 防止误操作锁死 super_admin |
| 操作日志写入方式 | 同步写入（失败仅 log） | 阶段 1 简单优先，后续可改异步队列 |
| SeedInitialSuperAdmin 何时调用 | main.go 中 r.Run 之前 | 确保服务启动前 admin 账号可用 |

## 五、风险与注意事项

1. **AdminUser.Username 唯一索引**：SQLite 下 AutoMigrate 会创建 unique index，重复 username 会返回错误，service 层需显式检查并给出友好提示
2. **bcrypt cost=12**：比 DefaultCost=10 慢约 4 倍，管理员登录频率低可接受
3. **SeedInitialSuperAdmin 的随机密码**：仅在 initPassword 为空且表空时生成，log.Warnf 输出到 stderr，部署时需留意日志
4. **删除管理员时的外键**：AdminOperationLog.AdminID 无外键约束（没加 foreignKey tag），删除 admin 后日志保留但关联 admin_id 失效，可接受（保留审计痕迹）
