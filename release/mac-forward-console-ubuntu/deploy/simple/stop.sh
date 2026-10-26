#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/../.."

config_file="${CONFIG_FILE:-/opt/weixin/mac-forward-console-config/.env}"
if [[ -f "$config_file" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$config_file"
  set +a
fi
runtime_dir="${RUNTIME_DIR:-/opt/weixin/mac-forward-console-runtime}"

for service in web executor; do
  pid_file="$runtime_dir/${service}.pid"
  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      echo "已停止 $service，PID $pid"
    fi
    rm -f "$pid_file"
  fi
done

# Compatibility cleanup for older releases that recorded pnpm parent PIDs.
# Limit cleanup to this application's two private ports.
if command -v fuser >/dev/null 2>&1; then
  web_port="${WEB_PORT:-3000}"
  if [[ "$web_port" =~ ^[0-9]+$ ]] && (( web_port >= 1024 )); then
    fuser -k "$web_port/tcp" 2>/dev/null || true
  fi
  fuser -k "${EXECUTOR_PORT:-8787}/tcp" 2>/dev/null || true
fi
