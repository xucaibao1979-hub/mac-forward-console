#!/usr/bin/env bash

set -Eeuo pipefail

BASE_DIR="/opt/weixin/zf/twsend/2104"
TARGET="admin@192.168.2.104"
REMOTE_HOME="/Users/admin"
REMOTE_PYTHON="/Library/Frameworks/Python.framework/Versions/3.8/bin/python3"
GROUP_LIST="${RUNTIME_GROUP_FILE:-$BASE_DIR/list/schoollist.txt}"
MESSAGE_CONTENT="${SEND_MESSAGE_CONTENT:-}"

encode_base64() {
  printf '%s' "$1" | base64 | tr -d '\r\n'
}

if [ ! -f "$GROUP_LIST" ]; then
  echo "群名文件不存在：$GROUP_LIST" >&2
  exit 1
fi

if [ ! -f "$BASE_DIR/text.py" ]; then
  echo "文本发送程序不存在：$BASE_DIR/text.py" >&2
  exit 1
fi

if [ -z "$MESSAGE_CONTENT" ]; then
  echo "发送文本为空，请先在Web页面维护发送信息内容" >&2
  exit 1
fi

echo "文本发送设备：$TARGET"
echo "群名来源：${GROUP_ENVIRONMENT:-production}"
echo "群名文件：$GROUP_LIST"
echo "文本名称：${SEND_MESSAGE_NAME:-未命名}"

scp "$GROUP_LIST" "$TARGET:$REMOTE_HOME/schoollist.txt"
ssh "$TARGET" '"/Library/Application Support/VMware Tools/vmware-resolutionSet" 1280 850' || true

CONTENT_B64="$(encode_base64 "$MESSAGE_CONTENT")"

cat "$BASE_DIR/text.py" | ssh "$TARGET" \
  "SEND_MESSAGE_CONTENT_B64='$CONTENT_B64' '$REMOTE_PYTHON' -"
