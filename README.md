# dsh-stop-service

A stop-service button for DeepSeek Harness (DSH) Web: one confirmed click gracefully terminates the running dsh host — no more orphaned background processes after closing a terminal. · 为 DeepSeek Harness (DSH) Web 提供「终止服务」按钮：一次带确认的点击即可优雅停止当前 dsh 宿主进程，告别关终端后残留的后台孤儿进程。

## 功能 / Features

- **实时服务信息**：进程 PID、启动时间、运行时长、内存占用、Node / DSH 宿主 / 插件版本、平台、已装载 bundles——每 5 秒自动刷新
- 带**确认弹窗**的「终止服务」按钮：宿主进程收到 SIGTERM 优雅退出——会话落盘、端口释放，效果与在终端执行 `kill <pid>` 完全一致
- 停止后页面显示重启指引（在终端运行 `npx @deepseek-ai/dsh web`，再刷新页面）
- 中英双语文案

- Live service info: PID, start time, uptime, memory, Node/DSH/plugin versions, platform, loaded bundles — auto-refreshed every 5s.
- Confirm-guarded stop button: SIGTERM graceful shutdown, identical to `kill <pid>` from a terminal.
- After stopping, the page shows restart instructions.

## 兼容性 / Compatibility

- DeepSeek Harness `>= 0.1.2-rc.1`（在 0.1.2-rc.1 实测 / verified on 0.1.2-rc.1）
- Web profile（`platform: web`）

## 安装 / Install

发布到 npm 后 / Once published to npm:

```sh
dsh plugin --profile web add dsh-stop-service
```

从源码安装 / From a Git checkout:

```sh
git clone https://github.com/KhaosGx/dsh-stop-service.git
cd dsh-stop-service
dsh plugin --profile web add link:$(pwd)
```

安装后重启 `dsh web`，按钮位于 **设置 → 服务控制**。/ Restart `dsh web`, then find it under **Settings → Service**.

## 工作原理 / How it works

| 文件 | 职责 |
|---|---|
| `lib/index.js` | 宿主侧：注册三个仅限 loopback 的路由——`GET /health`（存活探测）、`GET /info`（服务与 profile 信息）、`POST /stop`（应答后 300ms 自发 SIGTERM） |
| `lib/client.js` | 浏览器侧：通过官方 `settings.section` 槽位注册设置分区与 React 组件，确认弹窗 → POST stop → 显示重启指引 |
| `cordis.patch.yml` | bundle 层自登记（`dsh.bundle.patch`） |

## 安全模型 / Security

- 路由仅接受**本机 loopback** 请求：socket 环回地址 + 环回 Host 头 + 浏览器同源标记三者齐备才放行；`X-Forwarded-For` 永不信任，其余一律 `403 forbidden: loopback-only`
- `stop` 仅接受 POST；动作等价于终端 `kill`，无额外能力，不做持久化、不触网

## 致谢 / Attribution

loopback 请求围栏的实现参考并改编自 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) 的 `dsh-client-ui-skill-explorer`（BSD 3-Clause, © 2026 zhu1090093659），其版权与许可声明保留于 [LICENSE](LICENSE) 的第三方声明部分。

The loopback request fence is adapted from `dsh-client-ui-skill-explorer` by zhu1090093659 (BSD 3-Clause); see the third-party notice in [LICENSE](LICENSE).

## 许可 / License

[MIT](LICENSE) © 2026 KhaosGx
