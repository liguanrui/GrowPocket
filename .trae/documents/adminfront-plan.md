# GrowPocket 管理后台（adminfront）建设方案

---

## 一、项目现状分析

### 1.1 现有技术栈

**前端（frontend）**：
- 框架：React 18 + TypeScript
- 构建工具：Vite 6
- 样式：Tailwind CSS 3 + PostCSS
- 状态管理：Zustand 5
- 路由：React Router DOM 7
- 数据请求：Axios
- 图表：Recharts
- 图标：Lucide React
- 测试：Vitest + Playwright

**后端（backend）**：
- 框架：Go 1.22 + Gin
- ORM：GORM + SQLite（WAL 模式，单连接）
- 认证：JWT（golang-jwt/jwt/v5）
- 项目结构：cmd / internal(config, database, handler, middleware, model, service, util) / pkg

**部署**：
- Nginx 反向代理（frontend 静态文件 + /api 转发到 Go 后端）
- systemd 服务管理

### 1.2 现有权限模型

当前 `User` 表只有 2 种角色：
- `parent`：家长（可登录，有密码）
- `child`：孩子档案（不可登录，无密码）

**缺失**：`admin` 超级管理员角色，无法进行全局数据管理、运营配置、内容审核等操作。

### 1.3 现有数据模型（32 张表）

核心业务表：用户/家庭、任务/模板/循环任务、积分/交易流水、兑换商城、成长周期/成长故事、能力维度、成就勋章、大师挑战、学业里程碑、社区分享、公益项目/活动、习惯库、问卷、AI 对话。

---

## 二、GitHub 主流管理后台方案对比与推荐

### 2.1 方案调研

| 方案 | 技术栈 | Stars | 特点 | 与本项目契合度 |
|------|--------|-------|------|----------------|
| **Ant Design Pro** (ant-design/ant-design-pro) | React + TS + Umi + Ant Design + Dva | 36.4k | 阿里出品，企业级，开箱即用，内置 ProComponents（表格/表单/布局），权限/国际化/请求库完整 | 中：组件库是 Ant Design，不是 Tailwind；需要两套 UI 体系 |
| **backend-admin-template** | React 19 + TS + Vite + React Router + Zustand + JWT + ShadcnUI + Tailwind | 较新 | 与本项目技术栈高度一致（Zustand+JWT+Tailwind），权限用 Zustand 管理 | 极高：技术栈几乎完全匹配 |
| **Art-Design-Pro** (Daymychen/art-design-pro) | React + TS + Vite + Shadcn + Tailwind | UI 漂亮 | 设计精美，浅色/暗黑主题，图表组件丰富 | 高：Tailwind 体系，UI 品质高 |
| **shadcn/ui Dashboard** (多个衍生模板) | React + TS + Vite + Shadcn + Tailwind | 生态丰富 | 组件按需复制到项目，完全可定制，不依赖 npm 包 | 高：灵活，与 Tailwind 无缝集成 |
| **Berry Dashboard** | React + Material-UI | 开源免费 | 基于 Material Design，组件完整 | 低：MUI 体系，与 Tailwind 不兼容 |
| **CoreUI Free React** | React + Bootstrap | 老牌 | Bootstrap 风格，组件稳定 | 低：风格与现有项目不一致 |

### 2.2 推荐方案

**推荐：基于 Vite + React + TypeScript + Tailwind CSS + Zustand 自建 + 引入 shadcn/ui 组件库**

理由：
1. **技术栈一致性**：与现有 frontend 完全一致（React 18+ / TS / Vite / Tailwind / Zustand / Axios / React Router），降低团队维护成本
2. **shadcn/ui 优势**：
   - 基于 Radix UI + Tailwind，无障碍访问好
   - 不是 npm 包，而是直接把组件代码复制到项目里，100% 可定制
   - GitHub 108k+ Stars，社区活跃，生态丰富
   - 自带 Table、Form、Dialog、Select、DatePicker 等管理后台高频组件
3. **不引入 Ant Design Pro**：避免同时维护 Ant Design + Tailwind 两套样式体系
4. **图表**：沿用现有项目的 Recharts，降低学习成本
5. **权限系统**：沿用 JWT + Zustand，与现有 JWT 中间件无缝对接

---

## 三、管理后台功能模块规划

### 3.1 权限等级设计

| 角色 | 说明 | 可访问范围 |
|------|------|------------|
| `super_admin` | 超级管理员（1 名，系统预置） | 全部功能，包括管理员管理、系统配置 |
| `admin` | 运营管理员 | 数据概览、用户管理、内容管理、配置管理、审核中心 |
| `viewer` | 只读访客（可选） | 仅数据概览和列表查看，无修改权限 |

### 3.2 功能模块清单

#### 模块 A：登录与权限
- 管理员登录（独立登录页，与家长端分离）
- 个人中心（修改密码、查看操作日志）
- 管理员管理（仅 super_admin：增删改查管理员、分配角色）
- 操作日志审计

#### 模块 B：数据概览 Dashboard
- 总览卡片：注册家庭数、孩子总数、今日活跃任务数、今日积分发放量
- 趋势图：近 30 天注册趋势、任务完成率趋势、积分发放/消耗趋势
- 能力维度雷达图（全平台平均 vs 年级分布）
- 热门任务 Top10、热门兑换商品 Top10
- 年级分布饼图、任务分类分布饼图

#### 模块 C：用户与家庭管理
- 家庭列表（搜索、筛选、查看详情、禁用/启用家庭）
- 家长账号管理（查看、重置密码、禁用）
- 孩子档案管理（查看详情、能力维度、积分余额、成长记录）
- 家庭下任务/兑换/成长记录全量查看

#### 模块 D：任务与内容管理
- 任务列表（全平台任务，按状态/分类/AI生成筛选，支持删除违规任务）
- 系统任务模板管理（预置模板 CRUD，标记 is_system=true）
- 主题任务（父任务）模板管理
- 习惯库管理（预置习惯 CRUD）
- 大师挑战模板管理（CRUD 预置模板）

#### 模块 E：兑换商城管理
- 全平台兑换商品列表（按家庭筛选）
- 兑换订单审核（可选：新增人工审核机制）
- 商品违规下架

#### 模块 F：成就与能力配置
- 系统预置勋章管理（CRUD，标记 FamilyID=0）
- 能力维度配置（6 大维度元数据、年级引导表 grade_dimension_guide）
- 分龄维度权重 / 分数上限配置

#### 模块 G：问卷与学业配置
- 问卷题库管理（按 stage 分档的题目 CRUD）
- 学业里程碑规则配置（月度上限、单次上限等）

#### 模块 H：公益与社区
- 公益项目 CRUD
- 公益活动审核/管理
- 社区分享审核（删除违规内容、禁言用户）

#### 模块 I：AI 与系统配置
- AI 服务配置（API Key 加密管理、模型选择、调用限额查看）
- AI 任务生成监控（今日生成量、失败率、幂等检查日志）
- 成长故事生成监控
- 系统参数配置（环境变量级别的开关，是否需要重启生效）

#### 模块 J：审核中心
- 待审核任务成果图
- 待审核社区分享
- 待审核大师挑战提交
- 一键通过 / 批量拒绝

---

## 四、后端 API 改造方案

### 4.1 数据库新增

#### （1）管理员表 `admin_user`
```go
type AdminUser struct {
    ID           uint      `gorm:"primaryKey"`
    Username     string    `gorm:"size:50;uniqueIndex;not null"` // 登录名
    Password     string    `gorm:"size:255;not null"`            // bcrypt 哈希
    Nickname     string    `gorm:"size:50"`
    Role         string    `gorm:"size:20;not null;default:'admin'"` // super_admin / admin / viewer
    IsActive     bool      `gorm:"default:true"`
    LastLoginAt  *time.Time
    LastLoginIP  string    `gorm:"size:50"`
    CreatedAt    time.Time
    UpdatedAt    time.Time
}
```

#### （2）操作日志表 `admin_operation_log`
```go
type AdminOperationLog struct {
    ID         uint      `gorm:"primaryKey"`
    AdminID    uint      `gorm:"index;not null"`
    AdminName  string    `gorm:"size:50"`
    Action     string    `gorm:"size:100;not null"` // e.g. "user.delete", "task_template.update"
    TargetType string    `gorm:"size:50"`           // e.g. "family", "task"
    TargetID   uint
    Detail     string    `gorm:"type:text"`          // JSON 详情
    IP         string    `gorm:"size:50"`
    UserAgent  string    `gorm:"size:500"`
    CreatedAt  time.Time `gorm:"index"`
}
```

#### （3）User 表新增 role 扩展
在现有 `RoleParent/RoleChild` 基础上 **不直接混合 admin**，避免污染家长端数据范围。管理员账号独立用 `admin_user` 表，与业务用户完全隔离。

### 4.2 JWT 认证扩展

现有 `JWTClaims` 增加 `AdminID` 字段（或用单独的 Admin JWT）。**推荐：独立 Admin JWT**，避免 token 混用导致越权。

```go
type AdminJWTClaims struct {
    AdminID   uint   `json:"admin_id"`
    Username  string `json:"username"`
    Role      string `json:"role"` // super_admin / admin / viewer
    jwt.RegisteredClaims
}
```

### 4.3 路由组划分（main.go）

```go
// === 现有家长端路由（保持不变） ===
public := r.Group("/api")
authorized := r.Group("/api")
authorized.Use(middleware.JWTAuth(cfg.JWTSecret))

// === 新增管理后台路由组 ===
adminPublic := r.Group("/api/admin")
{
    adminAuthHandler := handler.NewAdminAuthHandler(cfg)
    adminPublic.POST("/auth/login", adminAuthHandler.Login)
    adminPublic.POST("/auth/refresh", adminAuthHandler.Refresh) // token 刷新
}

adminAuthorized := r.Group("/api/admin")
adminAuthorized.Use(middleware.AdminJWTAuth(cfg.AdminJWTSecret))
{
    // --- 模块 A：管理员与个人中心 ---
    adminHandler := handler.NewAdminHandler()
    adminAuthorized.GET("/auth/me", adminHandler.Me)
    adminAuthorized.PUT("/auth/password", adminHandler.ChangePassword)

    // super_admin 专属
    sa := adminAuthorized.Group("")
    sa.Use(middleware.RequireAdminRole("super_admin"))
    {
        sa.GET("/users", adminHandler.ListAdmins)
        sa.POST("/users", adminHandler.CreateAdmin)
        sa.PUT("/users/:id", adminHandler.UpdateAdmin)
        sa.DELETE("/users/:id", adminHandler.DeleteAdmin)
    }

    // --- 模块 B：Dashboard ---
    dashHandler := handler.NewAdminDashboardHandler()
    adminAuthorized.GET("/dashboard/stats", dashHandler.GetOverview)
    adminAuthorized.GET("/dashboard/trends", dashHandler.GetTrends)
    adminAuthorized.GET("/dashboard/ability-radar", dashHandler.GetAbilityRadar)

    // --- 模块 C：用户与家庭管理 ---
    familyAdminHandler := handler.NewAdminFamilyHandler()
    adminAuthorized.GET("/families", familyAdminHandler.ListFamilies)
    adminAuthorized.GET("/families/:id", familyAdminHandler.GetFamilyDetail)
    adminAuthorized.PUT("/families/:id/status", familyAdminHandler.ToggleFamilyStatus)
    adminAuthorized.GET("/children", familyAdminHandler.ListChildren)
    adminAuthorized.GET("/children/:id", familyAdminHandler.GetChildDetail)

    // --- 模块 D：任务与内容 ---
    taskAdminHandler := handler.NewAdminTaskHandler()
    adminAuthorized.GET("/tasks", taskAdminHandler.ListAllTasks)         // 分页+筛选
    adminAuthorized.DELETE("/tasks/:id", taskAdminHandler.DeleteTask)    // 删除违规
    adminAuthorized.GET("/task-templates/system", taskAdminHandler.ListSystemTemplates)
    adminAuthorized.POST("/task-templates/system", taskAdminHandler.CreateSystemTemplate)
    adminAuthorized.PUT("/task-templates/system/:id", taskAdminHandler.UpdateSystemTemplate)
    adminAuthorized.DELETE("/task-templates/system/:id", taskAdminHandler.DeleteSystemTemplate)

    // --- 模块 E：兑换商城 ---
    redeemAdminHandler := handler.NewAdminRedeemHandler()
    adminAuthorized.GET("/redeem/items", redeemAdminHandler.ListAllItems)
    adminAuthorized.PUT("/redeem/items/:id/status", redeemAdminHandler.ToggleItemStatus)
    adminAuthorized.GET("/redeems", redeemAdminHandler.ListAllRedeems)

    // --- 模块 F：成就与能力 ---
    abilityAdminHandler := handler.NewAdminAbilityHandler()
    adminAuthorized.GET("/achievements/system", abilityAdminHandler.ListSystemAchievements)
    adminAuthorized.POST("/achievements/system", abilityAdminHandler.CreateSystemAchievement)
    adminAuthorized.PUT("/achievements/system/:id", abilityAdminHandler.UpdateSystemAchievement)
    adminAuthorized.DELETE("/achievements/system/:id", abilityAdminHandler.DeleteSystemAchievement)
    adminAuthorized.GET("/ability-dimensions", abilityAdminHandler.ListDimensions)
    adminAuthorized.PUT("/ability-dimensions/:id", abilityAdminHandler.UpdateDimension)
    adminAuthorized.GET("/grade-guides", abilityAdminHandler.ListGradeGuides)
    adminAuthorized.PUT("/grade-guides/:id", abilityAdminHandler.UpdateGradeGuide)

    // --- 模块 G：问卷 ---
    questionnaireAdminHandler := handler.NewAdminQuestionnaireHandler()
    adminAuthorized.GET("/questionnaires", questionnaireAdminHandler.ListAll)
    adminAuthorized.POST("/questionnaires", questionnaireAdminHandler.Create)
    adminAuthorized.PUT("/questionnaires/:id", questionnaireAdminHandler.Update)
    adminAuthorized.DELETE("/questionnaires/:id", questionnaireAdminHandler.Delete)

    // --- 模块 H：社区与公益 ---
    communityAdminHandler := handler.NewAdminCommunityHandler()
    adminAuthorized.GET("/community/shares", communityAdminHandler.ListShares)
    adminAuthorized.DELETE("/community/shares/:id", communityAdminHandler.DeleteShare)
    adminAuthorized.GET("/community/charity-projects", communityAdminHandler.ListProjects)
    adminAuthorized.POST("/community/charity-projects", communityAdminHandler.CreateProject)
    adminAuthorized.PUT("/community/charity-projects/:id", communityAdminHandler.UpdateProject)
    adminAuthorized.DELETE("/community/charity-projects/:id", communityAdminHandler.DeleteProject)

    // --- 模块 I：AI 与系统配置 ---
    systemAdminHandler := handler.NewAdminSystemHandler()
    adminAuthorized.GET("/system/ai-usage", systemAdminHandler.GetAIUsage)
    adminAuthorized.GET("/system/configs", systemAdminHandler.ListConfigs)
    adminAuthorized.PUT("/system/configs/:key", systemAdminHandler.UpdateConfig)
    adminAuthorized.GET("/system/logs", systemAdminHandler.ListOperationLogs)
}
```

### 4.4 新增中间件

```go
// AdminJWTAuth: 管理员 JWT 校验（独立 secret）
func AdminJWTAuth(adminSecret string) gin.HandlerFunc { ... }

// RequireAdminRole: 角色守卫（链式调用）
func RequireAdminRole(roles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        role := GetAdminRole(c)
        for _, allowed := range roles {
            if role == allowed { c.Next(); return }
        }
        util.FailForbidden(c, "无权限执行该操作")
        c.Abort()
    }
}
```

### 4.5 Service 层扩展

为每个 AdminHandler 编写对应的 `AdminXXXService`，核心是**跨家庭数据查询**（现有 service 大多按 `FamilyID` 过滤，管理后台需要解除过滤并支持全局搜索）。

关键安全点：
- 所有写操作必须记录 `AdminOperationLog`（GORM AfterCreate/AfterUpdate/AfterDelete hook 或手动调用）
- 删除操作默认软删除（可在现有模型加 `DeletedAt`，现有没加则用硬删除+日志兜底）
- 敏感字段（AI API Key）返回时脱敏，写入时加密存储

### 4.6 数据库迁移

`database.Init` 时新增 `AutoMigrate`：
```go
db.AutoMigrate(&model.AdminUser{}, &model.AdminOperationLog{})
```
并在首次启动时 seed 一个默认 super_admin（用户名 `admin`，密码从环境变量 `ADMIN_INIT_PASSWORD` 读取，未设置则随机生成并打印日志）。

---

## 五、前端 adminfront 项目结构

### 5.1 目录结构

```
GrowPocket/
├── frontend/              # 现有家长端（保持不变）
├── adminfront/            # 新增：管理后台
│   ├── public/
│   │   └── favicon-admin.svg
│   ├── src/
│   │   ├── api/           # 接口请求（按模块拆分）
│   │   │   ├── auth.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── family.ts
│   │   │   ├── task.ts
│   │   │   ├── redeem.ts
│   │   │   ├── ability.ts
│   │   │   ├── questionnaire.ts
│   │   │   ├── community.ts
│   │   │   └── system.ts
│   │   ├── components/    # 通用组件
│   │   │   ├── layout/           # 后台布局（Sidebar + Header + Content）
│   │   │   │   ├── AdminLayout.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   ├── ui/               # shadcn/ui 组件
│   │   │   │   ├── table.tsx
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── form.tsx
│   │   │   │   ├── date-picker.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── avatar.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── checkbox.tsx
│   │   │   │   └── pagination.tsx
│   │   │   ├── DataTable.tsx     # 封装好的分页表格
│   │   │   ├── StatusBadge.tsx   # 通用状态徽章
│   │   │   └── ProtectedRoute.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── admin/
│   │   │   │   ├── AdminListPage.tsx
│   │   │   │   └── AdminCreatePage.tsx
│   │   │   ├── family/
│   │   │   │   ├── FamilyListPage.tsx
│   │   │   │   └── FamilyDetailPage.tsx
│   │   │   ├── child/
│   │   │   │   ├── ChildListPage.tsx
│   │   │   │   └── ChildDetailPage.tsx
│   │   │   ├── task/
│   │   │   │   ├── TaskListPage.tsx
│   │   │   │   └── SystemTemplatePage.tsx
│   │   │   ├── redeem/
│   │   │   │   ├── ItemListPage.tsx
│   │   │   │   └── RedeemOrderPage.tsx
│   │   │   ├── ability/
│   │   │   │   ├── AchievementPage.tsx
│   │   │   │   ├── DimensionPage.tsx
│   │   │   │   └── GradeGuidePage.tsx
│   │   │   ├── questionnaire/
│   │   │   │   └── QuestionnairePage.tsx
│   │   │   ├── community/
│   │   │   │   ├── ShareModerationPage.tsx
│   │   │   │   ├── CharityProjectPage.tsx
│   │   │   │   └── ActivityPage.tsx
│   │   │   └── system/
│   │   │       ├── AIUsagePage.tsx
│   │   │       ├── ConfigPage.tsx
│   │   │       └── OperationLogPage.tsx
│   │   ├── stores/
│   │   │   ├── adminAuthStore.ts   # Zustand：管理员登录态
│   │   │   └── adminUIStore.ts     # Zustand：侧边栏折叠、主题等
│   │   ├── hooks/
│   │   │   ├── useAdminAuth.ts
│   │   │   └── useDataTable.ts     # 分页/筛选/排序 hook
│   │   ├── lib/
│   │   │   ├── axios.ts            # axios 实例（baseURL=/api/admin，拦截器）
│   │   │   └── utils.ts
│   │   ├── types/
│   │   │   └── index.ts            # 类型定义
│   │   ├── router/
│   │   │   └── index.tsx           # 路由表（按角色动态过滤菜单）
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css               # Tailwind + shadcn 主题变量
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── components.json             # shadcn/ui 配置
│   └── eslint.config.js
├── backend/               # 保持不变（内部新增 admin handler/service/model）
└── deploy/
    └── nginx/
        └── growpocket.conf  # 需更新
```

### 5.2 package.json 核心依赖

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.18.0",
    "zustand": "^5.0.14",
    "axios": "^1.18.0",
    "recharts": "^3.8.1",
    "lucide-react": "^0.511.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.2",
    "dayjs": "^1.11.13",
    "@hookform/resolvers": "^3.9.0",
    "react-hook-form": "^7.53.0",
    "zod": "^3.23.8",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-checkbox": "^1.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-badge": "^1.1.2",
    "@radix-ui/react-pagination": "^1.1.4",
    "@radix-ui/react-date-picker": "^1.1.4",
    "class-variance-authority": "^0.7.0",
    "cmdk": "^1.0.0",
    "date-fns": "^4.1.0",
    "react-day-picker": "^8.10.1",
    "vaul": "^1.1.0"
  },
  "devDependencies": {
    "typescript": "~5.8.3",
    "vite": "^6.3.5",
    "@vitejs/plugin-react": "^4.4.1",
    "tailwindcss": "^3.4.19",
    "postcss": "^8.5.3",
    "autoprefixer": "^10.4.21",
    "@tailwindcss/vite": "^4.3.1"
  }
}
```

### 5.3 关键页面交互设计

**登录页**：用户名 + 密码 + 图形验证码（可选），失败 5 次锁定 10 分钟。

**Dashboard**：
- 顶部 4 张统计卡片（今日/累计）
- 左栏：注册趋势折线图 + 任务分类饼图
- 右栏：积分发放/消耗双折线图 + 热门任务 Top10 条形图
- 底部：能力维度平均雷达图

**通用列表页（DataTable）**：
- 顶部：搜索框 + 筛选条件组 + 新建/批量操作按钮
- 中部：shadcn Table（支持列排序、列显示配置）
- 底部：分页器

**详情页（抽屉或新页）**：
- 标签页切换：基本信息 / 关联任务 / 积分记录 / 成长记录 / 操作日志

---

## 六、部署与 Nginx 配置更新

### 6.1 目录结构

```
/opt/growpocket/
├── frontend/       # 家长端（保持不变）
├── adminfront/     # 新增：管理后台 build 产物
└── backend/        # 保持不变
```

### 6.2 Nginx 配置更新（growpocket.conf）

```nginx
server {
    listen 80;
    server_name _;

    # === 管理后台（独立二级路径，避免与家长端路由冲突）===
    # 访问方式：http://domain/admin/
    location /admin/ {
        alias /opt/growpocket/adminfront/;
        index index.html;
        try_files $uri $uri/ /admin/index.html;

        # 管理后台安全加固：限制可访问 IP（可选，生产环境建议开启）
        # allow 192.168.1.0/24;
        # deny all;
    }

    # === 家长端（保持不变）===
    location / {
        root /opt/growpocket/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # === API（增加 /api/admin 透传，已被 /api/ 统一包含，无需额外配置）===
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # 管理后台登录接口单独加限流（可选）
        limit_req zone=admin_login burst=5 nodelay;
    }

    location /uploads/ {
        alias /opt/growpocket/backend/uploads/;
        expires 7d;
    }
}
```

### 6.3 构建与部署脚本更新

`deploy/deploy.sh` 增加 adminfront 构建步骤：
```bash
# 构建管理后台
cd $PROJECT_DIR/adminfront
npm ci
npm run build
rm -rf /opt/growpocket/adminfront
cp -r dist /opt/growpocket/adminfront
```

### 6.4 环境变量新增（.env）

```bash
# 管理后台 JWT 独立 secret（与家长端分离）
ADMIN_JWT_SECRET=your_admin_jwt_secret_here
# 初始 super_admin 密码（首次启动生效，之后修改无效；留空则随机生成）
ADMIN_INIT_PASSWORD=SuperAdmin@2026
# 管理后台 token 有效期（小时）
ADMIN_JWT_EXPIRE_HOUR=8
```

---

## 七、实施步骤（分阶段）

### 阶段 1：基础骨架（1 步完成）
1.1 创建 adminfront 项目（Vite + React + TS + Tailwind）
1.2 初始化 shadcn/ui 配置，引入高频组件（Table/Form/Dialog/Button/Input/Select）
1.3 搭建 AdminLayout（Sidebar + Header + Content，侧边栏折叠，路由高亮）
1.4 后端：新增 `AdminUser` / `AdminOperationLog` 模型
1.5 后端：新增 `AdminJWTAuth` / `RequireAdminRole` 中间件
1.6 后端：新增管理员登录/登出/修改密码接口
1.7 后端：seed 默认 super_admin
1.8 前端：登录页 + adminAuthStore + 路由守卫
1.9 更新 Nginx 配置

**里程碑**：可登录 adminfront，看到 Dashboard 空壳，菜单按角色显示。

### 阶段 2：Dashboard + 用户管理
2.1 后端：Dashboard 聚合接口（总览 + 趋势 + 雷达图）
2.2 前端：DashboardPage（Recharts 4 图 + 卡片）
2.3 后端：家庭/孩子/家长列表与详情接口（全局搜索 + 分页）
2.4 前端：FamilyListPage + FamilyDetailPage
2.5 前端：ChildListPage + ChildDetailPage
2.6 前后端：禁用/启用家庭功能 + 操作日志

### 阶段 3：任务 + 兑换 + 内容管理
3.1 后端：全局任务列表 / 删除接口
3.2 后端：系统任务模板 CRUD（is_system=true）
3.3 后端：习惯库 / 大师挑战模板 / 父任务模板 CRUD
3.4 前端：TaskListPage + SystemTemplatePage
3.5 后端：兑换商品 / 兑换订单全局查询
3.6 前端：RedeemItemListPage + RedeemOrderPage

### 阶段 4：成就 + 能力 + 问卷
4.1 后端：系统勋章 CRUD
4.2 后端：能力维度 / 年级引导表配置接口
4.3 前端：AchievementPage + DimensionPage + GradeGuidePage
4.4 后端：问卷题库 CRUD
4.5 前端：QuestionnairePage

### 阶段 5：社区 + 系统配置 + 审核
5.1 后端：社区分享列表 / 删除、公益项目 CRUD
5.2 前端：ShareModerationPage + CharityProjectPage
5.3 后端：AI 使用量统计、系统配置 CRUD、操作日志查询
5.4 前端：AIUsagePage + ConfigPage + OperationLogPage
5.5 前端：管理员管理（仅 super_admin）

### 阶段 6：安全加固 + 测试
6.1 登录限流、密码强度校验
6.2 敏感操作二次确认（删除家庭等）
6.3 批量操作 + 幂等
6.4 E2E 测试 + 权限回归测试

---

## 八、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 管理后台越权访问（横向越权：A 家庭数据被 B 管理员误操作） | 高 | 所有管理接口统一使用全局查询，不走现有家庭级 service；代码 Review 重点查 SQL 是否带 `family_id` 条件 |
| 管理员密码泄露 | 高 | bcrypt 强度 12+；强制首次登录改密；支持 IP 白名单；登录失败锁定；敏感操作二次验证 |
| 误删数据无法恢复 | 高 | 删除前弹出二次确认（显示受影响数据量）；写操作全程记录 `AdminOperationLog`；核心表考虑加 `DeletedAt` 软删除 |
| shadcn/ui 组件复制量大 | 中 | 优先引入高频组件（Table/Form/Dialog），低频组件（如 Calendar/Timeline）按需再加 |
| 管理后台 build 体积大 | 中 | 路由懒加载（`React.lazy + Suspense`）；Recharts/ECharts 按需引入；`vite.config.ts` 开启 manualChunks |
| 与家长端 API 路由冲突 | 低 | 管理后台 API 统一前缀 `/api/admin/*`，静态资源统一前缀 `/admin/*`，Nginx 按前缀路由 |
| Dashboard 聚合查询慢 | 中 | 数据量小时直接 COUNT/GROUP BY；超过 10 万行考虑加汇总表或定时任务预聚合 |

---

## 九、与现有项目的一致性保障

1. **代码风格**：沿用 frontend 的 eslint / prettier / tsconfig 配置
2. **命名规范**：API 接口 `/api/admin/xxx`，文件命名 PascalCase 组件 + camelCase 工具
3. **状态管理**：Zustand（与家长端一致），持久化到 `localStorage`，key 前缀 `growpocket_admin_`
4. **请求库**：Axios（与家长端一致），拦截器统一处理 401 跳登录、403 弹 toast、500 显示错误页
5. **UI 风格**：使用同一套颜色体系（从现有 frontend tailwind.config.js 提取主色），但管理后台用更商务冷静的配色（深色侧栏 + 浅色内容区）

---

## 十、最终推荐技术选型汇总

| 层级 | 选型 | 说明 |
|------|------|------|
| 前端框架 | Vite 6 + React 18 + TypeScript 5.8 | 与家长端一致 |
| 样式 | Tailwind CSS 3 + shadcn/ui | 组件可定制，不引入第二套 UI |
| 状态 | Zustand 5 + React Router 7 | 与家长端一致 |
| 图表 | Recharts 3 | 与家长端一致，避免引入 ECharts |
| 表单 | React Hook Form + Zod | shadcn/form 标准方案 |
| 后端认证 | 独立 JWT（ADMIN_JWT_SECRET） | 与家长端 token 完全隔离 |
| 管理员表 | 独立 admin_user | 不污染 User 表的 parent/child 语义 |
| 部署路径 | `/admin/` 静态 + `/api/admin/` 接口 | 前缀隔离，Nginx 简单配置 |
