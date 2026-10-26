#!/usr/bin/env bash

set -Eeuo pipefail

BASE_DIR="/opt/weixin/zf/twsend/2106"
TARGET="test@192.168.2.106"
REMOTE_HOME="/Users/test"
REMOTE_PYTHON="/Library/Frameworks/Python.framework/Versions/3.8/bin/python3"
GROUP_LIST="${RUNTIME_GROUP_FILE:-$BASE_DIR/list/schoollist.txt}"
SEND_MODE="${SEND_MODE:-local}"
SEND_MESSAGE_NAME="${SEND_MESSAGE_NAME:-}"
SEND_MESSAGE_CONTENT="${SEND_MESSAGE_CONTENT:-}"
FORWARD_BATCH_SIZE="${FORWARD_BATCH_SIZE:-9}"

encode_base64() {
  printf '%s' "$1" | base64 | tr -d '\r\n'
}

if [ ! -f "$GROUP_LIST" ]; then
  echo "群名文件不存在：$GROUP_LIST" >&2
  exit 1
fi

if [ ! -f "$BASE_DIR/cs.py" ]; then
  echo "发送程序不存在：$BASE_DIR/cs.py" >&2
  exit 1
fi

if [ "$SEND_MODE" = "select" ] && [ -z "$SEND_MESSAGE_CONTENT" ]; then
  echo "指定文本内容为空，请先在Web页面维护发送信息内容" >&2
  exit 1
fi

if ! [[ "$FORWARD_BATCH_SIZE" =~ ^[1-9][0-9]*$ ]]; then
  echo "图文转发每批群数必须是大于0的整数：$FORWARD_BATCH_SIZE" >&2
  exit 1
fi

echo "发送设备：$TARGET"
echo "群名来源：${GROUP_ENVIRONMENT:-production}"
echo "生效群名文件：$GROUP_LIST"
echo "发送方式：$SEND_MODE"
echo "图文转发每批群数：$FORWARD_BATCH_SIZE"

scp "$GROUP_LIST" "$TARGET:$REMOTE_HOME/schoollist.txt"

ssh "$TARGET" '"/Library/Application Support/VMware Tools/vmware-resolutionSet" 1280 850' || true

MODE_B64="$(encode_base64 "$SEND_MODE")"
NAME_B64="$(encode_base64 "$SEND_MESSAGE_NAME")"
CONTENT_B64="$(encode_base64 "$SEND_MESSAGE_CONTENT")"

cat "$BASE_DIR/cs.py" | ssh "$TARGET" \
  "SEND_MODE_B64='$MODE_B64' SEND_MESSAGE_NAME_B64='$NAME_B64' SEND_MESSAGE_CONTENT_B64='$CONTENT_B64' FORWARD_BATCH_SIZE='$FORWARD_BATCH_SIZE' '$REMOTE_PYTHON' -"
