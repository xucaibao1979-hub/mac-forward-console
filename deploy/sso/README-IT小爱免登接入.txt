IT小爱免登接入说明
====================

一、管理员配置

1. 登录“机器人中控台”。
2. 进入：设置 -> 用户与权限。
3. 先给目标用户分配正确的角色和功能权限。
4. 点击该用户的“生成免登密钥”。
5. 密钥只显示一次，立即保存到 IT小爱服务端的密钥管理中，不要放在前端页面、URL、日志或聊天消息中。

如果密钥泄露，点击“吊销免登”；需要更换时点击“重置免登密钥”。

二、IT小爱换取一次性登录链接

请由 IT小爱的服务端调用：

POST https://bot.saybot.net/api/sso/ticket
Content-Type: application/json
X-Aura-SSO-Key: aura_sso_管理员生成的密钥

{}

成功返回示例：

{
  "loginUrl": "https://bot.saybot.net/?sso_token=一次性票据",
  "expiresIn": 60,
  "expiresAt": "2026-09-04T00:00:00.000Z"
}

IT小爱将用户的浏览器跳转到 loginUrl 即可完成登录。

三、安全规则

- 长期免登密钥只保存在 IT小爱服务端，不能下发给浏览器。
- loginUrl 中的票据 60 秒后失效，且只能使用一次。
- 用户的最终权限每次都从中控台当前配置读取；在中控台修改权限或吊销密钥后，后续免登立即受影响。
- 中控台数据库只保存密钥的 SHA-256 摘要，不保存可还原明文。
- 生成、换票、登录、失败和吊销操作都会记录到操作日志。

四、服务器配置

确保 /opt/weixin/mac-forward-console-config/.env 包含：

PUBLIC_HOST=bot.saybot.net
CONSOLE_ORIGIN=https://bot.saybot.net

更改后执行：

cd /opt/weixin/mac-forward-console-ubuntu
bash deploy/systemd/restart-service.sh

如果未来启用 Nginx Basic Auth，需要让 /api/sso/ticket 可由 IT小爱服务端访问，或在 IT小爱请求中同时配置 Basic Auth 凭据。
