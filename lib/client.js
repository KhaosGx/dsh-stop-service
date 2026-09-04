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

			react.useEffect(() => {
				let alive = true;
				const load = async () => {
					try {
						const res = await fetch("/api/dsh-stop-service/info");
						const data = await res.json();
						if (alive && data?.ok) setInfo(data);
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
				[t("infoMemory"), `${info.memoryRssMb} MB`],
				[t("infoNode"), info.node ?? "-"],
				[t("infoHostVersion"), info.hostVersion ?? "-"],
				[t("infoPluginVersion"), info.pluginVersion ?? "-"],
				[t("infoPlatform"), info.platform ?? "-"],
			];

			return jsx("div", {
				style: { marginBottom: 20 },
				children: [
					jsx("h3", {
						key: "title",
						style: { margin: "0 0 10px", fontSize: 15 },
						children: t("infoTitle")
					}),
					...rows.map(([label, value]) => jsx("div", { style: rowStyle, children: [
						jsx("span", { style: labelStyle, children: label }),
						jsx("span", { style: valueStyle, children: value })
					] }, label)),
					info.profile !== null && info.profile !== undefined
						? jsx("div", { key: "bundles", style: { ...rowStyle, borderBottom: "none" }, children: [
								jsx("span", { style: labelStyle, children: t("infoBundles") }),
								jsx("span", {
									style: { ...valueStyle, maxWidth: 360, whiteSpace: "normal" },
									children: (info.profile.bundles ?? []).join(" · ")
								})
							] })
						: null,
				]
			});
		};

		const StopCard = ({ t }) => {
			const [state, setState] = react.useState("idle");

			const onStop = async () => {
				if (!window.confirm(t("confirm"))) return;
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
					loading: "读取服务信息…",
					infoPid: "进程 PID",
					infoStartedAt: "启动时间",
					infoUptime: "运行时长",
					infoMemory: "内存占用 (RSS)",
					infoNode: "Node 版本",
					infoHostVersion: "DSH 宿主版本",
					infoPluginVersion: "插件版本",
					infoPlatform: "平台",
					infoBundles: "已装载 bundles",
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
					stopped: "服务已停止。\n\n重启方法：在终端运行 npx @deepseek-ai/dsh web，然后刷新本页面。"
				},
				en: {
					tab: "Service",
					infoTitle: "Service Info",
					loading: "Loading service info…",
					infoPid: "PID",
					infoStartedAt: "Started at",
					infoUptime: "Uptime",
					infoMemory: "Memory (RSS)",
					infoNode: "Node",
					infoHostVersion: "DSH host",
					infoPluginVersion: "Plugin",
					infoPlatform: "Platform",
					infoBundles: "Loaded bundles",
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
