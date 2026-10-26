Ubuntu 22.04 simple deployment
================================

1. Upload the extracted directory to /opt/weixin.
2. Run: cd /opt/weixin/mac-forward-console-ubuntu
3. On first start, the service creates /opt/weixin/mac-forward-console-config/.env.
4. Adjust that .env if needed. Keep DATA_DIR outside this code directory (default: /opt/weixin/mac-forward-console-data).
5. Run: pnpm install --frozen-lockfile
6. Run: chmod +x deploy/simple/start.sh deploy/simple/stop.sh
7. Start: ./deploy/simple/start.sh
6. Open: http://SERVER_IP:3000/
9. Logs: tail -f /opt/weixin/mac-forward-console-runtime/logs/web.log
10. Stop: ./deploy/simple/stop.sh

After replacing application files, run only:
  chmod +x deploy/simple/*.sh
  ./deploy/simple/restart.sh

Never delete DATA_DIR during an upgrade. Back it up before major changes.

The Ubuntu account running the service must be able to SSH into all Mac minis without a password.
