机器人中控台：Ubuntu 22.04 系统加固与开机启动

一、首次启用开机自启动
cd /opt/weixin/mac-forward-console-ubuntu
chmod +x deploy/systemd/*.sh
bash deploy/systemd/install-service.sh

二、执行基础系统加固
bash deploy/systemd/harden-ubuntu.sh

三、以后每次替换代码后的重启方式
bash deploy/systemd/restart-service.sh

四、查看运行状态
systemctl status mac-forward-executor mac-forward-web nginx

五、查看最近日志
journalctl -u mac-forward-executor -u mac-forward-web -n 100 --no-pager

六、常用操作
systemctl restart mac-forward-executor mac-forward-web
systemctl stop mac-forward-executor mac-forward-web
systemctl start mac-forward-executor mac-forward-web

说明：
1. Web服务和执行服务均设置为开机启动、异常退出自动重启。
2. 执行服务继续使用服务器现有root身份和SSH免密密钥，以便调用三台Mac mini。
3. 加固脚本不会关闭SSH密码登录，避免远程管理被意外锁死。
4. 防火墙仅开放SSH和HTTP 80端口，3000及8787继续只监听本机。
