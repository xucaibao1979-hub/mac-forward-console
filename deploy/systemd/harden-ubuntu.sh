#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 用户执行此脚本" >&2
  exit 1
fi

echo "[1/6] 安装基础安全组件"
export DEBIAN_FRONTEND=noninteractive
apt-get -o DPkg::Lock::Timeout=300 update
apt-get -o DPkg::Lock::Timeout=300 install -y ufw fail2ban unattended-upgrades apt-listchanges

echo "[2/6] 配置防火墙"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[3/6] 配置SSH登录防护"
install -d -m 755 /etc/fail2ban/jail.d
printf '%s\n' \
  '[sshd]' \
  'enabled = true' \
  'maxretry = 5' \
  'findtime = 10m' \
  'bantime = 1h' \
  > /etc/fail2ban/jail.d/mac-forward-console.conf
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "[4/6] 启用自动安全更新"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now apt-daily.timer apt-daily-upgrade.timer

echo "[5/6] 应用安全内核参数"
cat > /etc/sysctl.d/99-mac-forward-console-hardening.conf <<'EOF'
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
EOF
sysctl --system >/dev/null

echo "[6/6] 收紧程序配置权限和Nginx信息暴露"
install -d -m 700 /opt/weixin/mac-forward-console-config /opt/weixin/mac-forward-console-data
install -d -m 750 /opt/weixin/mac-forward-console-runtime
[[ ! -f /opt/weixin/mac-forward-console-config/.env ]] || chmod 600 /opt/weixin/mac-forward-console-config/.env
[[ ! -f /opt/weixin/mac-forward-console-data/state.json ]] || chmod 600 /opt/weixin/mac-forward-console-data/state.json
printf '%s\n' 'server_tokens off;' > /etc/nginx/conf.d/00-security.conf
nginx -t
systemctl reload nginx

echo
echo "基础加固完成。SSH密码登录未被关闭，现有免密连接不受影响。"
echo "防火墙状态："
ufw status verbose
echo "登录防护状态："
fail2ban-client status sshd || true
