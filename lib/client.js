// SPDX-License-Identifier: MIT
// Copyright (c) 2026 KhaosGx

/**
 * Browser side of dsh-stop-service.
 *
 * Adds a top-level "服务控制 / Service" section to Settings with a
 * confirm-guarded stop button. The button POSTs /api/dsh-stop-service/stop;
 * the host replies, then SIGTERMs itself. After the host dies this page keeps
 * running in the browser and shows the restart hint.
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

		const StopServiceTab = ({ t }) => {
			const [state, setState] = react.useState("idle");
			const [error, setError] = react.useState("");

			const onStop = async () => {
				if (!window.confirm(t("confirm"))) return;
				setState("stopping");
				setError("");
				try {
					await fetch("/api/dsh-stop-service/stop", { method: "POST" });
				} catch {
					// The host dies right after replying; a network error here
					// still means the stop request went through.
				}
				// Host is gone; never expect a further response.
				setState("stopped");
			};

			if (state === "stopped") {
				return jsx("div", {
					style: { padding: "24px 8px", maxWidth: 520 },
					children: jsx("p", {
						style: { fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-line" },
						children: t("stopped")
					})
				});
			}

			return jsx("div", {
				style: { padding: "24px 8px", maxWidth: 520 },
				children: jsx("div", {
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
						error
							? jsx("p", {
									key: "error",
									style: { margin: "12px 0 0", fontSize: 12, color: "#d33" },
									children: error
								})
							: null,
					]
				})
			});
		};

		/**
		 * Contribute the settings tab.
		 * @param {any} ctx - client context carrying slots/locale.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh: {
					tab: "服务控制",
					title: "终止服务",
					desc: "优雅停止当前 DeepSeek Harness 宿主进程（SIGTERM，与终端 kill 相同）：会话落盘、端口释放，不会留下后台孤儿进程。",
					hint: "停止后需要重启：在终端运行 npx dsh web，然后刷新本页。",
					stop: "终止服务",
					stopping: "正在停止…",
					confirm: "确定要终止当前 DeepSeek Harness 服务吗？所有会话将断开（已保存的会话不受影响）。",
					stopped: "服务已停止。\n\n重启方法：在终端运行 npx dsh web，然后刷新本页面。"
				},
				en: {
					tab: "Service",
					title: "Stop Service",
					desc: "Gracefully stops the current DeepSeek Harness host process (SIGTERM, same as a terminal kill): sessions flush and the port is released — no orphaned background process.",
					hint: "To start it again, run npx dsh web in a terminal, then reload this page.",
					stop: "Stop Service",
					stopping: "Stopping…",
					confirm: "Stop the current DeepSeek Harness service? All sessions disconnect (saved sessions are unaffected).",
					stopped: "Service stopped.\n\nTo restart: run npx dsh web in a terminal, then reload this page."
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
