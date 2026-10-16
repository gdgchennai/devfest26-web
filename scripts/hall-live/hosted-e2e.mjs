// Authenticated public-route rehearsal. Credentials never enter outputs or argv.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";
import { organizerSessions, HOSTED_HALL } from "./hosted-writer-preflight.mjs";
const exec = promisify(execFile);
const [manifest, privateDir, output = "/tmp/hall-hosted-e2e.json"] =
  process.argv.slice(2);
assert.ok(
  manifest && privateDir,
  "Pass a private session manifest and an existing private backup directory",
);
assert.ok(
  (fs.statSync(privateDir).mode & 0o077) === 0,
  "Backup directory must be private (0700)",
);
assert.ok(
  fs.statSync(path.join(privateDir, "halls-before.sql")).size > 0,
  "A database backup is required before writes",
);
const localSmoke = process.argv.includes("--local-smoke");
const base = localSmoke ? "http://127.0.0.1:8787" : HOSTED_HALL,
  count = localSmoke ? 20 : 1400,
  offered = localSmoke ? 12 : 500;
const runId = randomUUID();
const report = {
  runId,
  target: base,
  started: new Date().toISOString(),
  anonymousViewers: count,
  offeredUpdates: offered,
  localSmoke,
  requestedWriteWindowSeconds: localSmoke ? 3 : 120,
  automaticSocketRetries: 0,
  unexpectedCloses: 0,
  unexpectedClosesDuringWrites: 0,
  connectionDrops: [],
  connectionRampBatchSize: count,
  regressions: 0,
  statuses: {},
  jobs: [],
  errors: [],
  restore: [],
};
const clients = Array.from({ length: count }, (_, id) => ({
  id,
  state: null,
  ws: null,
  received: new Map(),
  continuous: true,
  generation: 0,
}));
const sockets = new Set(),
  intentional = new WeakSet();
let actors = [],
  baseline,
  latest,
  stopped = false,
  writesStarted = false,
  stopWrites = false;
const hard = setTimeout(() => {
  stopped = true;
  stopWrites = true;
  for (const ws of sockets) {
    intentional.add(ws);
    ws.terminate();
  }
}, 360000);
process.on("SIGINT", () => {
  stopWrites = true;
});
process.on("SIGTERM", () => {
  stopWrites = true;
});
const stable = (s) =>
  JSON.stringify([s.revision, s.occupancy, s.promotions, s.sessions, s.clock]);
const snapshot = async () => {
  const r = await fetch(base + "/api/halls", {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(r.status, 200);
  return r.json();
};
async function until(check, ms, message) {
  const deadline = Date.now() + ms;
  while (!(await check())) {
    assert.ok(Date.now() < deadline, message);
    await delay(25);
  }
}
async function connect(c) {
  for (let retry = 0; retry < 3; retry++) {
    if (retry) {
      report.automaticSocketRetries++;
      await delay(500 * 2 ** (retry - 1) * (0.75 + Math.random() / 2));
    }
    const good = await new Promise((resolve) => {
      const gen = ++c.generation;
      let settled = false,
        initialized = false;
      const began = performance.now();
      const ws = new WebSocket(
        base.replace(/^http/, "ws") + "/api/halls/socket",
        { family: 4, handshakeTimeout: 15000, headers: { Origin: base } },
      );
      c.ws = ws;
      sockets.add(ws);
      const finish = (good) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!good) {
          intentional.add(ws);
          ws.terminate();
        } else (c.initialMs ??= []).push(performance.now() - began);
        resolve(good);
      };
      const timer = setTimeout(() => finish(false), 15000);
      ws.on("message", (data) => {
        if (gen !== c.generation) return;
        try {
          const s = JSON.parse(data);
          assert.ok(Number.isSafeInteger(s.revision));
          if (c.state && s.revision < c.state.revision) {
            report.regressions++;
            return;
          }
          initialized = true;
          c.state = s;
          if (!c.received.has(s.revision))
            c.received.set(s.revision, performance.now());
          if (!latest || s.revision >= latest.revision) latest = s;
          finish(true);
        } catch {
          finish(false);
        }
      });
      ws.on("error", (error) => {
        if (!intentional.has(ws) && report.connectionDrops.length < 100)
          report.connectionDrops.push({
            client: c.id,
            phase: writesStarted ? "writes" : "setup",
            errorCode: error.code ?? null,
            message: error.message,
          });
        finish(false);
      });
      ws.on("close", (code, reason) => {
        sockets.delete(ws);
        if (!intentional.has(ws) && gen === c.generation && !stopped) {
          report.unexpectedCloses++;
          c.continuous = false;
          if (report.connectionDrops.length < 100)
            report.connectionDrops.push({
              client: c.id,
              phase: writesStarted ? "writes" : "setup",
              code,
              reason: reason.toString().slice(0, 100),
            });
          if (initialized) {
            if (writesStarted) report.unexpectedClosesDuringWrites++;
            if (
              report.unexpectedClosesDuringWrites > 14 ||
              (c.recoveries ?? 0) >= 2
            )
              stopWrites = true;
            else if (!c.healing) {
              c.recoveries = (c.recoveries ?? 0) + 1;
              c.healing = (async () => {
                await delay(500 * (0.75 + Math.random() / 2));
                if (!stopped && !(await connect(c))) stopWrites = true;
              })().finally(() => {
                c.healing = null;
              });
            }
          }
        }
        finish(false);
      });
    });
    if (good) return true;
    if (stopped) return false;
  }
  return false;
}
async function closeGroup(group) {
  await Promise.all(
    group.map(
      (c) =>
        new Promise((resolve) => {
          const ws = c.ws;
          if (!ws || ws.readyState === WebSocket.CLOSED) return resolve();
          intentional.add(ws);
          const t = setTimeout(() => ws.terminate(), 2000);
          ws.once("close", () => {
            clearTimeout(t);
            resolve();
          });
          ws.close(1000, "Rehearsal");
        }),
    ),
  );
}
let pingFailures = [];
async function ping(group) {
  const results = await Promise.all(
    group.map(
      (c) =>
        new Promise((resolve) => {
          const ws = c.ws;
          if (ws.readyState !== WebSocket.OPEN) return resolve(false);
          const payload = Buffer.from(`health:${c.id}`);
          const finish = (good) => {
            clearTimeout(t);
            ws.off("pong", pong);
            resolve(good);
          };
          const pong = (data) => {
            if (data.equals(payload)) finish(true);
          };
          const t = setTimeout(() => finish(false), 5000);
          ws.on("pong", pong);
          ws.ping(payload, (error) => {
            if (error) finish(false);
          });
        }),
    ),
  );
  pingFailures = group.filter((c, i) => !results[i]);
  return results.filter(Boolean).length;
}
async function post(actor, mutation) {
  actor.lastPost = performance.now();
  const r = await fetch(base + "/api/admin/halls", {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: actor.cookie,
    },
    body: JSON.stringify(mutation),
    signal: AbortSignal.timeout(30000),
  });
  const body = await r.json();
  return { status: r.status, body, retryAfter: r.headers.get("retry-after") };
}
async function audit() {
  if (localSmoke)
    return (await fetch(base + "/test/audit?runId=" + runId)).json();
  const sql = `SELECT revision,actor,json_extract(payload,'$.sequence') sequence,json_extract(payload,'$.zone') zone,json_extract(payload,'$.phase') phase FROM hall_audit WHERE json_extract(payload,'$.loadTest')='${runId}' ORDER BY revision`;
  const { stdout } = await exec(
    path.resolve("node_modules/.bin/wrangler"),
    [
      "d1",
      "execute",
      "devfest-chennai-2026",
      "--remote",
      "-c",
      "workers/hall-live/wrangler.jsonc",
      "--command",
      sql,
      "--json",
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const data = JSON.parse(stdout);
  return data.flatMap((r) => r.results ?? []);
}
async function job(sequence) {
  const actor = actors[sequence % actors.length];
  const row = {
    sequence,
    actorReference: actor.actorReference,
    zone: actor.zone,
  };
  report.jobs.push(row);
  if (actor.disabled || performance.now() < (actor.cooldown ?? 0)) {
    row.skipped = "Organizer unavailable or cooling down";
    return;
  }
  const state = latest.occupancy.find((o) => o.zone === actor.zone);
  const original = baseline.occupancy.find((o) => o.zone === actor.zone);
  row.expected = state.revision;
  row.occupied =
    original.occupied + (sequence % 2 ? 0 : original.occupied === 100 ? -1 : 1);
  row.sentAt = performance.now();
  row.sentOffsetMs = row.sentAt - report.writeStartedAt;
  try {
    const r = await post(actor, {
      kind: "occupancy",
      zone: row.zone,
      expected: row.expected,
      occupied: row.occupied,
      loadTest: runId,
      sequence,
      phase: "write",
    });
    row.status = r.status;
    row.responseMs = performance.now() - row.sentAt;
    report.statuses[r.status] = (report.statuses[r.status] ?? 0) + 1;
    if (r.status === 200) {
      row.revision = r.body.revision;
      if (r.body.revision >= latest.revision) latest = r.body;
    } else if (r.status === 401 || r.status === 403) {
      actor.disabled = true;
      row.error = "Organizer no longer authorized";
    } else if (r.status === 429) {
      actor.cooldown =
        performance.now() + Math.max(60000, Number(r.retryAfter ?? 60) * 1000);
      row.retryAfter = r.retryAfter;
    } else if (r.status !== 409) {
      stopWrites = true;
      row.error = "Unexpected service status";
    }
  } catch {
    row.ambiguous = true;
    row.responseMs = performance.now() - row.sentAt;
    stopWrites = true;
  }
}
let auditRows = [];
try {
  const validated = await organizerSessions(manifest, base);
  actors = validated.actors;
  report.skippedSessions = validated.skipped;
  report.organizers = actors.map(({ session, actorReference, zone }) => ({
    session,
    actorReference,
    zone,
  }));
  const windowSeconds = localSmoke
    ? 3
    : Math.max(120, Math.ceil((offered * 60) / (actors.length * 84)));
  report.effectiveWriteWindowSeconds = windowSeconds;
  report.writeRateAdjustedForAvailableActors = windowSeconds !== 120;
  console.log(
    `Connecting ${count} viewers; ${actors.length} valid organizers; ${windowSeconds}s offered-write window`,
  );
  const connected = [];
  for (let i = 0; i < count; i += report.connectionRampBatchSize) {
    connected.push(
      ...(await Promise.all(
        clients.slice(i, i + report.connectionRampBatchSize).map(connect),
      )),
    );
    console.log(
      `Initialized ${connected.filter(Boolean).length}/${count} viewers`,
    );
    await delay(250);
  }
  const closed = clients.filter((c) => c.ws.readyState !== WebSocket.OPEN);
  if (closed.length) {
    report.setupRecoveredAfterDrop = closed.length;
    await Promise.all(closed.map((c) => c.healing ?? connect(c)));
  }
  assert.ok(connected.every(Boolean), "Could not initialize all viewers");
  report.initialized = connected.filter(Boolean).length;
  report.setupHealthChecks = [];
  for (let round = 0; round < 3; round++) {
    report.initialPingResponses = await ping(clients);
    report.setupHealthChecks.push({
      round,
      responders: report.initialPingResponses,
      failed: pingFailures.length,
    });
    if (report.initialPingResponses === count) break;
    if (round === 2) break;
    const repair = [...pingFailures];
    console.log(`Recovering ${repair.length} setup sockets before any writes`);
    const activeRecovery = repair.filter((c) => c.healing);
    const manualRecovery = repair.filter((c) => !c.healing);
    await Promise.all(activeRecovery.map((c) => c.healing));
    await closeGroup(manualRecovery);
    await Promise.all(manualRecovery.map(connect));
  }
  assert.equal(
    report.initialPingResponses,
    count,
    "Initial connectivity health failed",
  );
  baseline = await snapshot();
  latest = baseline;
  fs.writeFileSync(
    path.join(privateDir, `baseline-${runId}.json`),
    JSON.stringify(baseline, null, 2),
    { mode: 0o600 },
  );
  const pending = new Set();
  let rejoining = null;
  clients.forEach((c) => {
    c.continuous = true;
  });
  writesStarted = true;
  report.minimumOpenDuringWrites = count;
  report.writeStartedAt = performance.now();
  const duration = windowSeconds * 1000,
    interval = duration / offered;
  console.log(
    `Offering ${offered} authenticated writes while ${count} viewers are connected`,
  );
  for (let i = 0; i < offered; i++) {
    await delay(
      Math.max(0, report.writeStartedAt + i * interval - performance.now()),
    );
    report.minimumOpenDuringWrites = Math.min(
      report.minimumOpenDuringWrites,
      clients.filter((c) => c.ws.readyState === WebSocket.OPEN).length,
    );
    if (stopWrites || stopped) {
      report.stoppedAtSlot = i;
      break;
    }
    if (
      !rejoining &&
      performance.now() - report.writeStartedAt >= duration / 2
    ) {
      const group = clients.slice(0, localSmoke ? 5 : 300);
      group.forEach((c) => (c.continuous = false));
      rejoining = (async () => {
        await closeGroup(group);
        const began = performance.now();
        const result = await Promise.all(group.map(connect));
        report.plannedReconnected = result.filter(Boolean).length;
        report.plannedReconnectMs = performance.now() - began;
      })();
    }
    if (pending.size >= 20) {
      report.jobs.push({
        sequence: i,
        skipped: "Outstanding request bound (20) reached",
      });
      continue;
    }
    const task = job(i);
    pending.add(task);
    task.finally(() => pending.delete(task));
    if (i % 100 === 0)
      console.log(
        `Offered ${i + 1}/${offered}; responses ${JSON.stringify(report.statuses)}; pending ${pending.size}`,
      );
  }
  await delay(
    Math.max(0, report.writeStartedAt + duration - performance.now()),
  );
  report.committedResponsesWithinWindow = report.jobs.filter(
    (j) => j.status === 200 && j.sentOffsetMs + j.responseMs <= duration,
  ).length;
  await Promise.all(pending);
  if (rejoining) await rejoining;
  report.writeDrainSeconds = (performance.now() - report.writeStartedAt) / 1000;
  if (report.jobs.some((j) => j.ambiguous)) {
    await delay(10000);
    auditRows = await audit();
    await delay(10000);
    const again = await audit();
    assert.equal(
      again.length,
      auditRows.length,
      "Ambiguous writes still settling; restoration deferred",
    );
    auditRows = again;
  } else auditRows = await audit();
  const committed = auditRows.filter((r) => r.phase === "write");
  report.committedUpdates = committed.length;
  report.auditActors = new Set(committed.map((r) => r.actor)).size;
  const current = await snapshot();
  await until(
    () => clients.every((c) => c.state?.revision === current.revision),
    30000,
    "Viewers did not converge after writes",
  );
  report.convergedAfterWrites = clients.filter(
    (c) => stable(c.state) === stable(current),
  ).length;
  report.pingAfterWrites = await ping(clients);
  const continuous = clients.filter((c) => c.continuous),
    latencies = [];
  let missing = 0;
  for (const row of committed) {
    const job = report.jobs.find((j) => j.sequence === row.sequence);
    for (const c of continuous) {
      const received = c.received.get(row.revision);
      if (received === undefined) missing++;
      else latencies.push(received - job.sentAt);
    }
  }
  latencies.sort((a, b) => a - b);
  const pct = (p) => latencies[Math.ceil(latencies.length * p) - 1] ?? null;
  report.continuousViewers = continuous.length;
  report.missedContinuousDeliveries = missing;
  report.propagationMs = {
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
    samples: latencies.length,
  };
  report.result =
    committed.length === offered &&
    report.committedResponsesWithinWindow === offered &&
    (localSmoke || windowSeconds === 120) &&
    missing === 0 &&
    report.convergedAfterWrites === count &&
    report.pingAfterWrites === count &&
    !report.unexpectedCloses &&
    !report.regressions &&
    pct(0.95) <= 1000 &&
    pct(0.99) <= 2000
      ? "PASS"
      : "FAIL";
} catch (error) {
  report.result = "FAIL";
  report.errors.push(error.message);
} finally {
  // Restore values only if a test commit still owns the current zone revision.
  if (writesStarted) {
    try {
      if (!auditRows.length) auditRows = await audit();
      const current = await snapshot();
      for (const original of baseline.occupancy.filter((o) =>
        actors.some((a) => a.zones.includes(o.zone)),
      )) {
        const now = current.occupancy.find((o) => o.zone === original.zone);
        if (now.occupied === original.occupied) {
          report.restore.push({
            zone: original.zone,
            result: "Original value already present",
          });
          continue;
        }
        if (
          !auditRows.some(
            (r) => r.revision === now.revision && r.zone === original.zone,
          )
        ) {
          report.restore.push({
            zone: original.zone,
            result: "Skipped: later external/unknown revision",
          });
          continue;
        }
        const actor = actors.find(
          (a) => !a.disabled && a.zones.includes(original.zone),
        );
        assert.ok(actor, "No remaining authorized organizer for restoration");
        await delay(
          Math.max(
            0,
            (actor.cooldown ?? 0) - performance.now(),
            (actor.lastPost ?? 0) + 750 - performance.now(),
          ),
        );
        const r = await post(actor, {
          kind: "occupancy",
          zone: original.zone,
          expected: now.revision,
          occupied: original.occupied,
          loadTest: runId,
          sequence: offered + report.restore.length,
          phase: "restore",
        });
        report.restore.push({
          zone: original.zone,
          status: r.status,
          result:
            r.status === 200
              ? "Restored through API"
              : "Restoration failed/conflicted",
        });
      }
      const final = await snapshot();
      await until(
        () => clients.every((c) => c.state?.revision === final.revision),
        10000,
        "Final restoration did not converge",
      );
      report.finalRevision = final.revision;
      report.finalConverged = clients.filter(
        (c) => stable(c.state) === stable(final),
      ).length;
      report.occupancyValuesRestored = baseline.occupancy.every(
        (o) =>
          final.occupancy.find((n) => n.zone === o.zone)?.occupied ===
          o.occupied,
      );
      report.lifecycleUnchanged =
        JSON.stringify([final.sessions, final.promotions, final.clock]) ===
        JSON.stringify([
          baseline.sessions,
          baseline.promotions,
          baseline.clock,
        ]);
    } catch (error) {
      report.errors.push(`Restoration: ${error.message}`);
      report.result = "FAIL";
    }
  }
  // Retain observations even when a convergence assertion failed. Never discard
  // evidence needed to distinguish stale readers from a wholly failed broadcast.
  report.observerRevisionDistribution = {};
  for (const c of clients) {
    const key = String(c.state?.revision ?? "uninitialized");
    report.observerRevisionDistribution[key] =
      (report.observerRevisionDistribution[key] ?? 0) + 1;
  }
  if (writesStarted && auditRows.length) {
    const committed = auditRows.filter((r) => r.phase === "write");
    const continuous = clients.filter((c) => c.continuous);
    const latency = [];
    let missing = 0;
    for (const row of committed) {
      const job = report.jobs.find((j) => j.sequence === row.sequence);
      for (const c of continuous) {
        const received = c.received.get(row.revision);
        if (received === undefined) missing++;
        else if (job?.sentAt !== undefined) latency.push(received - job.sentAt);
      }
    }
    latency.sort((a, b) => a - b);
    report.deliveryEvidence = {
      continuousViewers: continuous.length,
      committedRevisions: committed.length,
      missingDeliveries: missing,
      samples: latency.length,
      p50: latency[Math.ceil(latency.length * 0.5) - 1] ?? null,
      p95: latency[Math.ceil(latency.length * 0.95) - 1] ?? null,
      p99: latency[Math.ceil(latency.length * 0.99) - 1] ?? null,
    };
  }
  stopped = true;
  await closeGroup(clients);
  for (const ws of sockets) {
    intentional.add(ws);
    ws.terminate();
  }
  await delay(250);
  clearTimeout(hard);
  if (
    report.occupancyValuesRestored === false ||
    report.lifecycleUnchanged === false
  )
    report.result = "FAIL";
  report.remainingSockets = sockets.size;
  report.finished = new Date().toISOString();
  // Response bodies, actor IDs and cookies are deliberately excluded.
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  const { jobs: ignored, ...summary } = report;
  void ignored;
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = report.result === "PASS" ? 0 : 1;
}
