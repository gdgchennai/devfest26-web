// Bounded read-only protocol rehearsal. No cookies, mutations or automatic retries.
import assert from "node:assert/strict";
import fs from "node:fs";
import WebSocket from "ws";
import { setTimeout as delay } from "node:timers/promises";
const [
  target,
  clientsArg = "25",
  soakArg = "30",
  reportPath = "/tmp/hall-readonly-report.json",
  batchArg = "25",
] = process.argv.slice(2);
const base = new URL(target).origin;
assert.ok(
  [
    "http://127.0.0.1:8787",
    "https://devfest-hall-availability-test.gdg-chennai.workers.dev",
  ].includes(base),
  "Target not allowlisted",
);
const count = Number(clientsArg),
  soak = Number(soakArg),
  batch = Math.min(count, Number(batchArg));
assert.ok(Number.isInteger(batch) && batch > 0 && batch <= 1520);
assert.ok(Number.isInteger(count) && count > 0 && count <= 1520);
assert.ok(Number.isInteger(soak) && soak >= 1 && soak <= 600);
const clients = Array.from({ length: count }, () => ({
  state: null,
  socket: null,
}));
const all = new Set(),
  intentional = new WeakSet(),
  initialMs = [],
  codes = {};
const report = {
  target: base,
  started: new Date().toISOString(),
  clients: count,
  soakSeconds: soak,
  connectionBatchSize: batch,
  readonly: true,
  attempts: 0,
  accepted: 0,
  unexpectedCloses: 0,
  errors: 0,
  regressions: 0,
  duplicates: 0,
  revisionGaps: 0,
  httpStatuses: {},
};
const start = performance.now();
let interrupted = false;
const closeAll = () => {
  interrupted = true;
  for (const s of all) {
    intentional.add(s);
    s.close(1000, "Test complete");
  }
};
process.on("SIGINT", closeAll);
process.on("SIGTERM", closeAll);
const hard = setTimeout(
  () => {
    closeAll();
    report.error = "Global deadline exceeded";
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.exit(1);
  },
  (soak + 240) * 1000,
);
async function connect(c) {
  assert.ok(!interrupted, "Interrupted");
  report.attempts++;
  const began = performance.now();
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(
      base.replace(/^http/, "ws") + "/api/halls/socket",
      { family: 4, handshakeTimeout: 15000 },
    );
    all.add(ws);
    c.socket = ws;
    ws.on("unexpected-response", (_req, res) => {
      report.httpStatuses[res.statusCode] =
        (report.httpStatuses[res.statusCode] ?? 0) + 1;
      ws.terminate();
      reject(new Error(`Upgrade HTTP ${res.statusCode}`));
    });
    let initialized = false;
    const timer = setTimeout(
      () => reject(new Error("Initial snapshot timeout")),
      15000,
    );
    ws.onmessage = (e) => {
      try {
        const state = JSON.parse(e.data);
        assert.ok(Number.isSafeInteger(state.revision));
        if (initialized && state.revision === c.state.revision)
          report.duplicates++;
        if (initialized && state.revision > c.state.revision + 1)
          report.revisionGaps += state.revision - c.state.revision - 1;
        if (c.state && state.revision < c.state.revision) report.regressions++;
        c.state = state;
        if (!initialized) {
          initialized = true;
          report.accepted++;
          initialMs.push(performance.now() - began);
          clearTimeout(timer);
          resolve();
        }
      } catch (e) {
        clearTimeout(timer);
        reject(e);
        report.errors++;
      }
    };
    ws.onerror = () => {
      report.errors++;
      clearTimeout(timer);
      reject(new Error("WebSocket transport/upgrade error"));
    };
    ws.onclose = (e) => {
      clearTimeout(timer);
      codes[e.code] = (codes[e.code] ?? 0) + 1;
      if (!intentional.has(ws)) {
        report.unexpectedCloses++;
        if (!initialized) reject(new Error("Closed before snapshot"));
      }
      all.delete(ws);
    };
  });
}
async function snapshot() {
  const r = await fetch(base + "/api/halls", {
    signal: AbortSignal.timeout(15000),
  });
  report.httpStatuses[r.status] = (report.httpStatuses[r.status] ?? 0) + 1;
  assert.equal(r.status, 200);
  return r.json();
}
try {
  const before = await snapshot();
  report.initialRevision = before.revision;
  for (let i = 0; i < count; i += batch) {
    await Promise.all(clients.slice(i, i + batch).map(connect));
    await delay(250);
    if (report.errors || report.unexpectedCloses)
      throw new Error("Ramp health failure");
  }
  report.peakOpen = clients.filter(
    (c) => c.socket.readyState === WebSocket.OPEN,
  ).length;
  assert.equal(report.peakOpen, count);
  console.log(`Holding ${count} sockets for ${soak}s`);
  for (let s = 0; s < soak; s++) {
    await delay(1000);
    assert.ok(
      !interrupted && !report.errors && !report.unexpectedCloses,
      "Soak health failure",
    );
  }
  const surge = clients.slice(0, Math.min(300, count));
  await Promise.all(
    surge.map(
      (c) =>
        new Promise((resolve) => {
          const ws = c.socket;
          intentional.add(ws);
          const timeout = setTimeout(() => ws.terminate(), 3000);
          ws.addEventListener(
            "close",
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
          ws.close(1000, "Reconnect test");
        }),
    ),
  );
  const reconnectStart = performance.now();
  for (let i = 0; i < surge.length; i += batch) {
    await Promise.all(surge.slice(i, i + batch).map(connect));
    await delay(250);
  }
  report.reconnected = surge.length;
  report.reconnectMs = performance.now() - reconnectStart;
  const final = await snapshot();
  report.finalRevision = final.revision;
  const stable = (s) =>
    JSON.stringify([
      s.revision,
      s.occupancy,
      s.promotions,
      s.sessions,
      s.clock,
    ]);
  report.converged = clients.filter(
    (c) => stable(c.state) === stable(final),
  ).length;
  assert.equal(
    report.converged,
    count,
    "State changed or clients failed convergence; investigate before rerunning",
  );
  assert.equal(report.regressions, 0);
  assert.equal(report.errors, 0);
  assert.equal(report.unexpectedCloses, 0);
  report.result = "PASS";
} catch (e) {
  report.result = "FAIL";
  report.error = e.message;
  process.exitCode = 1;
} finally {
  closeAll();
  await delay(1000);
  for (const ws of all) ws.terminate();
  await delay(100);
  clearTimeout(hard);
  initialMs.sort((a, b) => a - b);
  const pct = (p) =>
    initialMs[Math.max(0, Math.ceil(initialMs.length * p) - 1)] ?? null;
  report.initialSnapshotMs = {
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
    samples: initialMs.length,
  };
  report.transportResult = report.result;
  report.acceptance = {
    initialSnapshotP95Within5s:
      report.initialSnapshotMs.p95 !== null &&
      report.initialSnapshotMs.p95 <= 5000,
    reconnectWithin30s:
      report.reconnectMs !== undefined && report.reconnectMs <= 30000,
  };
  if (
    report.result === "PASS" &&
    !Object.values(report.acceptance).every(Boolean)
  ) {
    report.result = "FAIL";
    report.error = "Latency acceptance target exceeded";
    process.exitCode = 1;
  }
  report.elapsedSeconds = (performance.now() - start) / 1000;
  report.closeCodes = codes;
  report.remainingSockets = all.size;
  report.loadGeneratorRSS = process.memoryUsage().rss;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  process.removeListener("SIGINT", closeAll);
  process.removeListener("SIGTERM", closeAll);
}
