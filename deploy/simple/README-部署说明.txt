Ubuntu 22.04 简易部署
====================

1. 将整个目录上传到服务器，例如：/opt/weixin
2. 进入目录：cd /opt/weixin
3. 安装依赖：pnpm install --frozen-lockfile
4. 添加执行权限：chmod +x deploy/simple/start.sh deploy/simple/stop.sh
5. 启动：./deploy/simple/start.sh
6. 访问：http://服务器IP:3000/
7. 查看日志：tail -f logs/web.log 或 tail -f logs/executor.log
8. 停止：./deploy/simple/stop.sh

运行服务的Ubuntu账号必须能够免密SSH登录三台Mac mini。
