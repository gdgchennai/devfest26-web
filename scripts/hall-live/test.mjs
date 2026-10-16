import "./hook-tests.mjs";
import "./access-tests.mjs";
import "./admin-model-tests.mjs";
import "./identity-tests.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
const base = process.env.HALL_URL ?? "http://127.0.0.1:8787";
const origin = new URL(base).origin;
const snapshot = async () => {
  const r = await fetch(base + "/api/halls");
  assert.equal(r.status, 200);
  return r.json();
};
async function write(mutation, role = "organizer", extra = {}) {
  return fetch(base + "/api/admin/halls", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      cookie: `hall-dev=${role}`,
      ...extra,
    },
    body: JSON.stringify(mutation),
  });
}
const sessions = JSON.parse(fs.readFileSync("content/agenda.json", "utf8"));
let state = await snapshot();
// Finish running local fixtures before testing; preserve every measurement.
for (const active of state.sessions.filter((s) => s.status === "started")) {
  const event = sessions.find((s) => s.id === active.session);
  const ended = await write({
    kind: "session",
    zone: event.track,
    session: event.id,
    status: "ended",
    expected: state.revision,
  });
  assert.equal(ended.status, 200, await ended.clone().text());
  state = await ended.json();
}
let r = await write({
  kind: "clock",
  now: Date.parse("2026-10-17T11:00:00+05:30"),
  expected: state.revision,
});
assert.equal(r.status, 200, await r.clone().text());
state = await r.json();
const revision = (zone) =>
  state.occupancy.find((o) => o.zone === zone)?.revision ?? 0;
for (const occupied of [-1, 101, 1.5, "25", null])
  assert.equal(
    (
      await write({
        kind: "occupancy",
        zone: "d7-auditorium",
        occupied,
        expected: revision("d7-auditorium"),
      })
    ).status,
    400,
  );
assert.equal(
  (
    await write({
      kind: "occupancy",
      zone: "made-up",
      occupied: 25,
      expected: 0,
    })
  ).status,
  400,
);
const mutation = {
  kind: "occupancy",
  zone: "d7-auditorium",
  occupied: 25,
  expected: revision("d7-auditorium"),
};
assert.equal((await write(mutation, "public")).status, 401);
assert.equal((await write(mutation, "lead-deep")).status, 403);
assert.equal((await write(mutation, "unassigned")).status, 403);
assert.equal(
  (
    await write(mutation, "public", {
      "x-role": "organizer",
      "x-user-id": "dev:organizer",
    })
  ).status,
  401,
);
r = await write(mutation, "lead-tech");
assert.equal(r.status, 200, await r.clone().text());
state = await r.json();
assert.equal((await write(mutation, "lead-tech")).status, 409);
const beforeRace = state.revision;
const next = { ...mutation, expected: revision("d7-auditorium"), occupied: 50 };
const race = await Promise.all([
  write(next, "lead-tech"),
  write({ ...next, occupied: 75 }, "organizer"),
]);
assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
state = await snapshot();
assert.equal(
  state.revision,
  beforeRace + 1,
  "losing write must not create an audit revision",
);
const eligible = sessions.filter(
  (s) =>
    s.track &&
    s.type !== "break" &&
    !state.sessions.some((e) => e.session === s.id),
);
const a = eligible[0],
  b = eligible.find((s) => s.id !== a.id);
const promotions = [
  { session: a.id, recommended: false, position: 0 },
  { session: b.id, recommended: true, position: null },
];
assert.equal(
  (
    await write(
      { kind: "promotions", promotions, expected: state.revision },
      "lead-tech",
    )
  ).status,
  403,
);
r = await write({ kind: "promotions", promotions, expected: state.revision });
assert.equal(r.status, 200, await r.clone().text());
state = await r.json();
assert.deepEqual(
  state.promotions.find((p) => p.session === a.id),
  promotions[0],
);
assert.equal(
  (
    await write({
      kind: "promotions",
      promotions,
      expected: state.revision - 1,
    })
  ).status,
  409,
);
assert.equal(
  (
    await write({
      kind: "promotions",
      promotions: [...promotions, { ...promotions[0], session: b.id }],
      expected: state.revision,
    })
  ).status,
  400,
);
const orderRace = await Promise.all([
  write({ kind: "promotions", promotions, expected: state.revision }),
  write({
    kind: "promotions",
    promotions: promotions.map((p, i) => ({ ...p, position: i })).reverse(),
    expected: state.revision,
  }),
]);
assert.deepEqual(orderRace.map((r) => r.status).sort(), [200, 409]);
state = await snapshot();
// Subscribe while racing an authorized write. Snapshot/subscription must have no gap.
const socket = new WebSocket(base.replace(/^http/, "ws") + "/api/halls/socket");
let observed = null;
socket.onmessage = (e) => {
  const s = JSON.parse(e.data);
  if (!observed || s.revision >= observed.revision) observed = s;
};
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
r = await write({
  ...mutation,
  expected: revision("d7-auditorium"),
  occupied: 100,
});
assert.equal(r.status, 200, await r.clone().text());
state = await r.json();
for (let i = 0; i < 100 && observed?.revision !== state.revision; i++)
  await delay(20);
assert.equal(observed.revision, state.revision);
// Persist succeeds despite suppressed publication; the pre-scheduled alarm must recover.
r = await write(
  { ...mutation, expected: revision("d7-auditorium"), occupied: 65 },
  "organizer",
  { "x-hall-test-fail-publication": "1" },
);
assert.equal(r.status, 200, await r.clone().text());
state = await r.json();
for (let i = 0; i < 200 && observed?.revision !== state.revision; i++)
  await delay(25);
assert.equal(observed.revision, state.revision, "outbox alarm failed recovery");
r = await write({
  kind: "clock",
  now: Date.parse(a.end),
  expected: state.revision,
});
assert.equal(r.status, 200, await r.clone().text());
state = await r.json();
assert.equal(
  state.promotions.some((p) => p.session === a.id),
  true,
  "planned end time must not expire a promotion",
);
// Real transitions authorize per track, retain occupancy, and expire only ended event promotions.
const lifecycle = {
  kind: "session",
  zone: a.track,
  session: a.id,
  status: "started",
  expected: state.revision,
};
assert.equal((await write(lifecycle, "unassigned")).status, 403);
assert.equal((await write(lifecycle, "public")).status, 401);
assert.equal((await write({ ...lifecycle, zone: "made-up" })).status, 400);
assert.equal((await write({ ...lifecycle, status: "ended" })).status, 409);
const startRace = await Promise.all([write(lifecycle), write(lifecycle)]);
assert.deepEqual(startRace.map(r => r.status).sort(), [200,409], "exactly one concurrent event start commits");
state = await startRace.find(r => r.status === 200).json();
const beforeEnd = state.occupancy;
assert.equal(
  (await write({ ...lifecycle, expected: state.revision })).status,
  409,
);
const other = eligible.find((s) => s.track === a.track && s.id !== a.id);
if (other)
  assert.equal(
    (await write({ ...lifecycle, session: other.id, expected: state.revision }))
      .status,
    409,
  );
r = await write({ ...lifecycle, status: "ended", expected: state.revision });
assert.equal(r.status, 200, await r.clone().text());
state = await r.json();
assert.deepEqual(
  state.occupancy,
  beforeEnd,
  "event changes preserve measurements",
);
assert.equal(
  state.promotions.some((p) => p.session === a.id),
  false,
);
assert.equal(
  (
    await write({
      kind: "promotions",
      promotions: [promotions[0]],
      expected: state.revision,
    })
  ).status,
  400,
  "ended event cannot be promoted",
);
r = await write({ ...lifecycle, status: "started", expected: state.revision });
assert.equal(r.status, 200, await r.clone().text());
state = await r.json();
assert.equal(
  state.sessions.find((s) => s.session === a.id)?.status,
  "started",
  "ended event can be started again",
);
r = await write({ ...lifecycle, status: "ended", expected: state.revision });
assert.equal(r.status, 200, await r.clone().text());
state = await r.json();
assert.equal(
  (
    await write(
      { kind: "promotions", promotions: [], expected: state.revision },
      "admin-tech",
    )
  ).status,
  403,
  "track admin cannot promote",
);
assert.equal(
  (
    await write(
      { ...mutation, zone: "d7-amphitheater", expected: 0 },
      "admin-tech",
    )
  ).status,
  403,
  "track admin cannot cross tracks",
);
const own = eligible.find((s) => s.track === "d7-auditorium" && s.id !== a.id);
if (own) {
  const transition = {
    kind: "session",
    zone: own.track,
    session: own.id,
    status: "started",
    expected: state.revision,
  };
  assert.equal((await write(transition, "lead-deep")).status, 403);
  r = await write(transition, "admin-tech");
  assert.equal(r.status, 200, await r.clone().text());
  state = await r.json();
  r = await write(
    { ...transition, status: "ended", expected: state.revision },
    "lead-tech",
  );
  assert.equal(r.status, 200);
  state = await r.json();
}
socket.send("attempt-public-write");
await new Promise((resolve) => {
  socket.onclose = (e) => {
    assert.equal(e.code, 1008);
    resolve();
  };
});
const cross = await write(
  { ...mutation, expected: revision("d7-auditorium") },
  "organizer",
  { origin: "https://evil.example" },
);
assert.equal(cross.status, 403);
r = await fetch(base + "/api/admin/halls", {
  headers: { cookie: "hall-dev=lead-tech" },
});
assert.equal(r.status, 200);
assert.deepEqual((await r.json()).zones, ["d7-auditorium"]);
let throttled = false;
for (let i = 0; i < 95; i++) {
  const limited = await write(
    { ...mutation, expected: revision("d7-auditorium") },
    "unassigned",
  );
  if (limited.status === 429) {
    assert.equal(limited.headers.get("retry-after"), "60");
    throttled = true;
    break;
  }
  assert.equal(limited.status, 403);
}
assert.equal(throttled, true, "durable actor write throttle");
fs.writeFileSync(
  "/tmp/hall-restart-expected.json",
  JSON.stringify(await snapshot()),
);
console.log(
  "Workers API: validation, identities, assignment enforcement, revision race, atomic promotions, manual lifecycle, preserved occupancy, scoped admin, snapshot race, outbox recovery, public-message rejection and CSRF passed.",
);
