#!/usr/bin/env bash
set -euo pipefail

LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/opt/weixin/mac-forward-console-backups}"
BACKUP_PATTERN="${BACKUP_PATTERN:-mac-forward-console-backup-*.tar.gz}"

BACKUP_USER="${BACKUP_USER:-root}"
BACKUP_HOST="${BACKUP_HOST:-192.168.1.88}"
BACKUP_PORT="${BACKUP_PORT:-22}"
BACKUP_DIR="${BACKUP_DIR:-/opt/weixin/mac-forward-console-backups}"
SSH_KEY="${SSH_KEY:-/root/.ssh/id_rsa}"
KEEP_DAYS="${KEEP_DAYS:-30}"

latest_backup="$(ls -1t "${LOCAL_BACKUP_DIR}"/${BACKUP_PATTERN} 2>/dev/null | head -1 || true)"

if [ -z "$latest_backup" ]; then
  echo "No backup file found in ${LOCAL_BACKUP_DIR}"
  exit 1
fi

backup_name="$(basename "$latest_backup")"

ssh -i "$SSH_KEY" -p "$BACKUP_PORT" "$BACKUP_USER@$BACKUP_HOST" "mkdir -p '$BACKUP_DIR'"

scp -i "$SSH_KEY" -P "$BACKUP_PORT" "$latest_backup" "$BACKUP_USER@$BACKUP_HOST:$BACKUP_DIR/$backup_name"

ssh -i "$SSH_KEY" -p "$BACKUP_PORT" "$BACKUP_USER@$BACKUP_HOST" \
  "find '$BACKUP_DIR' -type f -name '$BACKUP_PATTERN' -mtime +$KEEP_DAYS -delete"

echo "backup synced: $backup_name"
