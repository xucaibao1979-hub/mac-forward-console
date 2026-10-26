#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 1 ]]; then
  echo "用法: $0 用户@Mac地址 [保留天数]" >&2
  exit 2
fi

target="$1"
keep_days="${2:-7}"

if ! [[ "$keep_days" =~ ^[0-9]+$ ]] || (( keep_days < 1 )); then
  echo "保留天数必须是大于0的整数" >&2
  exit 2
fi

echo "[$(date '+%F %T')] 开始清理 $target，保留最近 $keep_days 天文件"

ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 "$target" "KEEP_DAYS=$keep_days STEP_TIMEOUT=120 /bin/bash -s" <<'REMOTE'
set -Eeuo pipefail

before=$(df -k / | awk 'NR==2 {print $4}')
wecom_root="$HOME/Library/Containers/com.tencent.WeWorkMac/Data"

was_running=0
if pgrep -f '/企业微信.app/' >/dev/null 2>&1; then
  was_running=1
  echo "正在退出企业微信，避免清理过程中继续写入文件"
  osascript -e 'tell application "企业微信" to quit' >/dev/null 2>&1 || true
  sleep 3
fi

clean_directory() {
  label="$1"
  directory="$2"
  if [[ ! -d "$directory" ]]; then
    echo "跳过：$label（目录不存在）"
    return
  fi
  echo "正在清理：$label"
  find "$directory" -type f -mtime "+$KEEP_DAYS" -delete 2>/dev/null &
  find_pid=$!
  (
    sleep "$STEP_TIMEOUT"
    if kill -0 "$find_pid" 2>/dev/null; then
      echo "提示：$label 扫描超过 ${STEP_TIMEOUT} 秒，已跳过剩余文件"
      kill "$find_pid" 2>/dev/null || true
    fi
  ) &
  guard_pid=$!
  wait "$find_pid" 2>/dev/null || true
  kill "$guard_pid" 2>/dev/null || true
  wait "$guard_pid" 2>/dev/null || true
  echo "完成：$label"
}

if [[ ! -d "$wecom_root" ]]; then
  echo "未找到Mac版企业微信数据目录：$wecom_root" >&2
  exit 3
fi

# 企业微信群附件、图片、视频等通常位于每个 Profile 的 Caches 中。
# 按文件最后修改时间清理，保留最近 KEEP_DAYS 天内容。
profile_count=0
for profile_cache in "$wecom_root"/Documents/Profiles/*/Caches; do
  [[ -d "$profile_cache" ]] || continue
  profile_count=$((profile_count + 1))
  clean_directory "企业微信账号 ${profile_count} 的群附件及媒体缓存" "$profile_cache"
done

clean_directory "企业微信容器缓存" "$wecom_root/Library/Caches"
clean_directory "企业微信网页缓存" "$wecom_root/Library/WebKit"
clean_directory "企业微信临时文件" "$wecom_root/tmp"

if (( profile_count == 0 )); then
  echo "提示：未找到 Documents/Profiles/*/Caches，请确认当前企业微信版本的数据目录"
fi

# Messages1/Info.db、Session.db 等属于核心会话数据库，不能按日期安全拆分，
# 自动任务不直接删除，以免清空聊天记录、损坏索引或导致账号重新登录。
echo "核心会话数据库已保留；本次只清理可重新下载的附件和缓存"

after=$(df -k / | awk 'NR==2 {print $4}')
released=$((after-before))
printf '清理完成，释放约 %.2f GB，当前可用 %.2f GB\n' "$(awk "BEGIN {print $released/1048576}")" "$(awk "BEGIN {print $after/1048576}")"

if (( was_running == 1 )); then
  echo "正在重新启动企业微信"
  open -a '企业微信' >/dev/null 2>&1 || true
fi
REMOTE

echo "[$(date '+%F %T')] $target 清理完成"
