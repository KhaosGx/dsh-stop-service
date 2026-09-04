# dsh-stop-service

[English](README.en.md) | 中文

> DeepSeek Harness (DSH) Web 设置页的「服务控制」分区：实时服务信息 + 带确认的优雅终止按钮，告别后台孤儿进程。

## 功能

- **实时服务信息**：进程 PID、启动时间、运行时长、活跃会话数、内存占用、CPU 占用、Node / DSH 宿主 / 插件版本、平台——每 5 秒自动刷新，附内存/CPU 趋势迷你图；CPU ≥ 80% 或内存 ≥ 1024 MB 时对应行高亮警示
- **更新提醒**：面板顶部对比 npm registry 最新版，DSH 宿主或插件有新版时提示并附升级命令（浏览器端直查 registry，宿主不外联）
- **复制诊断信息**：一键复制版本与运行状态摘要，提 issue 时直接粘贴
- 带**确认弹窗**的「终止服务」按钮：确认框显示将断开的活跃会话数；宿主进程收到 SIGTERM 优雅退出——会话落盘、端口释放，效果与在终端执行 `kill <pid>` 完全一致
- **服务回归自动刷新**：停止后持续探测，终端里重启完成时页面自动刷新接回
- 界面适配 `--dsw-*` 主题变量，跟随皮肤切换

## 兼容性

- DeepSeek Harness `>= 0.1.2-rc.1`（在 0.1.2-rc.1 实测）
- Web profile（`platform: web`）

## 安装

方式一（推荐）—— npm 直装：

```sh
dsh plugin --profile web add dsh-stop-service
```

方式二 —— GitHub 直装：

```sh
dsh plugin --profile web add github:KhaosGx/dsh-stop-service
```

方式三 —— 克隆后本地 link（适合参与开发）：

```sh
git clone https://github.com/KhaosGx/dsh-stop-service.git
cd dsh-stop-service
dsh plugin --profile web add link:$(pwd)
```

安装后重启 `dsh web`，面板位于 **设置 → 服务控制**。

## 工作原理

| 文件 | 职责 |
|---|---|
| `lib/index.js` | 宿主侧：注册三个仅限 loopback 的路由——`GET /health`（存活探测）、`GET /info`（服务与 profile 信息）、`POST /stop`（应答后 300ms 自发 SIGTERM） |
| `lib/client.js` | 浏览器侧：通过官方 `settings.section` 槽位注册设置分区与 React 组件；轮询 `/info` 渲染信息面板与趋势图，直查 npm dist-tags 显示更新横幅 |
| `cordis.patch.yml` | bundle 层自登记（`dsh.bundle.patch`） |

## 安全模型

- 路由仅接受**本机 loopback** 请求：socket 环回地址 + 环回 Host 头 + 浏览器同源标记三者齐备才放行；`X-Forwarded-For` 永不信任，其余一律 `403 forbidden: loopback-only`
- `stop` 仅接受 POST；动作等价于终端 `kill`，无额外能力，不做持久化；宿主进程不对外发起网络请求（更新检查由浏览器完成）

## 致谢

loopback 请求围栏的实现参考并改编自 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) 的 `dsh-client-ui-skill-explorer`（BSD 3-Clause, © 2026 zhu1090093659），其版权与许可声明保留于 [LICENSE](LICENSE) 的第三方声明部分。

## 许可

[MIT](LICENSE) © 2026 KhaosGx
