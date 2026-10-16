import assert from "node:assert/strict";
const base = process.env.HALL_URL ?? "http://127.0.0.1:8787";
const roles = [
  ["organizer", null],
  ["admin-tech", "d7-auditorium"],
  ["admin-deep", "d7-amphitheater"],
  ["lead-tech", "d7-auditorium"],
  ["lead-deep", "d7-amphitheater"],
  ["user", false],
  ["public", false],
];
for (const [role, zone] of roles) {
  const selected = await fetch(base + "/api/halls/dev", {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({ role }),
  });
  assert.equal(selected.status, 200, role);
  const cookie = selected.headers.get("set-cookie").split(";")[0];
  const access = await fetch(base + "/api/admin/halls", {
    headers: { cookie },
  });
  if (role === "public") {
    assert.equal(access.status, 401);
    continue;
  }
  assert.equal(access.status, 200, role);
  const permissions = await access.json();
  assert.equal(permissions.actor.organizer, role === "organizer");
  if (zone === null) {
    assert.ok(permissions.zones.length > 2);
    continue;
  }
  assert.deepEqual(permissions.zones, zone ? [zone] : []);
  if (zone) {
    const state = await (await fetch(base + "/api/halls")).json();
    const measurement = state.occupancy.find((o) => o.zone === zone);
    const write = await fetch(base + "/api/admin/halls", {
      method: "POST",
      headers: { origin: base, cookie, "content-type": "application/json" },
      body: JSON.stringify({
        kind: "occupancy",
        zone,
        occupied: measurement?.occupied ?? 25,
        expected: measurement?.revision ?? 0,
      }),
    });
    assert.equal(write.status, 200, role + " own track");
  }
  for (const mutation of [
    {
      kind: "occupancy",
      zone: zone === "d7-auditorium" ? "d7-amphitheater" : "d7-auditorium",
      occupied: 25,
      expected: 0,
    },
    { kind: "promotions", promotions: [], expected: 0 },
    { kind: "reset", expected: 0 },
  ]) {
    const denied = await fetch(base + "/api/admin/halls", {
      method: "POST",
      headers: { origin: base, cookie, "content-type": "application/json" },
      body: JSON.stringify(mutation),
    });
    assert.equal(denied.status, 403, role + " restricted action");
  }
}
console.log(
  "Identity selector: super admin unchanged; both organizers/admins and leads scoped; user denied controls; signed-out denied authentication.",
);
