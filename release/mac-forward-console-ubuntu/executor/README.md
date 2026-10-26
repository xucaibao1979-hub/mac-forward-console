# 中央执行服务

该服务必须运行在能够免密 SSH 登录三台 Mac mini 的电脑上。它只监听本机地址，负责设备状态采集、脚本执行、定时任务和审计记录。

启动：`pnpm executor`

可选环境变量：

- `EXECUTOR_PORT`：默认 `8787`
- `EXECUTOR_TOKEN`：接口访问令牌；生产使用时必须设置
- `CONSOLE_ORIGIN`：允许访问接口的控制台地址，默认 `http://localhost:3000`

数据保存在 `executor/data/state.json`，该目录不应提交到代码仓库。
