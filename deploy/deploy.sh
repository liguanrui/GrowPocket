#!/bin/bash
set -e

# GrowPocket 部署脚本
# 用法: ./deploy.sh [选项] <服务器IP> [SSH用户名] [SSH端口]
# 选项:
#   -i <密钥文件>  指定 SSH 私钥文件路径

SSH_KEY=""

while getopts "i:" opt; do
    case $opt in
        i) SSH_KEY="$OPTARG" ;;
        \?) echo "无效选项: -$OPTARG" >&2; exit 1 ;;
    esac
done
shift $((OPTIND-1))

SERVER_IP=${1:-}
SSH_USER=${2:-root}
SSH_PORT=${3:-22}

if [ -z "$SERVER_IP" ]; then
    echo "用法: $0 [选项] <服务器IP> [SSH用户名] [SSH端口]"
    echo "选项:"
    echo "  -i <密钥文件>  指定 SSH 私钥文件路径"
    echo ""
    echo "示例:"
    echo "  $0 123.45.67.89 root 22"
    echo "  $0 -i ~/.ssh/id_rsa 123.45.67.89 root 22"
    exit 1
fi

if [ -n "$SSH_KEY" ] && [ ! -f "$SSH_KEY" ]; then
    echo "错误: 密钥文件不存在: $SSH_KEY"
    exit 1
fi

SCP_OPTS=()
SSH_OPTS=()
if [ -n "$SSH_KEY" ]; then
    SCP_OPTS+=(-i "$SSH_KEY")
    SSH_OPTS+=(-i "$SSH_KEY")
fi

echo "===== GrowPocket 部署到 $SERVER_IP ====="
if [ -n "$SSH_KEY" ]; then
    echo "密钥文件: $SSH_KEY"
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. 构建前端
echo "[1/6] 构建前端..."
cd "$PROJECT_ROOT/frontend"
npm ci
npm run build

# 1.5 构建管理后台（如目录存在）
if [ -d "$PROJECT_ROOT/adminfront" ]; then
    echo "[1.5/6] 构建管理后台..."
    cd "$PROJECT_ROOT/adminfront"
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm i
    fi
    npm run build
fi

# 2. 编译后端
echo "[2/6] 编译后端（Linux/AMD64）..."
cd "$PROJECT_ROOT/backend"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o growpocket ./cmd

# 3. 打包
echo "[3/6] 打包部署文件..."
cd "$PROJECT_ROOT"
DEPLOY_DIR=$(mktemp -d)
mkdir -p "$DEPLOY_DIR/frontend"
mkdir -p "$DEPLOY_DIR/adminfront"
mkdir -p "$DEPLOY_DIR/backend/data"
mkdir -p "$DEPLOY_DIR/backend/uploads"
mkdir -p "$DEPLOY_DIR/nginx"
mkdir -p "$DEPLOY_DIR/systemd"

cp -r frontend/dist/* "$DEPLOY_DIR/frontend/"
if [ -d "$PROJECT_ROOT/adminfront/dist" ]; then
    cp -r "$PROJECT_ROOT/adminfront/dist/"* "$DEPLOY_DIR/adminfront/"
fi
cp backend/growpocket "$DEPLOY_DIR/backend/"
cp deploy/nginx/growpocket.conf "$DEPLOY_DIR/nginx/"
cp deploy/systemd/growpocket.service "$DEPLOY_DIR/systemd/"

# 创建远端部署脚本
cat > "$DEPLOY_DIR/setup.sh" << 'REMOTE_EOF'
#!/bin/bash
set -e

echo "===== 远端部署 ====="

# 创建目录
mkdir -p /opt/growpocket/frontend
mkdir -p /opt/growpocket/adminfront
mkdir -p /opt/growpocket/backend/data
mkdir -p /opt/growpocket/backend/uploads

# 复制文件
cp -r frontend/* /opt/growpocket/frontend/
if [ -d adminfront ]; then
    cp -r adminfront/* /opt/growpocket/adminfront/
fi
cp backend/growpocket /opt/growpocket/backend/
chmod +x /opt/growpocket/backend/growpocket

# 安装 nginx（如未安装）
if ! command -v nginx &> /dev/null; then
    echo "安装 Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# 复制 nginx 配置
cp nginx/growpocket.conf /etc/nginx/sites-available/growpocket
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/growpocket /etc/nginx/sites-enabled/growpocket

# 测试并重载 nginx
nginx -t
systemctl reload nginx

# 安装 systemd 服务
cp systemd/growpocket.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable growpocket

# 启动/重启服务
systemctl restart growpocket

# 检查状态
echo ""
echo "===== 部署完成 ====="
echo "Nginx 状态:"
systemctl is-active nginx || echo "nginx 未运行"
echo ""
echo "GrowPocket 状态:"
systemctl is-active growpocket || echo "growpocket 未运行"
echo ""
echo "访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo '你的服务器IP')"
REMOTE_EOF

chmod +x "$DEPLOY_DIR/setup.sh"

# 打包
tar czf /tmp/growpocket-deploy.tar.gz -C "$DEPLOY_DIR" .
rm -rf "$DEPLOY_DIR"

# 4. 上传到服务器
echo "[4/6] 上传到服务器..."
scp "${SCP_OPTS[@]}" -P "$SSH_PORT" /tmp/growpocket-deploy.tar.gz "$SSH_USER@$SERVER_IP:/tmp/"

# 5. 远端执行部署
echo "[5/6] 远端执行部署..."
ssh "${SSH_OPTS[@]}" -p "$SSH_PORT" "$SSH_USER@$SERVER_IP" "
    cd /tmp && mkdir -p growpocket-deploy && tar xzf growpocket-deploy.tar.gz -C growpocket-deploy && cd growpocket-deploy && bash setup.sh
    rm -rf /tmp/growpocket-deploy /tmp/growpocket-deploy.tar.gz
"

# 6. 清理
echo "[6/6] 清理本地临时文件..."
rm -f /tmp/growpocket-deploy.tar.gz

echo ""
echo "===== 部署完成 ====="
echo "访问地址: http://$SERVER_IP"
