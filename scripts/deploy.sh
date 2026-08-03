#!/usr/bin/env bash
# DevLens 部署脚本 — 在 joox 服务器上执行，幂等可重复运行
# 用法: bash /opt/devlens/scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/devlens}"
SSL_DIR="/etc/ssl/devlens"
SITE_CONF="/etc/nginx/sites-available/devlens"
SITE_LINK="/etc/nginx/sites-enabled/devlens"
DEPLOY_USER="${DEPLOY_USER:-$USER}"

if [ "$(id -u)" = "0" ]; then SUDO=""; else SUDO="sudo -n"; fi

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

# 1. 环境自检
command -v uv >/dev/null || die "uv not found (需要 Python/uv，基础设施应已就绪)"
command -v pnpm >/dev/null || die "pnpm not found (需要 Node/pnpm)"
command -v nginx >/dev/null || die "nginx not found"
command -v systemctl >/dev/null || die "systemctl not found (需要 systemd)"
command -v curl >/dev/null || die "curl not found"
command -v openssl >/dev/null || die "openssl not found"
[ -d "$APP_DIR/backend" ] || die "$APP_DIR/backend 不存在 — 先完成 scp 同步"

# 2. 后端依赖
log "安装后端依赖"
cd "$APP_DIR/backend"
uv sync --frozen

# 3. 后端 .env（只创建、不覆盖）
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cat > "$APP_DIR/backend/.env" <<'EOF'
COPILOT_PROVIDER_BASE_URL=https://api.deepseek.com/anthropic
COPILOT_MODEL=deepseek-v4-pro
# 请填写你的 DeepSeek API key（此文件不提交 git，也绝不被部署覆盖）：
COPILOT_PROVIDER_API_KEY=
# 本地单机兼容开关：true=无认证网关时回退本地管理员；对公网暴露必须改 false 并由网关注入 X-DevLens-User-Id/X-DevLens-Tenant-Id。
DEVLENS_ALLOW_LOCAL_ADMIN=true
# 数据库连接（默认 Unix socket peer auth 连本机 devlens 库；如需远端/密码认证，取消注释并填写）：
# DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/devlens
EOF
  log "已生成 backend/.env — 请人工填入 COPILOT_PROVIDER_API_KEY 后重跑部署"
fi

# 4. 前端构建（NEXT_PUBLIC_API_URL 指向同源 /api/v1，关闭 mock）
log "构建前端"
cd "$APP_DIR/frontend"
pnpm install --frozen-lockfile
NEXT_PUBLIC_API_URL=/api/v1 pnpm build

# 5. 自签名证书（仅首次）
if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
  log "生成自签名证书（10 年）"
  $SUDO mkdir -p "$SSL_DIR"
  $SUDO openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout "$SSL_DIR/privkey.pem" -out "$SSL_DIR/fullchain.pem" \
    -subj "/CN=joox"
fi

# 6. nginx（nginx -t 不通过则回滚，现有运行配置不受影响）
log "安装 nginx 配置"
if [ -f "$SITE_CONF" ]; then $SUDO cp "$SITE_CONF" "$SITE_CONF.prev"; fi
$SUDO cp "$APP_DIR/deploy/nginx-devlens.conf" "$SITE_CONF"
$SUDO ln -sfn "$SITE_CONF" "$SITE_LINK"
if ! $SUDO nginx -t; then
  if [ -f "$SITE_CONF.prev" ]; then
    $SUDO cp "$SITE_CONF.prev" "$SITE_CONF"   # 恢复旧配置，软链保持指向
  else
    $SUDO rm -f "$SITE_CONF" "$SITE_LINK"     # 首次部署失败则整体清理
  fi
  die "nginx -t 校验失败，已回滚配置"
fi
$SUDO rm -f "$SITE_CONF.prev"
$SUDO systemctl reload nginx

# 7. systemd 单元（模板替换用户与目录）
log "安装并重启 systemd 服务"
for unit in devlens-backend devlens-frontend; do
  sed -e "s|__USER__|$DEPLOY_USER|g" -e "s|__APP_DIR__|$APP_DIR|g" \
    "$APP_DIR/deploy/$unit.service.template" > "/tmp/$unit.service"
  $SUDO install -m 0644 "/tmp/$unit.service" "/etc/systemd/system/$unit.service"
done
$SUDO systemctl daemon-reload
$SUDO systemctl enable devlens-backend devlens-frontend
$SUDO systemctl restart devlens-backend devlens-frontend

# 8. 健康检查（最多 90s：后端 /api/v1/health + 前端服务存活）
log "等待 https://127.0.0.1:7504/api/v1/health"
for i in $(seq 1 90); do
  if curl -k -sf "https://127.0.0.1:7504/api/v1/health" >/dev/null 2>&1 \
     && $SUDO systemctl is-active --quiet devlens-frontend; then
    log "部署成功"
    exit 0
  fi
  sleep 1
done
die "健康检查 90s 内未通过（后端或前端未就绪）"
