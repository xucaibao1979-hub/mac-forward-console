#!/usr/bin/env bash
set -Eeuo pipefail

app_dir="$(cd "$(dirname "$0")/../.." && pwd)"
config_file="${CONFIG_FILE:-/opt/weixin/mac-forward-console-config/.env}"

if [[ ! -f "$config_file" ]]; then
  mkdir -p "$(dirname "$config_file")"
  cp "$app_dir/.env.example" "$config_file"
  echo "已创建永久配置：$config_file"
fi

set -a
# shellcheck disable=SC1090
source "$config_file"
set +a

if [[ -z "${CONFIG_ENCRYPTION_KEY:-}" ]]; then
  generated_key="$(openssl rand -hex 32)"
  printf '\nCONFIG_ENCRYPTION_KEY=%s\n' "$generated_key" >> "$config_file"
  export CONFIG_ENCRYPTION_KEY="$generated_key"
  echo "已生成并保存设备凭据加密密钥"
fi

public_host="${PUBLIC_HOST:-}"
if [[ -z "$public_host" ]]; then
  public_host="$(printf '%s' "${CONSOLE_ORIGIN:-}" | sed -E 's#^https?://([^/:]+).*$#\1#')"
fi
if [[ -z "$public_host" || "$public_host" == "${CONSOLE_ORIGIN:-}" ]]; then
  echo "请在 $config_file 中设置 PUBLIC_HOST=服务器IP" >&2
  exit 1
fi

cd "$app_dir"
echo "[1/5] 停止旧服务"
bash deploy/simple/stop.sh

echo "[2/5] 检查程序依赖"
if [[ ! -f node_modules/vinext/dist/cli.js ]]; then
  pnpm install --frozen-lockfile
fi

echo "[3/5] 更新 Nginx 转发配置"
nginx_target="/etc/nginx/conf.d/00-mac-forward-console.conf"
sed "s/__PUBLIC_HOST__/$public_host/g" deploy/ubuntu/nginx-mac-forward-console.conf > "$nginx_target"
# Remove the older filename created by previous releases to avoid duplicate servers.
rm -f /etc/nginx/conf.d/mac-forward-console.conf
nginx -t
systemctl reload nginx

echo "[4/5] 启动控制台"
bash deploy/simple/start.sh
sleep 3

echo "[5/5] 健康检查"
curl -fsS "http://127.0.0.1:${EXECUTOR_PORT:-8787}/api/health" >/dev/null
curl -fsS "http://127.0.0.1:${WEB_PORT:-3000}/" >/dev/null
status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $public_host" http://127.0.0.1/)"
if [[ "$status" != "200" ]]; then
  echo "Nginx 页面检查失败，HTTP $status" >&2
  tail -n 30 /var/log/nginx/error.log >&2 || true
  exit 1
fi

echo "控制台已正常运行：http://$public_host/"
