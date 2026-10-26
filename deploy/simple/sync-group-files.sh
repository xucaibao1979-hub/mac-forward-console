#!/usr/bin/env bash
set -Eeuo pipefail

# Target server. Change this to the machine that should receive the same files.
REMOTE_HOST="${REMOTE_HOST:-root@192.168.1.78}"

# Keep the same absolute paths on the remote server by default.
FILES=(
  "/opt/weixin/csmac2106/list/schoollist.txt"
  "/opt/weixin/csmac2108/list/schoollist.txt"
  "/opt/weixin/aotmac2104/list/schoollist.txt"
)

LOG_FILE="${LOG_FILE:-/opt/weixin/mac-forward-console-runtime/logs/group-file-sync.log}"
RSYNC_OPTIONS=(-az --checksum --delay-updates)

log() {
  mkdir -p "$(dirname "$LOG_FILE")"
  printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG_FILE"
}

check_dependencies() {
  command -v rsync >/dev/null 2>&1 || {
    echo "缺少 rsync，请先安装：apt install -y rsync" >&2
    exit 1
  }
  command -v inotifywait >/dev/null 2>&1 || {
    echo "缺少 inotifywait，请先安装：apt install -y inotify-tools" >&2
    exit 1
  }
}

sync_file() {
  local file="$1"
  local remote_dir

  if [[ ! -f "$file" ]]; then
    log "跳过：本地文件不存在 $file"
    return 0
  fi

  remote_dir="$(dirname "$file")"
  ssh "$REMOTE_HOST" "mkdir -p '$remote_dir'"
  rsync "${RSYNC_OPTIONS[@]}" "$file" "$REMOTE_HOST:$file"
  log "已同步：$file -> $REMOTE_HOST:$file"
}

sync_all() {
  local file
  for file in "${FILES[@]}"; do
    sync_file "$file"
  done
}

watch_files() {
  local file
  local watch_dirs=()

  for file in "${FILES[@]}"; do
    mkdir -p "$(dirname "$file")"
    watch_dirs+=("$(dirname "$file")")
  done

  log "开始监听群名单文件变化，目标：$REMOTE_HOST"
  inotifywait -m -e close_write,move,create,delete "${watch_dirs[@]}" --format '%w%f' |
    while read -r changed_file; do
      for file in "${FILES[@]}"; do
        if [[ "$changed_file" == "$file" ]]; then
          sync_file "$file"
          break
        fi
      done
    done
}

check_dependencies
sync_all
watch_files
