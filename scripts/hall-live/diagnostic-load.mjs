// Anonymous, read-only transport diagnostics. No application messages or retries.
import assert from "node:assert/strict";
import fs from "node:fs";
import WebSocket from "ws";
import { setTimeout as delay } from "node:timers/promises";
import { monitorEventLoopDelay } from "node:perf_hooks";
const eventLoop = monitorEventLoopDelay({ resolution: 20 });
eventLoop.enable();
const [
  target,
  countArg = "500",
  soakArg = "60",
  output = "/tmp/hall-diagnostic-500.json",
] = process.argv.slice(2);
const base = new URL(target).origin;
assert.ok(
  [
    "http://127.0.0.1:8787",
    "https://devfest-hall-availability-test.gdg-chennai.workers.dev",
  ].includes(base),
);
const count = Number(countArg),
  soak = Number(soakArg);
assert.ok(Number.isInteger(count) && count > 0 && count <= 500);
assert.ok(Number.isInteger(soak) && soak >= 1 && soak <= 120);
const attempts = [],
  all = new Set(),
  intentional = new WeakSet(),
  clients = [];
const start = performance.now();
const report = {
  target: base,
  started: new Date().toISOString(),
  anonymous: true,
  readonly: true,
  clients: count,
  soakSeconds: soak,
  simultaneousArrival: true,
  automaticRetries: 0,
  unexpectedCloses: 0,
  regressions: 0,
  revisionGaps: 0,
  failures: [],
  closeCodes: {},
  httpStatuses: {},
};
let interrupted = false;
function stop() {
  interrupted = true;
  for (const ws of all) {
    intentional.add(ws);
    ws.terminate();
  }
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const hard = setTimeout(stop, (soak + 80) * 1000);
function connect(client, phase) {
  const began = performance.now();
  const a = {
    id: attempts.length,
    client: client.id,
    phase,
    startedMs: began - start,
  };
  attempts.push(a);
  return new Promise((resolve) => {
    let settled = false,
      timer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      a.result = error ? "FAIL" : "PASS";
      if (error) {
        a.error = error.message;
        a.errorCode = error.code ?? null;
        a.failureStage =
          a.upgradeMs !== undefined
            ? "snapshot"
            : a.tlsMs !== undefined
              ? "HTTP upgrade"
              : a.tcpMs !== undefined
                ? "TLS handshake"
                : a.dnsMs !== undefined
                  ? "TCP connect"
                  : "DNS/socket acquisition";
        a.elapsedMs = performance.now() - began;
        report.failures.push(a);
        intentional.add(ws);
        ws.terminate();
      }
      resolve(!error);
    };
    const ws = new WebSocket(
      base.replace(/^http/, "ws") + "/api/halls/socket",
      {
        family: 4,
        handshakeTimeout: 15000,
        headers: { Origin: base },
        finishRequest(req) {
          req.once("socket", (socket) => {
            a.socketMs = performance.now() - began;
            socket.once("lookup", (error) => {
              a.dnsMs = performance.now() - began;
              if (error) a.dnsError = error.code;
            });
            socket.once("connect", () => {
              a.tcpMs = performance.now() - began;
            });
            socket.once("secureConnect", () => {
              a.tlsMs = performance.now() - began;
            });
          });
          req.end();
        },
      },
    );
    all.add(ws);
    client.ws = ws;
    timer = setTimeout(
      () => finish(Error("15-second initial snapshot deadline exceeded")),
      15000,
    );
    ws.on("upgrade", (response) => {
      a.upgradeMs = performance.now() - began;
      a.httpStatus = response.statusCode;
      a.ray = response.headers["cf-ray"] ?? null;
    });
    ws.on("unexpected-response", (_req, response) => {
      a.httpStatus = response.statusCode;
      a.ray = response.headers["cf-ray"] ?? null;
      report.httpStatuses[response.statusCode] =
        (report.httpStatuses[response.statusCode] ?? 0) + 1;
      finish(Error(`HTTP upgrade rejected: ${response.statusCode}`));
    });
    ws.on("message", (data) => {
      try {
        const s = JSON.parse(data);
        assert.ok(
          Number.isSafeInteger(s.revision) &&
            Array.isArray(s.occupancy) &&
            Array.isArray(s.sessions) &&
            Array.isArray(s.promotions),
        );
        if (client.state && s.revision < client.state.revision)
          report.regressions++;
        if (
          a.snapshotMs !== undefined &&
          s.revision > client.state.revision + 1
        )
          report.revisionGaps++;
        client.state = s;
        if (a.snapshotMs === undefined) {
          a.snapshotMs = performance.now() - began;
          a.initialRevision = s.revision;
          finish();
        }
      } catch (error) {
        if (!settled) finish(error);
        else {
          a.messageError = error.message;
          report.failures.push(a);
        }
      }
    });
    ws.on("error", (error) => {
      if (!intentional.has(ws)) finish(error);
    });
    ws.on("close", (code, reason) => {
      a.closeCode = code;
      a.closeReason = reason.toString().slice(0, 100);
      report.closeCodes[code] = (report.closeCodes[code] ?? 0) + 1;
      all.delete(ws);
      if (!intentional.has(ws)) {
        report.unexpectedCloses++;
        finish(Error(`Closed before initialization: ${code}`));
      }
    });
  });
}
const stable = (s) =>
  JSON.stringify([s.revision, s.occupancy, s.promotions, s.sessions, s.clock]);
async function snapshot() {
  const response = await fetch(base + "/api/halls", {
    signal: AbortSignal.timeout(15000),
  });
  report.httpStatuses[response.status] =
    (report.httpStatuses[response.status] ?? 0) + 1;
  assert.equal(response.status, 200);
  return response.json();
}
async function probe(group, phase) {
  const results = await Promise.all(
    group.map(
      (c) =>
        new Promise((resolve) => {
          const ws = c.ws;
          if (ws.readyState !== WebSocket.OPEN) return resolve(false);
          const payload = Buffer.from(`probe:${phase}:${c.id}`);
          const finish = (good) => {
            clearTimeout(timer);
            ws.off("pong", pong);
            resolve(good);
          };
          const pong = (data) => {
            if (data.equals(payload)) finish(true);
          };
          const timer = setTimeout(() => finish(false), 5000);
          ws.on("pong", pong);
          ws.ping(payload, (error) => {
            if (error) finish(false);
          });
        }),
    ),
  );
  (report.controlPingChecks ??= []).push({
    phase,
    attempted: group.length,
    responded: results.filter(Boolean).length,
  });
}
async function closeGroup(group) {
  await Promise.all(
    group.map(
      (c) =>
        new Promise((resolve) => {
          const ws = c.ws;
          intentional.add(ws);
          if (ws.readyState === WebSocket.CLOSED) return resolve();
          const timeout = setTimeout(() => ws.terminate(), 3000);
          ws.once("close", () => {
            clearTimeout(timeout);
            resolve();
          });
          ws.close(1000, "Reconnect test");
        }),
    ),
  );
}
try {
  report.initialRevision = (await snapshot()).revision;
  clients.push(
    ...Array.from({ length: count }, (_, id) => ({
      id,
      state: null,
      ws: null,
    })),
  );
  await Promise.all(clients.map((c) => connect(c, "initial")));
  const healthy = clients.filter(
    (c) => c.ws.readyState === WebSocket.OPEN && c.state,
  );
  report.peakOpen = healthy.length;
  console.log(
    `Holding ${healthy.length}/${count} anonymous sockets for ${soak}s`,
  );
  await probe(healthy, "hold-start");
  for (let second = 0; second < soak; second++) {
    await delay(1000);
    assert.ok(!interrupted, "Interrupted");
  }
  await probe(healthy, "hold-end");
  report.openAfterSoak = healthy.filter(
    (c) => c.ws.readyState === WebSocket.OPEN,
  ).length;
  const middle = await snapshot();
  report.convergedAfterSoak = healthy.filter(
    (c) =>
      c.ws.readyState === WebSocket.OPEN && stable(c.state) === stable(middle),
  ).length;
  report.revisionAfterSoak = middle.revision;
  await closeGroup(healthy);
  const reconnectStart = performance.now();
  await Promise.all(healthy.map((c) => connect(c, "reconnect")));
  report.reconnectMs = performance.now() - reconnectStart;
  await probe(
    clients.filter((c) => c.ws.readyState === WebSocket.OPEN),
    "after-reconnect",
  );
  const final = await snapshot();
  report.finalRevision = final.revision;
  report.finalOpen = clients.filter(
    (c) => c.ws.readyState === WebSocket.OPEN,
  ).length;
  report.finalConverged = clients.filter(
    (c) =>
      c.ws.readyState === WebSocket.OPEN && stable(c.state) === stable(final),
  ).length;
  report.transportResult =
    !report.failures.length &&
    !report.unexpectedCloses &&
    !report.regressions &&
    !report.revisionGaps &&
    report.finalConverged === count
      ? "PASS"
      : "FAIL";
} catch (error) {
  report.transportResult = "FAIL";
  report.error = error.message;
} finally {
  await closeGroup(clients);
  for (const ws of all) {
    intentional.add(ws);
    ws.terminate();
  }
  await delay(250);
  clearTimeout(hard);
  const percentile = (values, p) => {
    values.sort((a, b) => a - b);
    return values[Math.ceil(values.length * p) - 1] ?? null;
  };
  report.phases = {};
  for (const phase of ["initial", "reconnect"]) {
    const rows = attempts.filter((a) => a.phase === phase),
      good = rows.filter((a) => a.result === "PASS");
    const metrics = {};
    for (const field of [
      "dnsMs",
      "tcpMs",
      "tlsMs",
      "upgradeMs",
      "snapshotMs",
    ]) {
      const values = good.map((a) => a[field]).filter((n) => n !== undefined);
      metrics[field] = {
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
        p99: percentile(values, 0.99),
        samples: values.length,
      };
    }
    report.phases[phase] = {
      attempted: rows.length,
      accepted: good.length,
      failed: rows.length - good.length,
      metrics,
    };
  }
  report.acceptance = {
    allControlPingsAnswered:
      (report.controlPingChecks ?? []).length === 3 &&
      report.controlPingChecks.every((p) => p.responded === p.attempted),
    allInitialConnected: report.peakOpen === count,
    allHeldAndConverged:
      report.openAfterSoak === count && report.convergedAfterSoak === count,
    allReconnectedAndConverged:
      report.finalOpen === count && report.finalConverged === count,
    initialP95Within5s:
      report.phases.initial.metrics.snapshotMs.p95 !== null &&
      report.phases.initial.metrics.snapshotMs.p95 <= 5000,
    reconnectWithin30s:
      report.reconnectMs !== undefined && report.reconnectMs <= 30000,
  };
  report.result =
    report.transportResult === "PASS" &&
    Object.values(report.acceptance).every(Boolean)
      ? "PASS"
      : "FAIL";
  report.elapsedSeconds = (performance.now() - start) / 1000;
  report.remainingSockets = all.size;
  eventLoop.disable();
  report.generator = {
    rss: process.memoryUsage().rss,
    eventLoopDelayP99Ms: eventLoop.percentile(99) / 1e6,
    eventLoopDelayMaxMs: eventLoop.max / 1e6,
  };
  report.attempts = attempts;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  const { attempts: ignored, ...summary } = report;
  void ignored;
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = report.result === "PASS" ? 0 : 1;
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
