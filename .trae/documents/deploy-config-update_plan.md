# GrowPocket 管理后台部署配置更新计划

## 概述
为 GrowPocket 项目新增管理后台的部署配置支持，涉及 3 个文件的修改。

---

## 修改文件清单与变更点

### 1. deploy/nginx/growpocket.conf

**变更点 A：在 `location /` 之前新增 `location /admin/` 块**

插入位置：第 8-9 行之间（`# 前端静态文件` 注释和 `location / {` 之间）

新增内容：
```nginx
    # 管理后台
    location /admin/ {
        alias /opt/growpocket/adminfront/;
        index index.html;
        try_files $uri $uri/ /admin/index.html;
        # 管理后台安全加固：生产环境建议取消下面两行注释限制 IP
        # allow 192.168.0.0/16;
        # deny all;
    }
```

**变更点 B：在 `location /api/` 块的 proxy 指令之后新增限流注释**

插入位置：第 23 行之后（`proxy_read_timeout 30s;` 之后、`}` 之前）

新增内容：
```nginx
        # limit_req_zone $binary_remote_addr zone=admin_login:10m rate=10r/m;
        # 管理后台登录接口限流 zone=admin_login burst=5 nodelay
```

**不变更：** `location /` 块、`location /uploads/` 块保持原样。

---

### 2. backend/.env.example

**变更：在文件末尾追加管理后台配置块**

追加内容：
```
# ===== 管理后台 =====
# 管理后台独立 JWT 密钥（强烈建议修改为随机长字符串）
ADMIN_JWT_SECRET=change-me-admin-jwt-secret-please-change-in-production
# 管理后台 Token 有效期（小时，默认 8）
ADMIN_JWT_EXPIRE_HOUR=8
# 首次启动时超级管理员（admin）初始密码（至少 8 位；留空则随机生成并在启动日志中打印）
ADMIN_INIT_PASSWORD=SuperAdmin@2026
# 管理后台访问 IP 白名单（英文逗号分隔；* 或空表示不限制）
ADMIN_IP_WHITELIST=*
```

---

### 3. deploy/deploy.sh

**变更点 A：在构建 frontend 之后新增构建 adminfront 步骤**

插入位置：第 57 行之后（`npm run build` 之后、`# 2. 编译后端` 注释之前）

新增内容：
```bash
# 构建管理后台
if [ -d "$PROJECT_ROOT/adminfront" ]; then
  echo "==> 构建管理后台..."
  cd "$PROJECT_ROOT/adminfront"
  [ -f package-lock.json ] && npm ci || npm install --legacy-peer-deps
  npm run build
  rm -rf /opt/growpocket/adminfront
  cp -r dist /opt/growpocket/adminfront
  echo "==> 管理后台部署完成：/opt/growpocket/adminfront"
fi
cd "$PROJECT_ROOT/frontend"
```
注意：最后加 `cd "$PROJECT_ROOT/frontend"` 是为了回到 frontend 目录后，后续第 59 行的 `cd "$PROJECT_ROOT/backend"` 仍能正确工作（保持原有流程）。

**变更点 B：打包阶段新增 adminfront 目录**

- 第 68 行附近的 `mkdir -p` 块中新增：`mkdir -p "$DEPLOY_DIR/adminfront"`
- 第 74 行 `cp -r frontend/dist/* "$DEPLOY_DIR/frontend/"` 之后新增：
  ```bash
  if [ -d "$PROJECT_ROOT/adminfront/dist" ]; then
    cp -r adminfront/dist/* "$DEPLOY_DIR/adminfront/"
  fi
  ```

**变更点 C：远端 setup.sh 中新增 adminfront 目录创建和文件复制**

在第 87-89 行的 mkdir 块中新增：`mkdir -p /opt/growpocket/adminfront`
在第 92 行 `cp -r frontend/* /opt/growpocket/frontend/` 之后新增：
```bash
if [ -d adminfront ]; then
  cp -r adminfront/* /opt/growpocket/adminfront/
fi
```

**变更点 D：步骤编号注释调整**
- `[2/6]` → `[3/7]`
- `[3/6]` → `[4/7]`
- `[4/6]` → `[5/7]`
- `[5/6]` → `[6/7]`
- `[6/6]` → `[7/7]`
- 并在 `[1/6] 构建前端` 之后新增 `[2/7] 构建管理后台` 步骤注释

---

## 部署注意事项

1. **目录存在性**：部署时需确保服务器上 `/opt/growpocket/adminfront` 目录存在并可读（远端 setup.sh 已自动处理创建）。
2. **Nginx reload**：配置更新后需执行 `nginx -t && systemctl reload nginx` 使新 location 生效（setup.sh 已处理）。
3. **环境变量**：生产环境部署时务必修改 `.env` 中 `ADMIN_JWT_SECRET` 为强随机字符串，不要使用示例值。
4. **初始密码**：`ADMIN_INIT_PASSWORD` 仅首次启动生效，首次登录后应立即修改管理员密码。
5. **IP 白名单**：生产环境建议在 Nginx 中取消 `allow/deny` 注释，或通过 `ADMIN_IP_WHITELIST` 限制管理后台访问来源。
6. **adminfront 目录**：`deploy.sh` 中有 `if [ -d "$PROJECT_ROOT/adminfront" ]` 判断，当 adminfront 目录不存在时（暂未开发）会跳过构建，不影响现有流程。
