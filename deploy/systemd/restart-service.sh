#!/usr/bin/env bash
set -Eeuo pipefail

app_dir="/opt/weixin/mac-forward-console-ubuntu"
config_file="/opt/weixin/mac-forward-console-config/.env"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 用户执行此脚本" >&2
  exit 1
fi

cd "$app_dir"
set -a
# shellcheck disable=SC1090
source "$config_file"
set +a

if [[ ! -f node_modules/vinext/dist/cli.js ]]; then
  pnpm install --frozen-lockfile
fi

systemctl daemon-reload
systemctl restart mac-forward-executor.service mac-forward-web.service nginx.service

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempt
  for attempt in {1..30}; do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      echo "$name 已就绪"
      return 0
    fi
    if ! systemctl is-active --quiet mac-forward-executor.service mac-forward-web.service; then
      break
    fi
    sleep 2
  done
  echo "$name 在60秒内未就绪：$url" >&2
  systemctl --no-pager --full status mac-forward-executor.service mac-forward-web.service >&2 || true
  journalctl -u mac-forward-executor.service -u mac-forward-web.service -n 80 --no-pager >&2 || true
  return 1
}

wait_for_url "执行服务" "http://127.0.0.1:${EXECUTOR_PORT:-8787}/api/health"
wait_for_url "Web页面" "http://127.0.0.1:${WEB_PORT:-3000}/"

if ! systemctl is-active --quiet mac-forward-executor.service mac-forward-web.service nginx.service; then
  echo "服务启动失败，最近日志如下：" >&2
  journalctl -u mac-forward-executor.service -u mac-forward-web.service -n 60 --no-pager >&2
  exit 1
fi

echo "机器人中控台服务已重新启动。"
systemctl --no-pager --full status mac-forward-executor.service mac-forward-web.service | sed -n '1,20p'
