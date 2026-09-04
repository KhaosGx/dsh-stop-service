// SPDX-License-Identifier: MIT
//
// The loopback request fence below (isIPv4Loopback / isLoopbackAddress /
// isLoopbackHostname / isLoopbackRequest) is adapted from
// zhu1090093659/dsh-web (dsh-client-ui-skill-explorer):
//   Copyright (c) 2026, zhu1090093659 — BSD-3-Clause (full text in LICENSE)
// Modifications and all other code: Copyright (c) 2026 KhaosGx — MIT.

/**
 * Host side of dsh-stop-service.
 *
 * Registers loopback-only routes on the DSH web host:
 *   GET  /api/dsh-stop-service/health  — liveness probe
 *   GET  /api/dsh-stop-service/info    — service/process/profile info
 *   POST /api/dsh-stop-service/stop    — acknowledge, then SIGTERM this process
 *
 * SIGTERM is the same signal `kill <pid>` sends from a terminal, which the
 * host already handles cleanly (session flush + socket release), so the
 * browser gets its HTTP response before shutdown begins.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const name = "stop-service";
const inject = ["webServer", "sessions"];

const ROUTES = {
  health: "/api/dsh-stop-service/health",
  info: "/api/dsh-stop-service/info",
  stop: "/api/dsh-stop-service/stop",
};

/** IPv4 127/8 predicate (four decimal octets, first == 127). */
function isIPv4Loopback(v4) {
  const parts = v4.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
function isLoopbackAddress(address) {
  if (address === void 0) return false;
  const normalized = address.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice(7));
  return isIPv4Loopback(normalized);
}

/** Whether a normalized URL hostname names the loopback authority. */
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  return isIPv4Loopback(hostname);
}

/**
 * Request-level trust fence: a loopback socket address AND a loopback Host
 * header, plus browser same-origin markers. The socket address is
 * authoritative; X-Forwarded-For is never trusted.
 * @param {import("node:http").IncomingMessage} request
 * @returns {boolean}
 */
function isLoopbackRequest(request) {
  if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (typeof host !== "string") return false;
  let hostUrl;
  try {
    hostUrl = new URL("http://" + host);
  } catch {
    return false;
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

/** Write a JSON response and end it. */
function writeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

/** Guard helper: fence + method check. */
function guard(req, res, method) {
  if (!isLoopbackRequest(req)) {
    writeJson(res, 403, { error: "forbidden: loopback-only" });
    return false;
  }
  if (req.method !== method) {
    writeJson(res, 405, { error: `method not allowed: ${req.method}` });
    return false;
  }
  return true;
}

/** Resolved dsh home directory (config > env > default ~/.dsh). */
function dshHomeOf(config) {
  return config?.dshHome ?? process.env.DSH_HOME ?? homedir() + sep + ".dsh";
}

/**
 * CPU usage percent (single-core basis) since the previous /info request,
 * from process.cpuUsage deltas; null on the first call. Sampled naturally
 * by the panel's polling cadence.
 * @returns {number | null}
 */
let lastCpuSample = null;
function cpuPercentSinceLast() {
  const usage = process.cpuUsage();
  const now = process.hrtime.bigint();
  let percent = null;
  if (lastCpuSample !== null) {
    const cpuMs = (usage.user - lastCpuSample.user + usage.system - lastCpuSample.system) / 1000;
    const wallMs = Number(now - lastCpuSample.time) / 1e6;
    if (wallMs > 0) percent = Math.round((100 * cpuMs) / wallMs * 10) / 10;
  }
  lastCpuSample = { user: usage.user, system: usage.system, time: now };
  return percent;
}

/**
 * This plugin's own version, from the package manifest next to lib/.
 * @returns {string | null}
 */
function pluginVersion() {
  try {
    const libDir = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(readFileSync(join(dirname(libDir), "package.json"), "utf8"));
    return manifest.name === "dsh-stop-service" ? manifest.version : null;
  } catch {
    return null;
  }
}

/**
 * Host version serving this profile, from the profile tree's pinned
 * @deepseek-ai/dsh package manifest.
 * @returns {string | null}
 */
function hostVersion(config) {
  try {
    const manifestPath = join(dshHomeOf(config), "profiles", "node_modules", "@deepseek-ai", "dsh", "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return manifest.name === "@deepseek-ai/dsh" ? manifest.version : null;
  } catch {
    return null;
  }
}

/**
 * Profile composition info: bundles list and plugin dependencies from the
 * web profile's package.json. Read-only; degrades to null.
 */
function profileInfo(config) {
  try {
    const manifest = JSON.parse(readFileSync(join(dshHomeOf(config), "profiles", "web", "package.json"), "utf8"));
    return {
      name: "web",
      bundles: manifest?.dsh?.profile?.bundles ?? [],
      plugins: Object.keys(manifest?.dependencies ?? {}),
    };
  } catch {
    return null;
  }
}

/**
 * Build the route list for ctx.webServer.register.
 * @param {any} ctx - host plugin context carrying webServer/sessions.
 * @param {{dshHome?: string}} [config]
 * @returns {Array<{path: string, handler: (req: any, res: any) => Promise<void>}>}
 */
function makeRoutes(ctx, config) {
  /** Active session count; null when the registry is unavailable. */
  const sessionCount = () => {
    try {
      return typeof ctx.sessions?.list === "function" ? ctx.sessions.list().length : null;
    } catch {
      return null;
    }
  };
  return [
    {
      path: ROUTES.health,
      handler: async (req, res) => {
        if (!guard(req, res, "GET")) return;
        writeJson(res, 200, { ok: true, plugin: name, pid: process.pid });
      },
    },
    {
      path: ROUTES.info,
      handler: async (req, res) => {
        if (!guard(req, res, "GET")) return;
        writeJson(res, 200, {
          ok: true,
          pid: process.pid,
          node: process.version,
          startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
          uptimeMs: Math.round(process.uptime() * 1000),
          memoryRssMb: Math.round((process.memoryUsage().rss / 1048576) * 10) / 10,
          cpuPercent: cpuPercentSinceLast(),
          platform: `${process.platform} ${process.arch}`,
          sessionCount: sessionCount(),
          hostVersion: hostVersion(config),
          pluginVersion: pluginVersion(),
          profile: profileInfo(config),
        });
      },
    },
    {
      path: ROUTES.stop,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        writeJson(res, 200, { ok: true, stopping: true, pid: process.pid });
        // Let the response flush, then shut down exactly like a terminal kill.
        setTimeout(() => process.kill(process.pid, "SIGTERM"), 300);
      },
    },
  ];
}

/**
 * Mount the stop-service routes.
 * @param {any} ctx - host plugin context carrying webServer.
 * @param {{enabled?: boolean, dshHome?: string}} [config] - resolved plugin config.
 */
function apply(ctx, config) {
  if (config?.enabled === false) return;
  const routes = makeRoutes(ctx, config);
  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "stop-service: routes");
}

export { ROUTES, apply, inject, name };
