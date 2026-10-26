#!/usr/bin/env bash
set -Eeuo pipefail

app_dir="/opt/weixin/mac-forward-console-ubuntu"
config_file="/opt/weixin/mac-forward-console-config/.env"
unit_dir="/etc/systemd/system"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 用户执行此脚本" >&2
  exit 1
fi
if [[ ! -f "$app_dir/package.json" || ! -f "$app_dir/executor/server.mjs" ]]; then
  echo "程序目录不完整：$app_dir" >&2
  exit 1
fi
if [[ ! -f "$config_file" ]]; then
  mkdir -p "$(dirname "$config_file")"
  cp "$app_dir/.env.example" "$config_file"
  echo "已创建配置文件，请先检查：$config_file" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$config_file"
set +a

node_path="$(command -v node || true)"
if [[ -z "$node_path" ]]; then
  echo "没有找到 Node.js，请先安装 Node.js 22" >&2
  exit 1
fi

cd "$app_dir"
if [[ ! -f node_modules/vinext/dist/cli.js ]]; then
  pnpm install --frozen-lockfile
fi

# Stop the legacy PID-managed processes before systemd takes over the ports.
bash deploy/simple/stop.sh || true

sed "s#ExecStart=/usr/bin/node#ExecStart=$node_path#" deploy/systemd/mac-forward-executor.service > "$unit_dir/mac-forward-executor.service"
sed "s#ExecStart=/usr/bin/node#ExecStart=$node_path#" deploy/systemd/mac-forward-web.service > "$unit_dir/mac-forward-web.service"

mkdir -p /opt/weixin/mac-forward-console-data /opt/weixin/mac-forward-console-runtime
chmod 700 /opt/weixin/mac-forward-console-config /opt/weixin/mac-forward-console-data
chmod 600 "$config_file"
[[ ! -f /opt/weixin/mac-forward-console-data/state.json ]] || chmod 600 /opt/weixin/mac-forward-console-data/state.json

systemctl daemon-reload
systemctl enable --now mac-forward-executor.service mac-forward-web.service nginx.service

echo "等待服务首次启动，首次编译可能需要一些时间……"
bash "$app_dir/deploy/systemd/restart-service.sh"

echo
echo "开机自启动已经启用。"
echo "以后更新代码后执行：bash deploy/systemd/restart-service.sh"
