# GrowPocket 管理后台前端 (adminfront) 阶段 1 骨架搭建计划

## 一、项目概述

为 GrowPocket 项目新建管理后台前端 `adminfront`，路径 `/Users/Admin1/Workhome/GrowPocket/adminfront`。

### 技术栈（与家长端 frontend 对齐）
- **框架**: React 18 + TypeScript 5.8
- **构建工具**: Vite 6 + vite-tsconfig-paths + @tailwindcss/vite
- **样式**: Tailwind CSS 3 + PostCSS + Autoprefixer（shadcn/ui 风格 CSS 变量）
- **状态管理**: Zustand 5（persist middleware）
- **HTTP**: Axios 1.18
- **路由**: React Router DOM 7（basename="/admin"）
- **图标**: Lucide React
- **图表**: Recharts 3
- **工具函数**: clsx + tailwind-merge (cn 函数) + dayjs
- **表单**: React Hook Form + Zod + @hookform/resolvers
- **UI 组件库**: shadcn/ui 手写实现（基于 Radix UI + class-variance-authority）
  - Radix UI: dialog/select/dropdown-menu/tabs/checkbox/label/slot/avatar/badge/pagination
  - 日期: react-day-picker + date-fns + @radix-ui/react-date-picker
  - 其他: cmdk (命令面板), vaul (抽屉)

### 主题色体系（管理后台商务风，冷灰 + 低饱和绿）
参考家长端 GrowPocket 绿/芽色 (#6DBF7B → 降饱和)，neutral 冷灰色系作背景
- Primary: 低饱和绿 (HSL ~142 35% 45%)
- Accent: 中性蓝紫
- Background: neutral 冷灰
- Card/Popover/Border/Input/Ring: 基于 neutral 灰阶

## 二、目录结构

```
adminfront/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
├── components.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── lib/
    │   ├── utils.ts
    │   └── axios.ts
    ├── types/
    │   └── index.ts
    ├── stores/
    │   ├── adminAuthStore.ts
    │   └── adminUIStore.ts
    ├── api/
    │   └── auth.ts
    ├── router/
    │   └── index.tsx
    ├── components/
    │   ├── ProtectedRoute.tsx
    │   ├── Toast.tsx
    │   ├── ui/
    │   │   ├── button.tsx
    │   │   ├── input.tsx
    │   │   ├── label.tsx
    │   │   ├── card.tsx
    │   │   ├── badge.tsx
    │   │   ├── dialog.tsx
    │   │   ├── select.tsx
    │   │   ├── dropdown-menu.tsx
    │   │   ├── table.tsx
    │   │   ├── pagination.tsx
    │   │   ├── avatar.tsx
    │   │   ├── tabs.tsx
    │   │   ├── checkbox.tsx
    │   │   ├── form.tsx
    │   │   └── date-picker.tsx
    │   └── layout/
    │       ├── AdminLayout.tsx
    │       ├── Sidebar.tsx
    │       └── Header.tsx
    └── pages/
        ├── LoginPage.tsx
        ├── DashboardPage.tsx
        ├── FamilyListPage.tsx
        ├── TaskListPage.tsx
        ├── ItemListPage.tsx
        ├── AchievementPage.tsx
        ├── OperationLogPage.tsx
        ├── AdminListPage.tsx
        ├── NotFoundPage.tsx
        └── ErrorPage.tsx
```

## 三、详细实施步骤

### 阶段 1: 项目根配置文件
1. **package.json**
   - 对齐 frontend 大版本号：react 18.3.1 / react-dom 18.3.1 / react-router-dom 7.18.0 / zustand 5.0.14 / axios 1.18.0 / recharts 3.8.1 / lucide-react 0.511.0 / clsx 2.1.1 / tailwind-merge 3.0.2 / dayjs
   - 新增：@hookform/resolvers / react-hook-form / zod / class-variance-authority / cmdk / date-fns / react-day-picker / vaul
   - Radix UI 系列：@radix-ui/react-dialog / select / dropdown-menu / tabs / checkbox / label / slot / avatar / badge / pagination / date-picker
   - DevDependencies: typescript ~5.8.3 / vite 6.3.5 / @vitejs/plugin-react 4.4.1 / tailwindcss 3.4.19 / postcss 8.5.3 / autoprefixer 10.4.21 / @tailwindcss/vite 4.3.1 / @types/node 22.15.30 / @types/react 18.3.12 / @types/react-dom 18.3.1 / eslint 全家桶同 frontend / vite-tsconfig-paths 5.1.4
   - Scripts: dev / build (tsc -b && vite build) / lint / check (tsc -b --noEmit)

2. **tsconfig.json**
   - 严格模式 strict: true
   - baseUrl: "."
   - paths: {"@/*": ["./src/*"]}
   - 其他对齐 frontend（target ES2020, jsx react-jsx, moduleResolution bundler 等）

3. **vite.config.ts**
   - plugins: @vitejs/plugin-react + vite-tsconfig-paths + @tailwindcss/vite
   - server.port: 5174
   - base: '/admin/'
   - proxy: '/api/admin' → 'http://localhost:8080'

4. **tailwind.config.js**
   - darkMode: 'class'
   - content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]
   - theme.extend 定义 shadcn/ui CSS 变量（HSL 格式）：
     - --background (neutral 50/950)
     - --foreground (neutral 950/50)
     - --card / --card-foreground
     - --popover / --popover-foreground
     - --primary / --primary-foreground（低饱和芽绿）
     - --secondary / --secondary-foreground
     - --muted / --muted-foreground
     - --accent / --accent-foreground
     - --destructive / --destructive-foreground
     - --border / --input / --ring

5. **postcss.config.js** (标准)

6. **eslint.config.js** (同 frontend)

7. **components.json** (shadcn/ui 配置)

8. **index.html**
   - `<title>GrowPocket 管理后台</title>`
   - 根 `<div id="root"></div>`
   - 引用 `/src/main.tsx`

### 阶段 2: 基础资源
1. **src/main.tsx**: React 18 createRoot + StrictMode + BrowserRouter basename="/admin" + App
2. **src/App.tsx**: 挂载 RouterProvider
3. **src/index.css**: @tailwind base/components/utilities + :root / .dark CSS 变量 + html/body apply
4. **src/lib/utils.ts**: cn = twMerge(clsx(inputs))
5. **src/lib/axios.ts**: axios.create({ baseURL: "/api/admin", timeout: 30000 })
   - request 拦截器：Authorization Bearer 从 adminAuthStore 取 token（用 injectStore 避免循环依赖）
   - response 拦截器：401 清 token + 跳 /admin/login；403 toast；5xx toast

### 阶段 3: 类型 + Zustand 状态管理
1. **src/types/index.ts**:
   - AdminUser (id, username, nickname, role, is_active, last_login_at?)
   - AdminLoginResponse (token + admin)
   - AdminOperationLog
   - PaginationParams / PaginationResult<T>
   - ApiResponse<T> = {code:number, message:string, data:T, success?:boolean}

2. **src/stores/adminAuthStore.ts**:
   - zustand create + persist (name: "growpocket_admin_auth")
   - state: token, admin, isAuthenticated
   - actions: login, logout, setAdmin
   - partialize 只持久化 token + admin

3. **src/stores/adminUIStore.ts**:
   - zustand create + persist (name: "growpocket_admin_ui")
   - state: sidebarCollapsed, theme
   - actions: toggleSidebar, setTheme

### 阶段 4: shadcn/ui 核心组件 (src/components/ui/)
按 shadcn/ui 官方代码逐一实现：
1. button.tsx (cva variant + size)
2. input.tsx
3. label.tsx (@radix-ui/react-label)
4. card.tsx
5. badge.tsx (@radix-ui/react-badge + cva)
6. dialog.tsx (@radix-ui/react-dialog + Portal/Overlay)
7. select.tsx (@radix-ui/react-select)
8. dropdown-menu.tsx (@radix-ui/react-dropdown-menu)
9. table.tsx
10. pagination.tsx (@radix-ui/react-pagination)
11. avatar.tsx (@radix-ui/react-avatar)
12. tabs.tsx (@radix-ui/react-tabs)
13. checkbox.tsx (@radix-ui/react-checkbox)
14. form.tsx (react-hook-form + zod)
15. date-picker.tsx (react-day-picker + date-fns)
16. Toast.tsx (简易版或参考 frontend)

### 阶段 5: 布局组件 (src/components/layout/)
1. **AdminLayout.tsx**: 三栏结构 min-h-screen flex
2. **Sidebar.tsx**: Logo + 菜单（仪表盘/用户管理/任务管理/兑换商城/内容配置/系统配置）+ 折叠状态 + NavLink + lucide icons
3. **Header.tsx**: 面包屑 + 搜索 + 主题切换 + 管理员 DropdownMenu（头像/昵称/角色/修改密码/退出登录）

### 阶段 6: 路由与守卫
1. **src/router/index.tsx**: createBrowserRouter
   - /login → LoginPage（公共）
   - / → ProtectedRoute → AdminLayout → 子路由：
     - index 重定向 /dashboard
     - /dashboard → DashboardPage
     - /families → FamilyListPage
     - /tasks → TaskListPage
     - /redeem/items → ItemListPage
     - /achievements/system → AchievementPage
     - /system/logs → OperationLogPage
     - /admin/users → AdminListPage（super_admin only）
   - * → NotFoundPage
   - errorElement → ErrorPage

2. **src/components/ProtectedRoute.tsx**: 检查 isAuthenticated → navigate("/login")，带 from state

### 阶段 7: 页面
1. **LoginPage.tsx**: 居中卡片登录表单
   - 品牌区 🌱 GrowPocket Admin
   - username Input + password Input（Eye/EyeOff 切换）
   - 登录 Button（submit + loading Spinner）
   - 错误 Badge
   - react-hook-form + zod：username min=3, password min=8
   - POST /api/admin/auth/login → adminAuthStore.login + navigate(from || "/dashboard")

2. **DashboardPage.tsx**: 4 张数据卡片（家庭/孩子/今日任务/今日积分）+ Recharts LineChart 占位（height=300）

3. 其他占位页：简单 Card + "开发中..."（Family/Task/Item/Achievement/Log/Admin 6 个页面）
4. NotFoundPage / ErrorPage 简单占位

### 阶段 8: API 请求 (src/api/auth.ts)
基于 src/lib/axios.ts：
- login(data) → POST /auth/login
- me() → GET /auth/me
- changePassword(data) → PUT /auth/password
- refreshToken() → POST /auth/refresh
- logout()（本地清 store）
- listAdmins(params?)
- createAdmin(data)
- updateAdmin(id, data)
- deleteAdmin(id)
- listOperationLogs(params?)

### 阶段 9: 验证
1. cd adminfront && npm install（如需要 --legacy-peer-deps）
2. npm run build（tsc + vite build）
3. 修复所有编译/类型错误

## 四、关键注意事项

1. **循环依赖**: axios.ts 不要直接 import adminAuthStore，用 injectStore/setTokenProvider 模式
2. **Vite base**: base: '/admin/' 与 BrowserRouter basename="/admin" 保持一致
3. **颜色一致性**: primary 色参考家长端 success (#6DBF7B)，降饱和度到商务风绿
4. **后端响应结构**: ApiResponse code=0 成功，对应后端 pkg/util/response.go 的 Response{Code,Message,Data}
5. **严格模式**: tsconfig strict: true，确保类型安全
