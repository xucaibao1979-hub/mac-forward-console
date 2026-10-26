#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/../.."

config_file="${CONFIG_FILE:-/opt/weixin/mac-forward-console-config/.env}"
mkdir -p "$(dirname "$config_file")"
if [[ ! -f "$config_file" ]]; then
  if [[ -f .env ]]; then
    cp .env "$config_file"
    echo "已将旧 .env 迁移到永久配置目录"
  else
    cp .env.example "$config_file"
    echo "已创建 $config_file，请按实际地址检查配置"
  fi
fi
set -a
# shellcheck disable=SC1091
source "$config_file"
set +a

runtime_dir="${RUNTIME_DIR:-/opt/weixin/mac-forward-console-runtime}"
data_dir="${DATA_DIR:-/opt/weixin/mac-forward-console-data}"
mkdir -p "$runtime_dir/logs" "$data_dir"

# First upgrade from older releases: move a copy of the old in-project state
# into the durable directory. The original is retained as a rollback copy.
if [[ ! -f "$data_dir/state.json" && -f executor/data/state.json ]]; then
  cp executor/data/state.json "$data_dir/state.json"
  chmod 600 "$data_dir/state.json"
  echo "已将旧版本数据迁移到永久数据目录"
fi

if [[ -f "$runtime_dir/executor.pid" ]] && kill -0 "$(cat "$runtime_dir/executor.pid")" 2>/dev/null; then
  echo "执行服务已经运行，PID $(cat "$runtime_dir/executor.pid")"
else
  nohup node executor/server.mjs > "$runtime_dir/logs/executor.log" 2>&1 &
  echo $! > "$runtime_dir/executor.pid"
  echo "执行服务已启动，PID $(cat "$runtime_dir/executor.pid")"
fi

if [[ -f "$runtime_dir/web.pid" ]] && kill -0 "$(cat "$runtime_dir/web.pid")" 2>/dev/null; then
  echo "Web页面已经运行，PID $(cat "$runtime_dir/web.pid")"
else
  nohup node node_modules/vinext/dist/cli.js dev > "$runtime_dir/logs/web.log" 2>&1 &
  echo $! > "$runtime_dir/web.pid"
  echo "Web页面已启动，PID $(cat "$runtime_dir/web.pid")"
fi

sleep 2
if ! kill -0 "$(cat "$runtime_dir/executor.pid")" 2>/dev/null; then
  echo "执行服务启动失败，最近日志如下：" >&2
  tail -n 30 "$runtime_dir/logs/executor.log" >&2
  exit 1
fi
if ! kill -0 "$(cat "$runtime_dir/web.pid")" 2>/dev/null; then
  echo "Web页面启动失败，最近日志如下：" >&2
  tail -n 30 "$runtime_dir/logs/web.log" >&2
  exit 1
fi

echo "数据目录：$data_dir"
echo "配置文件：$config_file"
echo "访问地址：http://服务器IP:${WEB_PORT:-3000}/"
