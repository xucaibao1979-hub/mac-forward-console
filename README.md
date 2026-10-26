# 机器人中控台

通过 Web 页面集中管理 Mac mini 企业微信转发、群名列表、设备脚本、定时任务、用户权限与操作日志。

## 项目结构

- `app/`：Web 页面。
- `executor/`：中央执行服务。
- `deploy/`：Ubuntu 部署、开机自启、SSL、备份及同步脚本。
- `release/mac-forward-console-ubuntu/`：Ubuntu 部署交付目录。
- `.env.example`：环境配置模板，实际配置与持久化数据应放在程序发布目录之外。

## 部署与维护

- [部署文档](release/mac-forward-console-ubuntu/docs/部署文档.md)
- [维护文档](release/mac-forward-console-ubuntu/docs/维护文档.md)
- [操作手册](release/mac-forward-console-ubuntu/docs/操作手册.md)
- [架构说明](release/mac-forward-console-ubuntu/docs/架构说明.md)
- [功能图](release/mac-forward-console-ubuntu/docs/功能图.md)
- [交接清单](release/mac-forward-console-ubuntu/docs/交接清单.md)

服务器上单独维护的机器人脚本与运行数据，请按部署文档另行备份。本仓库记录当前本地项目文件。
