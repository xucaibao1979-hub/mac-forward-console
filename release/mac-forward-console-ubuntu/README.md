# 机器人中控台归档说明

本目录是机器人中控台的完整部署归档，适用于 Ubuntu 22.04 服务机器部署。

## 项目用途

机器人中控台用于通过 Web 页面集中管理 Mac mini 企业微信自动化转发任务，支持设备管理、群名管理、发送任务、磁盘清理、停止发送、用户权限、操作日志、SSO 免登和 SSL 部署。

## 目录结构

```text
app/                         Web 页面代码
executor/                    中央执行服务，负责保存数据、执行脚本、读取设备状态
public/                      页面图标和静态资源
deploy/simple/               简易启动、停止、重启和群名单同步脚本
deploy/systemd/              systemd 开机自启动和系统加固脚本
deploy/ssl/                  Nginx SSL 配置辅助脚本
deploy/sso/                  IT 小爱免登接入说明
deploy/ubuntu/               Mac mini 相关脚本模板
docs/                        部署、维护、操作和交接文档
.env.example                 服务配置模板
package.json                 Node.js 项目依赖和启动命令
pnpm-lock.yaml               依赖锁定文件
```

## 快速入口

- 部署文档：`docs/部署文档.md`
- 维护文档：`docs/维护文档.md`
- 操作手册：`docs/操作手册.md`
- 交接清单：`docs/交接清单.md`

## 重要原则

1. 程序代码目录和业务数据目录必须分开。
2. 更新代码时不要删除 `/opt/weixin/mac-forward-console-data`。
3. 设备脚本路径、群名单路径、用户权限等配置由 Web 页面维护，并持久化到数据目录。
4. Mac mini 端尽量不改动，服务机器通过免密 SSH 调用现有脚本。

