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

		const InfoCard = ({ t }) => {
			const [info, setInfo] = react.useState(null);
			const [history, setHistory] = react.useState([]);
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

			react.useEffect(() => {
				let alive = true;
				const load = async () => {
					try {
						const res = await fetch("/api/dsh-stop-service/info");
						const data = await res.json();
						if (alive && data?.ok) {
							setInfo(data);
							if (typeof data.memoryRssMb === "number") {
								setHistory((prev) => [...prev, data.memoryRssMb].slice(-36));
							}
						}
					} catch {
						// Host unreachable (e.g. stopping); keep the last snapshot.
					}
				};
				load();
				const timer = window.setInterval(load, 5000);
				return () => {
					alive = false;
					window.clearInterval(timer);
				};
			}, []);

			if (info === null) {
				return jsx("p", { style: { fontSize: 13, opacity: 0.6 }, children: t("loading") });
			}

			const rows = [
				[t("infoPid"), String(info.pid)],
				[t("infoStartedAt"), new Date(info.startedAt).toLocaleString()],
				[t("infoUptime"), formatUptime(info.uptimeMs, t)],
				[t("infoSessions"), typeof info.sessionCount === "number" ? String(info.sessionCount) : "-"],
				[t("infoMemory"), `${info.memoryRssMb} MB`],
				[t("infoCpu"), typeof info.cpuPercent === "number" ? `${info.cpuPercent}%` : "-"],
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
				...rows.map(([label, value]) => jsx("div", { style: rowStyle, children: [
					jsx("span", { style: labelStyle, children: label }),
					jsx("span", { style: valueStyle, children: value })
				] }, label)),
				history.length >= 2
					? jsx("div", { key: "sparkline", style: { marginTop: 10 }, children: [
							jsx("div", { key: "label", style: { fontSize: 11, opacity: 0.55, marginBottom: 4 }, children: `${t("memTrend")} (${history.length * 5}s)` }),
							jsx("svg", {
								key: "svg",
								width: "100%",
								height: 28,
								viewBox: "0 0 100 28",
								preserveAspectRatio: "none",
								style: { display: "block" },
								children: jsx("polyline", {
									points: (() => {
										const min = Math.min(...history);
										const max = Math.max(...history);
										const span = max - min || 1;
										const step = 100 / (history.length - 1);
										return history
											.map((v, i) => `${(i * step).toFixed(1)},${(25 - ((v - min) / span) * 22).toFixed(1)}`)
											.join(" ");
									})(),
									fill: "none",
									stroke: "var(--dsw-accent, #4a90d9)",
									strokeWidth: 1.4,
									vectorEffect: "non-scaling-stroke"
								})
							})
						] })
					: null,
			]
		});
	};

		const StopCard = ({ t }) => {
			const [state, setState] = react.useState("idle");

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
					border: "1px solid var(--dsw-border, #ddd)",
					borderRadius: 10,
					padding: 20,
				},
				children: [
					jsx("h3", {
						key: "title",
						style: { margin: "0 0 8px", fontSize: 15 },
						children: t("title")
					}),
					jsx("p", {
						key: "desc",
						style: { margin: "0 0 4px", fontSize: 13, opacity: 0.85, lineHeight: 1.7 },
						children: t("desc")
					}),
					jsx("p", {
						key: "hint",
						style: { margin: "0 0 16px", fontSize: 12, opacity: 0.6, lineHeight: 1.7 },
						children: t("hint")
					}),
					jsx("button", {
						key: "button",
						onClick: onStop,
						disabled: state === "stopping",
						style: {
							padding: "8px 18px",
							fontSize: 13,
							borderRadius: 8,
							border: "1px solid #d33",
							background: state === "stopping" ? "transparent" : "#d33",
							color: state === "stopping" ? "#d33" : "#fff",
							cursor: state === "stopping" ? "default" : "pointer",
						},
						children: state === "stopping" ? t("stopping") : t("stop")
					}),
				]
			});
		};

		const StopServiceTab = ({ t }) => {
			return jsx("div", {
				style: { padding: "24px 8px", maxWidth: 560 },
				children: [
					jsx(InfoCard, { key: "info", t: t }),
					jsx(StopCard, { key: "stop", t: t }),
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
					infoNode: "Node 版本",
					infoHostVersion: "DSH 宿主版本",
					infoPluginVersion: "插件版本",
					infoPlatform: "平台",
					dayUnit: "天",
					hourUnit: "小时",
					minUnit: "分",
					secUnit: "秒",
					title: "终止服务",
					desc: "优雅停止当前 DeepSeek Harness 宿主进程（SIGTERM，与终端 kill 相同）：会话落盘、端口释放，不会留下后台孤儿进程。",
					hint: "停止后需要重启：在终端运行 npx @deepseek-ai/dsh web，然后刷新本页。",
					stop: "终止服务",
					stopping: "正在停止…",
					confirm: "确定要终止当前 DeepSeek Harness 服务吗？所有会话将断开（已保存的会话不受影响）。",
					confirmN: "确定要终止当前 DeepSeek Harness 服务吗？{n} 个活跃会话将断开（已保存的会话不受影响）。",
					stopped: "服务已停止。\n\n重启方法：在终端运行 npx @deepseek-ai/dsh web，然后刷新本页面。"
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
					infoNode: "Node",
					infoHostVersion: "DSH host",
					infoPluginVersion: "Plugin",
					infoPlatform: "Platform",
					dayUnit: "d ",
					hourUnit: "h ",
					minUnit: "m ",
					secUnit: "s",
					title: "Stop Service",
					desc: "Gracefully stops the current DeepSeek Harness host process (SIGTERM, same as a terminal kill): sessions flush and the port is released — no orphaned background process.",
					hint: "To start it again, run npx @deepseek-ai/dsh web in a terminal, then reload this page.",
					stop: "Stop Service",
					stopping: "Stopping…",
					confirm: "Stop the current DeepSeek Harness service? All sessions disconnect (saved sessions are unaffected).",
					confirmN: "Stop the current DeepSeek Harness service? {n} active sessions will disconnect (saved sessions are unaffected).",
					stopped: "Service stopped.\n\nTo restart: run npx @deepseek-ai/dsh web in a terminal, then reload this page."
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
