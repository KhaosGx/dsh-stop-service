// SPDX-License-Identifier: MIT
// Copyright (c) 2026 KhaosGx

/**
 * Browser side of dsh-stop-service.
 *
 * Adds a top-level "服务控制 / Service" section to Settings showing live
 * service info (PID, versions, uptime, memory, loaded bundles) and a
 * confirm-guarded stop button. The button POSTs /api/dsh-stop-service/stop;
 * the host replies, then SIGTERMs itself. After the host dies this page
 * keeps running in the browser and shows the restart hint.
 */
window.__ModuleLoader__.load({
	id: "dsh-stop-service",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");
		var jsx_runtime = require("react/jsx-runtime");
		const jsx = jsx_runtime.jsx;

		/** Dictionary namespace owned by this plugin. */
		const NS = "stopService";
		/** Client services required by the settings registration. */
		const inject = [
			"slots",
			"locale"
		];

		const rowStyle = {
			display: "flex",
			justifyContent: "space-between",
			gap: 16,
			padding: "6px 0",
			fontSize: 13,
			borderBottom: "1px solid var(--dsw-border, rgba(128,128,128,0.18))",
		};
		const labelStyle = { opacity: 0.65, flexShrink: 0 };
		const valueStyle = {
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			textAlign: "right",
			wordBreak: "break-all",
		};
		/** Theme-aware card frame; fallbacks keep it legible on any theme. */
		const cardStyle = {
			border: "1px solid var(--dsw-border, rgba(128,128,128,0.28))",
			borderRadius: 10,
			padding: 20,
			background: "var(--dsw-card-bg, transparent)",
		};

		function formatUptime(ms, t) {
			const s = Math.floor(ms / 1000);
			const d = Math.floor(s / 86400);
			const h = Math.floor((s % 86400) / 3600);
			const m = Math.floor((s % 3600) / 60);
			const sec = s % 60;
			if (d > 0) return `${d}${t("dayUnit")}${h}${t("hourUnit")}`;
			if (h > 0) return `${h}${t("hourUnit")}${m}${t("minUnit")}`;
			if (m > 0) return `${m}${t("minUnit")}${sec}${t("secUnit")}`;
			return `${sec}${t("secUnit")}`;
		}

		/** Normalize values into a 100x28 viewBox polyline. */
		function sparklinePoints(values) {
			const min = Math.min(...values);
			const max = Math.max(...values);
			const span = max - min || 1;
			const step = 100 / (values.length - 1);
			return values
				.map((v, i) => `${(i * step).toFixed(1)},${(25 - ((v - min) / span) * 22).toFixed(1)}`)
				.join(" ");
		}

		/** One labeled sparkline; renders nothing before two samples exist. */
		const TrendChart = ({ label, values }) => values.length >= 2
			? jsx("div", { style: { marginTop: 10 }, children: [
					jsx("div", { style: { fontSize: 11, opacity: 0.55, marginBottom: 4 }, children: label }),
					jsx("svg", {
						width: "100%",
						height: 28,
						viewBox: "0 0 100 28",
						preserveAspectRatio: "none",
						style: { display: "block" },
						children: jsx("polyline", {
							points: sparklinePoints(values),
							fill: "none",
							stroke: "var(--dsw-accent, #4a90d9)",
							strokeWidth: 1.4,
							vectorEffect: "non-scaling-stroke"
						})
					})
				] })
			: null;

		const InfoCard = ({ t, info, history, cpuHistory }) => {
			const [copied, setCopied] = react.useState(false);

			const copyDiagnostics = async () => {
				if (info === null) return;
				const lines = [
					`DSH host: ${info.hostVersion ?? "-"}`,
					`Plugin: dsh-stop-service ${info.pluginVersion ?? "-"}`,
					`Node: ${info.node ?? "-"}`,
					`Platform: ${info.platform ?? "-"}`,
					`PID: ${info.pid} · Uptime: ${formatUptime(info.uptimeMs, t)}`,
					`Memory (RSS): ${info.memoryRssMb} MB · CPU: ${typeof info.cpuPercent === "number" ? `${info.cpuPercent}%` : "-"} · Sessions: ${typeof info.sessionCount === "number" ? info.sessionCount : "-"}`,
				];
				try {
					await navigator.clipboard.writeText(lines.join("\n"));
					setCopied(true);
					window.setTimeout(() => setCopied(false), 2000);
				} catch {
					// Clipboard denied; ignore.
				}
			};

			if (info === null) {
				return jsx("p", { style: { fontSize: 13, opacity: 0.6 }, children: t("loading") });
			}

			/** Display thresholds for the warning highlight. */
			const CPU_WARN_PERCENT = 80;
			const MEM_WARN_MB = 1024;

			const rows = [
				[t("infoPid"), String(info.pid)],
				[t("infoStartedAt"), new Date(info.startedAt).toLocaleString()],
				[t("infoUptime"), formatUptime(info.uptimeMs, t)],
				[t("infoSessions"), typeof info.sessionCount === "number" ? String(info.sessionCount) : "-"],
				[t("infoMemory"), `${info.memoryRssMb} MB`, info.memoryRssMb >= MEM_WARN_MB],
				[t("infoCpu"), typeof info.cpuPercent === "number" ? `${info.cpuPercent}%` : "-", typeof info.cpuPercent === "number" && info.cpuPercent >= CPU_WARN_PERCENT],
				[t("infoNode"), info.node ?? "-"],
				[t("infoHostVersion"), info.hostVersion ?? "-"],
				[t("infoPluginVersion"), info.pluginVersion ?? "-"],
				[t("infoPlatform"), info.platform ?? "-"],
			];

			return jsx("div", {
				style: { marginBottom: 20 },
				children: [
					jsx("div", {
						key: "header",
						style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
						children: [
							jsx("h3", {
								key: "title",
								style: { margin: 0, fontSize: 15 },
								children: t("infoTitle")
							}),
							jsx("button", {
								key: "copy",
								onClick: copyDiagnostics,
								style: {
									padding: "4px 12px",
									fontSize: 12,
									borderRadius: 7,
									border: "1px solid var(--dsw-border, rgba(128,128,128,0.35))",
									background: "transparent",
									color: "inherit",
									cursor: "pointer",
								},
								children: copied ? t("copied") : t("copyDiag")
							})
						]
					}),
				...rows.map(([label, value, warn]) => jsx("div", { style: rowStyle, children: [
					jsx("span", { style: labelStyle, children: label }),
					jsx("span", {
						style: warn === true
							? { ...valueStyle, color: "var(--dsw-danger, #d33)", fontWeight: 600 }
							: valueStyle,
						children: value
					})
				] }, label)),
				jsx(TrendChart, {
					key: "mem-chart",
					label: `${t("memTrend")} (${history.length * 5}s)`,
					values: history
				}),
				jsx(TrendChart, {
					key: "cpu-chart",
					label: `${t("cpuTrend")} (${cpuHistory.length * 5}s)`,
					values: cpuHistory
				}),
			]
		});
	};

		const StopCard = ({ t, onLocalStop }) => {
			const [state, setState] = react.useState("idle");

			// After the host dies, watch for its successor and auto-reload so the
			// user does not have to refresh manually after restarting the service.
			react.useEffect(() => {
				if (state !== "stopped") return;
				let watching = true;
				const probe = async () => {
					try {
						const res = await fetch("/api/dsh-stop-service/health");
						if (!watching) return;
						if (res.ok) window.location.reload();
					} catch {
						// Still down; keep watching.
					}
				};
				const timer = window.setInterval(probe, 2000);
				return () => {
					watching = false;
					window.clearInterval(timer);
				};
			}, [state]);

		const onStop = async () => {
			// One-shot info fetch so the confirmation can name the live session count.
			let confirmText = t("confirm");
			try {
				const res = await fetch("/api/dsh-stop-service/info");
				const data = await res.json();
				if (data?.ok && typeof data.sessionCount === "number") {
					confirmText = t("confirmN").replace("{n}", String(data.sessionCount));
				}
			} catch {
				// Info unavailable; fall back to the generic confirmation.
			}
			if (!window.confirm(confirmText)) return;
				if (typeof onLocalStop === "function") onLocalStop();
				setState("stopping");
				try {
					await fetch("/api/dsh-stop-service/stop", { method: "POST" });
				} catch {
					// The host dies right after replying; a network error here
					// still means the stop request went through.
				}
				setState("stopped");
			};

			if (state === "stopped") {
				return jsx("p", {
					style: { fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-line" },
					children: t("stopped")
				});
			}

			return jsx("div", {
				style: {
					...cardStyle,
					padding: "12px 16px",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					gap: 16,
					marginBottom: 20,
					flexWrap: "wrap",
				},
				children: [
					jsx("span", {
						key: "desc",
						style: { fontSize: 12.5, opacity: 0.8, lineHeight: 1.6 },
						children: t("stopRowDesc")
					}),
					jsx("button", {
						key: "button",
						onClick: onStop,
						disabled: state === "stopping",
						style: {
							padding: "7px 16px",
							fontSize: 13,
							borderRadius: 8,
							flexShrink: 0,
							border: "1px solid var(--dsw-danger, #d33)",
							background: state === "stopping" ? "transparent" : "var(--dsw-danger, #d33)",
							color: state === "stopping" ? "var(--dsw-danger, #d33)" : "var(--dsw-danger-text, #fff)",
							cursor: state === "stopping" ? "default" : "pointer",
						},
						children: state === "stopping" ? t("stopping") : t("stop")
					}),
				]
			});
		};

		/** Compare prerelease strings per semver: dot-split identifiers, numeric
		 * identifiers compared as numbers and always lower than alphanumeric,
		 * a shared prefix means the longer set is higher. */
		function comparePrerelease(a, b) {
			const x = a.split(".");
			const y = b.split(".");
			for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
				const xn = /^\d+$/.test(x[i]);
				const yn = /^\d+$/.test(y[i]);
				let diff;
				if (xn && yn) diff = Number(x[i]) - Number(y[i]);
				else if (xn) diff = -1;
				else if (yn) diff = 1;
				else diff = x[i] < y[i] ? -1 : x[i] > y[i] ? 1 : 0;
				if (diff !== 0) return diff > 0 ? 1 : -1;
			}
			return x.length === y.length ? 0 : x.length < y.length ? -1 : 1;
		}

		/** Minimal semver compare (numeric fields; release outranks prerelease; prerelease compared per semver; unknown → 0). */
		function compareVersion(a, b) {
			const pattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
			const pa = pattern.exec(String(a ?? ""));
			const pb = pattern.exec(String(b ?? ""));
			if (pa === null || pb === null) return 0;
			for (let i = 1; i <= 3; i += 1) {
				const diff = Number(pa[i]) - Number(pb[i]);
				if (diff !== 0) return diff > 0 ? 1 : -1;
			}
			if (pa[4] === pb[4]) return 0;
			if (pa[4] === undefined) return 1;
			if (pb[4] === undefined) return -1;
			return comparePrerelease(pa[4], pb[4]);
		}

		/**
		 * Update banner: compares local host/plugin versions (from /info) against
		 * the npm registry's public dist-tags, queried directly from the browser.
		 * Offline-tolerant — the banner simply stays hidden.
		 */
		const UpdateBanner = ({ t, info }) => {
			const [lines, setLines] = react.useState(null);

			react.useEffect(() => {
				if (info === null) return;
				let alive = true;
				(async () => {
					let hostLatest = null;
					let pluginLatest = null;
					try {
						const res = await fetch("https://registry.npmjs.org/-/package/@deepseek-ai/dsh/dist-tags");
						if (res.ok) {
							const tags = await res.json();
							if (typeof tags?.latest === "string") hostLatest = tags.latest;
						}
					} catch {
						// Registry unreachable; hide the banner.
					}
					try {
						const res = await fetch("https://registry.npmjs.org/-/package/dsh-stop-service/dist-tags");
						if (res.ok) {
							const tags = await res.json();
							if (typeof tags?.latest === "string") pluginLatest = tags.latest;
						}
					} catch {
						// Registry unreachable; hide the banner.
					}
					if (!alive) return;
					const found = [];
					if (hostLatest !== null && info.hostVersion && compareVersion(hostLatest, info.hostVersion) > 0) {
						found.push(t("updHost").replace("{v}", hostLatest).replace("{c}", info.hostVersion));
					}
					if (pluginLatest !== null && info.pluginVersion && compareVersion(pluginLatest, info.pluginVersion) > 0) {
						found.push(t("updPlugin").replace("{v}", pluginLatest).replace("{c}", info.pluginVersion));
					}
					if (found.length > 0) setLines(found);
				})();
				return () => {
					alive = false;
				};
			}, [info === null ? null : info.hostVersion, info === null ? null : info.pluginVersion]);

			if (lines === null) return null;
			return jsx("div", {
				style: {
					border: "1px solid var(--dsw-accent, #4a90d9)",
					borderRadius: 10,
					padding: "10px 14px",
					marginBottom: 16,
					fontSize: 13,
					lineHeight: 1.7,
				},
				children: lines.map((line) => jsx("p", { style: { margin: 0 }, children: line }, line))
			});
		};

		const StopServiceTab = ({ t }) => {
			const [info, setInfo] = react.useState(null);
			const [history, setHistory] = react.useState([]);
			const [cpuHistory, setCpuHistory] = react.useState([]);
			// First poll-failure time; the tick re-renders per failed poll so the
			// displayed snapshot age keeps advancing.
			const [stale, setStale] = react.useState(null);
			const [localStop, setLocalStop] = react.useState(false);

			react.useEffect(() => {
				let alive = true;
				const load = async () => {
					try {
						const res = await fetch("/api/dsh-stop-service/info");
						const data = await res.json();
						if (alive && res.ok && data?.ok) {
							setInfo(data);
							setStale(null);
							if (typeof data.memoryRssMb === "number") {
								setHistory((prev) => [...prev, data.memoryRssMb].slice(-36));
							}
							if (typeof data.cpuPercent === "number") {
								setCpuHistory((prev) => [...prev, data.cpuPercent].slice(-36));
							}
						} else if (alive) {
							setStale((prev) => ({ since: prev?.since ?? Date.now(), tick: (prev?.tick ?? 0) + 1 }));
						}
					} catch {
						// Host unreachable (e.g. stopping); keep the last snapshot
						// and surface how old it is.
						if (alive) setStale((prev) => ({ since: prev?.since ?? Date.now(), tick: (prev?.tick ?? 0) + 1 }));
					}
				};
				load();
				const timer = window.setInterval(load, 5000);
				return () => {
					alive = false;
					window.clearInterval(timer);
				};
			}, []);

			const staleSeconds = stale === null || localStop || info === null
				? null
				: Math.max(1, Math.round((Date.now() - stale.since) / 1000));

			return jsx("div", {
				style: { padding: "24px 8px", maxWidth: 560 },
				children: [
					staleSeconds === null ? null : jsx("div", {
						key: "stale",
						style: {
							border: "1px solid var(--dsw-danger, #d33)",
							borderRadius: 10,
							padding: "8px 14px",
							marginBottom: 16,
							fontSize: 12.5,
							lineHeight: 1.7,
							color: "var(--dsw-danger, #d33)",
						},
						children: t("staleData").replace("{s}", String(staleSeconds))
					}),
					jsx(UpdateBanner, { key: "updates", t: t, info: info }),
					jsx(StopCard, { key: "stop", t: t, onLocalStop: () => setLocalStop(true) }),
					jsx(InfoCard, { key: "info", t: t, info: info, history: history, cpuHistory: cpuHistory }),
				]
			});
		};

		/**
		 * Contribute the settings section.
		 * @param {any} ctx - client context carrying slots/locale.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh: {
					tab: "服务控制",
					infoTitle: "服务信息",
					copyDiag: "复制诊断信息",
					copied: "已复制 ✓",
					loading: "读取服务信息…",
					infoPid: "进程 PID",
					infoStartedAt: "启动时间",
					infoUptime: "运行时长",
					infoSessions: "活跃会话",
					infoMemory: "内存占用 (RSS)",
					infoCpu: "CPU 占用",
					memTrend: "内存趋势",
					cpuTrend: "CPU 趋势",
					infoNode: "Node 版本",
					infoHostVersion: "DSH 宿主版本",
					infoPluginVersion: "插件版本",
					infoPlatform: "平台",
					dayUnit: "天",
					hourUnit: "小时",
					minUnit: "分",
					secUnit: "秒",
					stopRowDesc: "优雅停止宿主进程（SIGTERM，与终端 kill 等效），不留孤儿进程。",
					updHost: "DSH 宿主有新版本 {v} 可用（当前 {c}），可在终端升级：npm install -g @deepseek-ai/dsh@{v}",
					updPlugin: "插件有新版本 {v} 可用（当前 {c}）：dsh plugin --profile web add dsh-stop-service@{v}",
					stop: "终止服务",
					stopping: "正在停止…",
					staleData: "连接中断：以下数据为 {s} 秒前的快照，正在重试…",
					confirm: "确定要终止当前 DeepSeek Harness 服务吗？所有会话将断开（已保存的会话不受影响），未发送的输入将丢失。",
					confirmN: "确定要终止当前 DeepSeek Harness 服务吗？{n} 个活跃会话将断开（已保存的会话不受影响），未发送的输入将丢失。",
					stopped: "服务已停止。\n\n重启方法：在终端运行 npx @deepseek-ai/dsh web。检测到服务重新启动后本页将自动刷新。"
				},
				en: {
					tab: "Service",
					infoTitle: "Service Info",
					copyDiag: "Copy diagnostics",
					copied: "Copied ✓",
					loading: "Loading service info…",
					infoPid: "PID",
					infoStartedAt: "Started at",
					infoUptime: "Uptime",
					infoSessions: "Active sessions",
					infoMemory: "Memory (RSS)",
					infoCpu: "CPU",
					memTrend: "Memory trend",
					cpuTrend: "CPU trend",
					infoNode: "Node",
					infoHostVersion: "DSH host",
					infoPluginVersion: "Plugin",
					infoPlatform: "Platform",
					dayUnit: "d ",
					hourUnit: "h ",
					minUnit: "m ",
					secUnit: "s",
					stopRowDesc: "Gracefully stop the host process (SIGTERM, like a terminal kill) — no orphaned processes.",
					updHost: "A newer DSH host {v} is available (current {c}) — upgrade from a terminal: npm install -g @deepseek-ai/dsh@{v}",
					updPlugin: "A newer plugin {v} is available (current {c}) — dsh plugin --profile web add dsh-stop-service@{v}",
					stop: "Stop Service",
					stopping: "Stopping…",
					staleData: "Connection lost: the data below is a snapshot from {s}s ago, retrying…",
					confirm: "Stop the current DeepSeek Harness service? All sessions disconnect (saved sessions are unaffected), unsent input is lost.",
					confirmN: "Stop the current DeepSeek Harness service? {n} active sessions will disconnect (saved sessions are unaffected), unsent input is lost.",
					stopped: "Service stopped.\n\nTo restart: run npx @deepseek-ai/dsh web in a terminal. This page reloads automatically once the service is back."
				}
			}), "stop-service: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "stop-service",
				order: 50,
				label: () => t("tab"),
				locale: NS,
				inject: () => ({ t })
			}, StopServiceTab)), "stop-service: settings section");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
