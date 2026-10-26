#!/usr/bin/env bash
set -Eeuo pipefail

app_dir="/opt/weixin/mac-forward-console-ubuntu"
config_file="/opt/weixin/mac-forward-console-config/.env"
ssl_dir="/opt/weixin/mac-forward-console-config/ssl"
nginx_file="/etc/nginx/conf.d/00-mac-forward-console.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 用户执行此脚本" >&2
  exit 1
fi
if [[ ! -f "$config_file" ]]; then
  echo "配置文件不存在：$config_file" >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "没有找到 openssl，请先安装：apt install openssl" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$config_file"
set +a

server_name="${1:-${PUBLIC_HOST:-192.168.1.77}}"
if [[ -z "$server_name" ]]; then
  echo "请指定服务器IP或域名，例如：bash $0 192.168.1.77" >&2
  exit 1
fi

install -d -m 700 "$ssl_dir"

if [[ ! -f "$ssl_dir/aura-internal-ca.key" || ! -f "$ssl_dir/aura-internal-ca.crt" ]]; then
  echo "正在创建内部根证书……"
  openssl genrsa -out "$ssl_dir/aura-internal-ca.key" 4096
  openssl req -x509 -new -sha256 -days 3650 \
    -key "$ssl_dir/aura-internal-ca.key" \
    -out "$ssl_dir/aura-internal-ca.crt" \
    -subj "/C=CN/O=AURA Controls/OU=Internal IT/CN=AURA Controls Internal CA" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -addext "subjectKeyIdentifier=hash"
fi

if [[ "$server_name" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  san_line="IP.1 = $server_name"
else
  san_line="DNS.1 = $server_name"
fi

cat > "$ssl_dir/server-cert.conf" <<EOF
[req]
distinguished_name = dn
prompt = no

[dn]
C = CN
O = AURA Controls
OU = Robot Console
CN = $server_name

[v3_req]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
$san_line
EOF

echo "正在签发服务器证书：$server_name"
openssl genrsa -out "$ssl_dir/server.key" 3072
openssl req -new \
  -key "$ssl_dir/server.key" \
  -out "$ssl_dir/server.csr" \
  -config "$ssl_dir/server-cert.conf"
openssl x509 -req -sha256 -days 397 \
  -in "$ssl_dir/server.csr" \
  -CA "$ssl_dir/aura-internal-ca.crt" \
  -CAkey "$ssl_dir/aura-internal-ca.key" \
  -CAcreateserial \
  -out "$ssl_dir/server.crt" \
  -extensions v3_req \
  -extfile "$ssl_dir/server-cert.conf"

chmod 600 "$ssl_dir/aura-internal-ca.key" "$ssl_dir/server.key"
chmod 644 "$ssl_dir/aura-internal-ca.crt" "$ssl_dir/server.crt"

cat > "$nginx_file" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $server_name;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $server_name;

    ssl_certificate $ssl_dir/server.crt;
    ssl_certificate_key $ssl_dir/server.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:AURA_SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
    }
}
EOF

if grep -q '^CONSOLE_ORIGIN=' "$config_file"; then
  sed -i "s#^CONSOLE_ORIGIN=.*#CONSOLE_ORIGIN=https://$server_name#" "$config_file"
else
  printf '\nCONSOLE_ORIGIN=https://%s\n' "$server_name" >> "$config_file"
fi
if grep -q '^PUBLIC_HOST=' "$config_file"; then
  sed -i "s#^PUBLIC_HOST=.*#PUBLIC_HOST=$server_name#" "$config_file"
else
  printf 'PUBLIC_HOST=%s\n' "$server_name" >> "$config_file"
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow 443/tcp
fi

nginx -t
systemctl reload nginx
if systemctl is-active --quiet mac-forward-executor.service mac-forward-web.service; then
  systemctl restart mac-forward-executor.service mac-forward-web.service
else
  bash "$app_dir/deploy/simple/stop.sh"
  bash "$app_dir/deploy/simple/start.sh"
fi

echo
echo "HTTPS 已启用：https://$server_name/"
echo "客户端需信任内部根证书：$ssl_dir/aura-internal-ca.crt"
echo "证书有效期："
openssl x509 -in "$ssl_dir/server.crt" -noout -dates -subject -ext subjectAltName
