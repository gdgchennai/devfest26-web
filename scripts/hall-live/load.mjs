import assert from "node:assert/strict";
import fs from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
const base = process.env.HALL_URL ?? "http://127.0.0.1:8787",
  count = Number(process.env.HALL_CLIENTS ?? 1400),
  changes = Number(process.env.HALL_CHANGES ?? 500),
  soak = Number(process.env.HALL_SOAK_SECONDS ?? 120);
const started = Date.now(),
  cpuStart = process.cpuUsage(),
  timings = new Map(),
  latencies = [];
let duplicates = 0,
  outOfOrder = 0,
  disconnects = 0,
  reconnects = 0,
  conflicts = 0,
  unauthorized = 0,
  transportRetries = 0;
const clients = Array.from({ length: count }, () => ({
  socket: null,
  state: null,
  received: new Set(),
}));
async function connect(client) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      base.replace(/^http/, "ws") + "/api/halls/socket",
    );
    client.socket = socket;
    const timeout = setTimeout(
      () => reject(new Error("Connection timeout")),
      120000,
    );
    socket.onmessage = (e) => {
      const state = JSON.parse(e.data),
        before = client.state?.revision;
      if (before === state.revision) duplicates++;
      if (before > state.revision) outOfOrder++;
      if (before == null || state.revision >= before) client.state = state;
      const t = timings.get(state.revision);
      if (t) {latencies.push(performance.now() - t); client.received.add(state.revision);}
      clearTimeout(timeout);
      resolve();
    };
    socket.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Socket error"));
    };
    socket.onclose = () => {
      disconnects++;
    };
  });
}
for (let i = 0; i < count; i += 50) {
  await Promise.all(clients.slice(i, i + 50).map(connect));
  if (i % 200 === 0)
    console.log(`Connected ${Math.min(i + 50, count)}/${count}`);
  await delay(50);
}
let state = await (await fetch(base + "/api/halls")).json();
async function write(mutation, role = "organizer") {
  const predicted = state.revision + 1;
  timings.set(predicted, performance.now());
  const r = await fetch(base + "/api/admin/halls", {
    method: "POST",
    headers: {
      origin: base,
      cookie: `hall-dev=${role}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(mutation),
  });
  if (r.status === 409) conflicts++;
  assert.equal(r.status, 200, await r.clone().text());
  state = await r.json();
}
await write({
  kind: "clock",
  now: Date.parse("2026-10-17T11:00:00+05:30"),
  expected: state.revision,
});
const agenda = JSON.parse(fs.readFileSync("content/agenda.json", "utf8"));
const promoted = agenda
  .filter(
    (s) => s.track && s.type !== "break" && Date.parse(s.end) > state.serverNow,
  )
  .slice(0, 2);
async function eventChange(i) {
  if (i % 5 === 0)
    await write({
      kind: "promotions",
      expected: state.revision,
      promotions: promoted.map((s, j) => ({
        session: s.id,
        recommended: (i + j) % 2 === 0,
        position: j === i % 2 ? 0 : null,
      })),
    });
  else {
    const zone = i % 2 ? "d7-auditorium" : "d7-amphitheater";
    await write(
      {
        kind: "occupancy",
        zone,
        occupied: i % 101,
        expected: state.occupancy.find((o) => o.zone === zone)?.revision ?? 0,
      },
      i % 2 ? "lead-tech" : "lead-deep",
    );
  }
  if (i % 100 === 0) console.log(`Changes ${i}/${changes}`);
}
for(let i=0;i<changes-1;i++) await eventChange(i);
// Same-IP reconnect surge, with the final change racing resubscription.
const surge = clients.slice(0, Math.min(300, count));
for (const c of surge) c.socket.close(1000, "Surge test");
await delay(200);
const rejoining = Promise.all(
  surge.map((c) => {
    reconnects++;
    return connect(c);
  }),
);
await eventChange(changes-1);
await rejoining;
for (const role of ["public", "unassigned", "lead-deep"]) {
  let r;
  for(let attempt=0;attempt<4;attempt++) {
    r = await fetch(base + "/api/admin/halls", {
    method: "POST",
    headers: {
      origin: base,
      cookie: `hall-dev=${role}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      kind: "occupancy",
      zone: "d7-auditorium",
      occupied: 0,
      expected: 0,
    }),
  });
    if(![500,502,503,504].includes(r.status) || attempt===3) break;
    await r.text();transportRetries++;await delay(200*2**attempt);
  }
  assert.ok([401, 403].includes(r.status),`${role} denial returned ${r.status}: ${await r.text()}`);
  unauthorized++;
}
const convergenceDeadline = Date.now() + 30000;
while (
  clients.some((c) => c.state?.revision !== state.revision) &&
  Date.now() < convergenceDeadline
)
  await delay(50);
const missed = clients.filter(
  (c) => c.state?.revision !== state.revision,
).length;
assert.equal(missed, 0);
for (const c of clients) {
  assert.deepEqual(c.state.occupancy,state.occupancy);
  assert.deepEqual(c.state.promotions,state.promotions);
  assert.equal(c.state.clock,state.clock);
}
const healthyBroadcastGaps=clients.slice(surge.length).reduce((sum,c)=>sum+[...timings.keys()].filter(revision=>!c.received.has(revision)).length,0);
assert.equal(healthyBroadcastGaps,0,'continuously connected clients missed a committed broadcast');
console.log(
  `Converged ${count} clients at revision ${state.revision}. Soaking ${soak}s…`,
);
await delay(soak * 1000);
const unexpected = clients.filter(
  (c) => c.socket.readyState !== WebSocket.OPEN,
).length;
for (const c of clients) c.socket.close();
latencies.sort((a, b) => a - b);
const percentile = (p) =>
  Number((latencies[Math.floor((latencies.length - 1) * p)] ?? 0).toFixed(2));
const cpu = process.cpuUsage(cpuStart);
const report = {
  date: new Date().toISOString(),
  clients: count,
  acceptedConnections: count+reconnects,
  authorizedChanges: changes,
  setupClockWrites: 1,
  healthyBroadcastGaps,
  updatesSequential: true,
  finalRevision: state.revision,
  missed,
  unexpectedDisconnects: unexpected,
  disconnectEvents: disconnects,
  reconnects,
  conflicts,
  unauthorizedRejected: unauthorized,
  transportRetries,
  duplicates,
  outOfOrder,
  propagationMs: {
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
  },
  samples: latencies.length,
  elapsedSeconds: (Date.now() - started) / 1000,
  soakSeconds: soak,
  loadGeneratorRSS: process.memoryUsage().rss,
  loadGeneratorCPUms: (cpu.user + cpu.system) / 1000,
};
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(
  "/tmp/hall-load-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
assert.equal(unexpected, 0);
