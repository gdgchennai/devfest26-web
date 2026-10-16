import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.env.HALL_URL ?? "http://127.0.0.1:8787";
const previous = process.argv.includes("--record")
  ? null
  : JSON.parse(fs.readFileSync("/tmp/hall-restart-expected.json", "utf8"));
const current = await (await fetch(base + "/api/halls")).json();
if (!previous) {
  fs.writeFileSync("/tmp/hall-restart-expected.json", JSON.stringify(current));
  console.log(`Recorded revision ${current.revision} before restart`);
  process.exit(0);
}
assert.equal(current.revision, previous.revision);
assert.deepEqual(current.occupancy, previous.occupancy);
assert.deepEqual(current.promotions, previous.promotions);
assert.deepEqual(current.sessions, previous.sessions);
assert.equal(current.clock, previous.clock);
console.log(
  `Persistence after restart verified at revision ${current.revision}`,
);
