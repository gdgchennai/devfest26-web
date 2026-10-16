import assert from "node:assert/strict";
const base = process.env.HALL_URL ?? "http://127.0.0.1:8787";
const headers = {
  origin: base,
  cookie: "hall-dev=organizer",
  "x-role": "organizer",
  "content-type": "application/json",
};
const dev = await fetch(base + "/api/halls/dev", {
  method: "POST",
  headers,
  body: JSON.stringify({ role: "organizer" }),
});
assert.equal(dev.status, 404);
const write = await fetch(base + "/api/admin/halls", {
  method: "POST",
  headers,
  body: JSON.stringify({ kind: "clock", now: 0, expected: 0 }),
});
assert.equal(write.status, 403, await write.text());
const access = await fetch(base + "/api/admin/halls", { headers });
assert.equal(access.status, 401, await access.text());
console.log(
  "Disabled runtime opt-in: role selector returns 404, spoofed organizer write returns 403, permission lookup returns 401.",
);
