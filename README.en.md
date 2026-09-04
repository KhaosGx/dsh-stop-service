# dsh-stop-service

English | [中文](README.md)

> A "Service" section for DeepSeek Harness (DSH) Web settings: live service info plus a confirm-guarded graceful stop button — no more orphaned background processes.

## Features

- **Live service info**: PID, start time, uptime, active sessions, memory, CPU, Node / DSH host / plugin versions, platform — auto-refreshed every 5s, with memory/CPU sparklines; rows highlight when CPU ≥ 80% or memory ≥ 1024 MB
- **Update banner**: compares against npm dist-tags at the top of the panel and shows the upgrade command when a newer DSH host or plugin exists (queried from the browser — the host never phones out)
- **Copy diagnostics**: one click puts a clean version/runtime summary on your clipboard for issue reports
- **Connection status**: when the host stops responding, a banner names the snapshot age instead of silently showing stale data (a stop issued from this page does not trigger it)
- **Confirm-guarded stop button**: the confirmation names how many live sessions will disconnect; the host exits gracefully via SIGTERM — sessions flush and the port is released, identical to `kill <pid>` from a terminal
- **Auto-reload**: after stopping, the page watches for the restarted host and refreshes itself
- Theme-aware via `--dsw-*` tokens

## Compatibility

- DeepSeek Harness `>= 0.1.2-rc.1` (verified on 0.1.2-rc.1)
- Web profile (`platform: web`)

## Install

Option 1 (recommended) — npm:

```sh
dsh plugin --profile web add dsh-stop-service
```

Option 2 — GitHub direct:

```sh
dsh plugin --profile web add github:KhaosGx/dsh-stop-service
```

Option 3 — clone and link (for development):

```sh
git clone https://github.com/KhaosGx/dsh-stop-service.git
cd dsh-stop-service
dsh plugin --profile web add link:$(pwd)
```

Restart `dsh web` after installing, then find the panel under **Settings → Service**.

## How it works

| File | Role |
|---|---|
| `lib/index.js` | Host side: three loopback-only routes — `GET /health` (liveness), `GET /info` (service and profile info), `POST /stop` (acknowledge, then SIGTERM after 300ms) |
| `lib/client.js` | Browser side: registers the settings section via the official `settings.section` slot; polls `/info` for the info panel and sparklines, queries npm dist-tags directly for the update banner |
| `cordis.patch.yml` | Bundle self-registration (`dsh.bundle.patch`) |

## Security

- Routes accept **loopback-only** requests: a loopback socket address AND a loopback Host header AND browser same-origin markers must all hold; `X-Forwarded-For` is never trusted, everything else gets `403 forbidden: loopback-only`
- `stop` is POST-only; the action is equivalent to a terminal `kill` with no extra capabilities and no persistence; the host process makes no outbound network requests (update checks happen in the browser)

## Attribution

The loopback request fence is adapted from `dsh-client-ui-skill-explorer` by [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) (BSD 3-Clause, © 2026 zhu1090093659); see the third-party notice in [LICENSE](LICENSE).

## License

[MIT](LICENSE) © 2026 KhaosGx
