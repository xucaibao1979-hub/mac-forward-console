#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/weixin/mac-forward-console-ubuntu}"
CONFIG_DIR="${CONFIG_DIR:-/opt/weixin/mac-forward-console-config}"
DATA_DIR="${DATA_DIR:-/opt/weixin/mac-forward-console-data}"
RUNTIME_DIR="${RUNTIME_DIR:-/opt/weixin/mac-forward-console-runtime}"
BACKUP_DIR="${BACKUP_DIR:-/opt/weixin/mac-forward-console-backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
REMOTE_BACKUP_HOST="${REMOTE_BACKUP_HOST:-}"
REMOTE_BACKUP_DIR="${REMOTE_BACKUP_DIR:-/opt/weixin/mac-forward-console-backups}"

GROUP_FILES=(
  "/opt/weixin/csmac2106/list/schoollist.txt"
  "/opt/weixin/csmac2106/list/test.txt"
  "/opt/weixin/csmac2108/list/schoollist.txt"
  "/opt/weixin/csmac2108/list/test.txt"
  "/opt/weixin/aotmac2104/list/schoollist.txt"
  "/opt/weixin/aotmac2104/list/test.txt"
)

timestamp="$(date '+%Y%m%d-%H%M%S')"
work_dir="$BACKUP_DIR/.tmp-$timestamp"
archive="$BACKUP_DIR/mac-forward-console-backup-$timestamp.tar.gz"
log_file="$BACKUP_DIR/backup.log"

log() {
  mkdir -p "$BACKUP_DIR"
  printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$log_file"
}

copy_if_exists() {
  local source_path="$1"
  local target_path="$2"

  if [[ -e "$source_path" ]]; then
    mkdir -p "$(dirname "$target_path")"
    cp -a "$source_path" "$target_path"
    log "已加入备份：$source_path"
  else
    log "跳过不存在路径：$source_path"
  fi
}

cleanup_old_backups() {
  if [[ "$KEEP_DAYS" =~ ^[0-9]+$ ]] && [[ "$KEEP_DAYS" -gt 0 ]]; then
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'mac-forward-console-backup-*.tar.gz' -mtime +"$KEEP_DAYS" -print -delete | while read -r old_file; do
      log "已删除过期备份：$old_file"
    done
  fi
}

remote_copy() {
  if [[ -z "$REMOTE_BACKUP_HOST" ]]; then
    return 0
  fi

  command -v rsync >/dev/null 2>&1 || {
    log "未安装 rsync，跳过远程备份"
    return 0
  }

  ssh "$REMOTE_BACKUP_HOST" "mkdir -p '$REMOTE_BACKUP_DIR'"
  rsync -az "$archive" "$REMOTE_BACKUP_HOST:$REMOTE_BACKUP_DIR/"
  log "已同步备份到远端：$REMOTE_BACKUP_HOST:$REMOTE_BACKUP_DIR/"
}

main() {
  mkdir -p "$BACKUP_DIR" "$work_dir"
  log "开始备份机器人中控台"

  copy_if_exists "$CONFIG_DIR" "$work_dir/config"
  copy_if_exists "$DATA_DIR" "$work_dir/data"
  copy_if_exists "$APP_DIR/.env.example" "$work_dir/code/.env.example"
  copy_if_exists "$APP_DIR/package.json" "$work_dir/code/package.json"
  copy_if_exists "$APP_DIR/pnpm-lock.yaml" "$work_dir/code/pnpm-lock.yaml"
  copy_if_exists "$APP_DIR/app" "$work_dir/code/app"
  copy_if_exists "$APP_DIR/executor" "$work_dir/code/executor"
  copy_if_exists "$APP_DIR/deploy" "$work_dir/code/deploy"
  copy_if_exists "$APP_DIR/public" "$work_dir/code/public"
  copy_if_exists "$APP_DIR/docs" "$work_dir/code/docs"

  mkdir -p "$work_dir/group-files"
  for group_file in "${GROUP_FILES[@]}"; do
    if [[ -f "$group_file" ]]; then
      copy_if_exists "$group_file" "$work_dir/group-files${group_file}"
    else
      log "跳过不存在群名单：$group_file"
    fi
  done

  if [[ -d "$RUNTIME_DIR/logs" ]]; then
    mkdir -p "$work_dir/runtime"
    find "$RUNTIME_DIR/logs" -maxdepth 1 -type f -name '*.log' -mtime -7 -exec cp -a {} "$work_dir/runtime/" \;
    log "已加入最近7天运行日志"
  fi

  tar -czf "$archive" -C "$work_dir" .
  rm -rf "$work_dir"
  chmod 600 "$archive"
  log "备份完成：$archive"

  remote_copy
  cleanup_old_backups
}

main "$@"
