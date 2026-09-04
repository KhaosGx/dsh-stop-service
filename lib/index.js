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
 * Registers two loopback-only routes on the DSH web host:
 *   GET  /api/dsh-stop-service/health — liveness + process identity
 *   POST /api/dsh-stop-service/stop   — acknowledge, then SIGTERM this process
 *
 * SIGTERM is the same signal `kill <pid>` sends from a terminal, which the
 * host already handles cleanly (session flush + socket release), so the
 * browser gets its HTTP response before shutdown begins.
 */
const name = "stop-service";
const inject = ["webServer"];

const ROUTES = {
  health: "/api/dsh-stop-service/health",
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

/**
 * Build the route list for ctx.webServer.register.
 * @returns {Array<{path: string, handler: (req: any, res: any) => Promise<void>}>}
 */
function makeRoutes() {
  return [
    {
      path: ROUTES.health,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        if (req.method !== "GET") {
          writeJson(res, 405, { error: `method not allowed: ${req.method}` });
          return;
        }
        writeJson(res, 200, {
          ok: true,
          plugin: name,
          pid: process.pid,
          node: process.version,
          uptimeMs: Math.round(process.uptime() * 1000),
        });
      },
    },
    {
      path: ROUTES.stop,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        if (req.method !== "POST") {
          writeJson(res, 405, { error: `method not allowed: ${req.method}` });
          return;
        }
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
 * @param {{enabled?: boolean}} [config] - resolved plugin config.
 */
function apply(ctx, config) {
  if (config?.enabled === false) return;
  const routes = makeRoutes();
  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "stop-service: routes");
}

export { ROUTES, apply, inject, name };
