// Isolated real-workerd/D1 regression: unpaced arrivals, slow external I/O,
// subscribe/commit races, ambiguous commits, durable limits and restart/outbox.
// Test hooks exist only in this generated harness, never in the deployed Worker.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import WebSocket from "ws";

const count = Number(process.argv[2] ?? 1400);
assert.ok(Number.isInteger(count) && count > 0 && count <= 1800);
const reportPath = process.argv[3] ?? "/tmp/hall-arrival-local.json";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hall-arrival-"));
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import { HallCoordinator as Base } from './workers/hall-live/index.ts';
      export class HallCoordinator extends Base {
        reads = 0; delayMs = 75; reading = false; failRead = false;
        constructor(ctx, env) {
          const batch = env.DB.batch.bind(env.DB);
          const wrapped = { prepare: env.DB.prepare.bind(env.DB), batch: async (statements) => {
            await new Promise(r => setTimeout(r, 75));
            if (statements.length > 4 && this.failBeforeCommit) {
              this.failBeforeCommit = false; throw Error('Injected pre-commit failure');
            }
            const result = await batch(statements);
            if (statements.length > 4 && this.failCommitRead) {
              this.failCommitRead = false; this.failRead = true;
            }
            return result;
          }};
          super(ctx, { ...env, DB: wrapped });
        }
        async readSnapshot() {
          this.reads++; this.reading = true;
          try {
            await new Promise(r => setTimeout(r, this.delayMs));
            if (this.failRead) { this.failRead = false; throw Error('Injected post-commit read failure'); }
            return await super.readSnapshot();
          } finally { this.reading = false; }
        }
        stats() { return { reads: this.reads, reading: this.reading }; }
        slow(ms) { this.delayMs = ms; }
        ambiguous() { this.failCommitRead = true; }
        rejectCommit() { this.failBeforeCommit = true; }
        async legacy() {
          await this.ctx.storage.put('limits', {
            'actor:limit-test': { bucket: Math.floor(Date.now()/60000), count: 89 }
          });
        }
      }
      export default { async fetch(r, env) {
        const stub = env.HALL.get(env.HALL.idFromName('arrival'));
        const url = new URL(r.url);
        if (url.pathname === '/test/stats') return Response.json(await stub.stats());
        if (url.pathname === '/test/slow') { await stub.slow(Number(url.searchParams.get('ms'))); return new Response('ok'); }
        if (url.pathname === '/test/ambiguous') { await stub.ambiguous(); return new Response('ok'); }
        if (url.pathname === '/test/reject') { await stub.rejectCommit(); return new Response('ok'); }
        if (url.pathname === '/test/legacy') { await stub.legacy(); return new Response('ok'); }
        return stub.fetch(r);
      }};
    `,
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  external: ["cloudflare:workers"],
});
const options = convertV4MiniflareOptions({
  host: "127.0.0.1",
  port: 0,
  resourcePersistencePath: dir,
  workers: [
    {
      name: "arrival",
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: "2026-10-01",
      bindings: { HALL_LOCAL_TEST: "1" },
      d1Databases: { DB: "arrival" },
      durableObjects: {
        HALL: { className: "HallCoordinator", useSQLite: true },
      },
    },
  ],
});
let mf = new Miniflare(options),
  base;
const clients = [],
  sockets = new Set(),
  intentional = new WeakSet(),
  timings = [];
const report = {
  localOnly: true,
  clients: count,
  simultaneous: true,
  unexpectedCloses: 0,
  regressions: 0,
  gaps: 0,
};
const started = performance.now();
const hard = setTimeout(() => {
  console.error("Arrival test global deadline");
  process.exit(1);
}, 120000);
const request = (p, init) => mf.dispatchFetch("http://localhost" + p, init);
const snapshot = async () => (await request("/snapshot")).json();
const stats = async () => (await request("/test/stats")).json();
const actor = { id: "arrival-admin", organizer: true };
const mutation = (state, occupied) => ({
  kind: "occupancy",
  zone: "d7-auditorium",
  expected:
    state.occupancy.find((o) => o.zone === "d7-auditorium")?.revision ?? 0,
  occupied,
});
const write = (mutation, extra = {}) =>
  request("/write", {
    method: "POST",
    body: JSON.stringify({ actor, mutation, ...extra }),
  });
async function until(check, message) {
  const deadline = Date.now() + 10000;
  while (!(await check())) {
    assert.ok(Date.now() < deadline, message);
    await delay(10);
  }
}
function connect() {
  const client = { state: null };
  clients.push(client);
  const began = performance.now();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(base.replace(/^http/, "ws") + "/socket");
    client.ws = ws;
    sockets.add(ws);
    const timer = setTimeout(
      () => reject(Error("Initial snapshot deadline")),
      15000,
    );
    ws.on("message", (data) => {
      const state = JSON.parse(data);
      if (client.state) {
        if (state.revision < client.state.revision) report.regressions++;
        if (state.revision > client.state.revision + 1) report.gaps++;
      } else {
        timings.push(performance.now() - began);
        clearTimeout(timer);
        resolve(client);
      }
      client.state = state;
    });
    ws.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    ws.on("close", () => {
      clearTimeout(timer);
      sockets.delete(ws);
      if (!intentional.has(ws)) report.unexpectedCloses++;
    });
  });
}
async function closeAll() {
  for (const ws of sockets) {
    intentional.add(ws);
    ws.close(1000, "Test complete");
  }
  await until(() => sockets.size === 0, "Socket cleanup");
}
try {
  await mf.ready;
  base = (await mf.ready).origin;
  const db = await mf.getD1Database("DB");
  for (const file of [
    "migrations/0014_hall_live.sql",
    "migrations/0015_hall_manual_sessions.sql",
  ]) {
    const sql = fs.readFileSync(file, "utf8").replace(/^--.*$/gm, "");
    await db.batch(
      sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => db.prepare(s)),
    );
  }
  // Keep durable minute-bucket assertions within one minute.
  const remaining = 60000 - (Date.now() % 60000);
  if (remaining < 10000) await delay(remaining + 25);
  await request("/test/legacy");
  // No batching or ramp delay: every upgrade is issued before awaiting any result.
  await Promise.all(Array.from({ length: count }, connect));
  report.peakOpen = sockets.size;
  assert.equal(sockets.size, count);
  assert.equal(
    (await stats()).reads,
    1,
    "Cold burst must share exactly one D1 snapshot reconstruction",
  );
  report.coldBurstSnapshotReads = 1;
  const cold = timings.slice().sort((a, b) => a - b);
  report.coldSnapshotMs = {
    p50: cold[Math.ceil(count * 0.5) - 1],
    p95: cold[Math.ceil(count * 0.95) - 1],
    p99: cold[Math.ceil(count * 0.99) - 1],
  };
  assert.ok(
    report.coldSnapshotMs.p95 < 5000,
    "Cold burst p95 exceeds 5 seconds",
  );
  let state = await snapshot();
  await delay(25);
  assert.ok(
    (await snapshot()).serverNow > state.serverNow,
    "Cached server time must advance",
  );
  assert.equal((await stats()).reads, 1, "Public snapshots must reuse cache");

  // Writer is deliberately suspended in remote I/O while additional sockets join.
  await request("/test/slow?ms=500");
  const pendingWrite = write(mutation(state, 42));
  await until(
    async () => (await stats()).reading,
    "Writer must enter remote read",
  );
  const joined = await Promise.all(Array.from({ length: 100 }, connect));
  assert.ok(
    joined.every((c) => c.state.revision === state.revision),
    "Readers should remain available during D1 I/O",
  );
  const committed = await pendingWrite;
  assert.equal(committed.status, 200);
  state = await committed.json();
  await until(
    () => clients.every((c) => c.state.revision === state.revision),
    "Subscribe/write race lost update",
  );
  report.subscribeDuringWrite = "PASS";
  await request("/test/slow?ms=0");

  const race = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      write(mutation(state, i), {
        actor: { id: `race:${i}`, organizer: true },
      }),
    ),
  );
  assert.equal(race.filter((r) => r.status === 200).length, 1);
  assert.equal(race.filter((r) => r.status === 409).length, 19);
  state = await race.find((r) => r.status === 200).json();
  await until(
    () => clients.every((c) => c.state.revision === state.revision),
    "Race publication",
  );
  report.writerRace = "1 commit, 19 conflicts";

  await request("/test/reject");
  assert.equal((await write(mutation(state, 70))).status, 503);
  assert.equal((await snapshot()).revision, state.revision);
  assert.ok(
    clients.every((c) => c.state.revision === state.revision),
    "Failed commit must not enter cache or broadcast",
  );
  report.failedCommitKeepsCache = "PASS";

  await request("/test/ambiguous");
  assert.equal((await write(mutation(state, 71))).status, 503);
  await until(
    () => clients.every((c) => c.state.revision === state.revision + 1),
    "Alarm failed to recover committed write after read failure",
  );
  state = await snapshot();
  report.postCommitFailureRecovery = "PASS";
  const afterFailure = await write(mutation(state, 72));
  assert.equal(
    afterFailure.status,
    200,
    "Rejected queue operation must not poison subsequent writes",
  );
  state = await afterFailure.json();
  await until(
    () => clients.every((c) => c.state.revision === state.revision),
    "Post-failure publication",
  );

  const limitRequest = () =>
    write(
      { kind: "invalid", expected: 0 },
      { actor: { id: "limit-test", organizer: true } },
    );
  assert.equal(
    (await limitRequest()).status,
    400,
    "Legacy count 89 must migrate",
  );
  const limited = await limitRequest();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  report.legacyLimiterMigration = "PASS";

  // Retain a pending outbox across a complete runtime restart with persistent D1/DO.
  await closeAll();
  const suppressed = await write(mutation(state, 73), {
    failPublication: true,
  });
  assert.equal(suppressed.status, 200);
  state = await suppressed.json();
  assert.ok(
    await db.prepare("SELECT revision FROM hall_outbox WHERE id=1").first(),
  );
  await mf.dispose();
  mf = new Miniflare(options);
  await mf.ready;
  base = (await mf.ready).origin;
  const recovered = await connect();
  assert.equal(recovered.state.revision, state.revision);
  assert.deepEqual(recovered.state.occupancy, state.occupancy);
  const restartedDB = await mf.getD1Database("DB");
  assert.equal(
    await restartedDB
      .prepare("SELECT revision FROM hall_outbox WHERE id=1")
      .first(),
    null,
  );
  assert.equal(
    (await limitRequest()).status,
    429,
    "Actor limit must survive restart",
  );
  report.restartAndOutbox = "PASS";
  assert.equal(report.unexpectedCloses, 0);
  assert.equal(report.regressions, 0);
  assert.equal(report.gaps, 0);
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  for (const ws of sockets) {
    intentional.add(ws);
    ws.terminate();
  }
  await mf.dispose();
  clearTimeout(hard);
  fs.rmSync(dir, { recursive: true, force: true });
  report.elapsedSeconds = (performance.now() - started) / 1000;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
