import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExport, query } from "./pull-history.mjs";

test("hosted export converts payloads and includes display names without account secrets", () => {
  const bundle = buildExport([{ success: true, results: [{ revision: 1, actor: "lead", actor_name: "Track lead", changed_at: 1792207800000, payload: '{"kind":"occupancy","zone":"d7-auditorium","occupied":75}', unexpected: "not exported" }] }], []);
  assert.equal(bundle.audit[0].payload.occupied, 75);
  assert.equal(bundle.actors.lead, "Track lead");
  assert.equal(bundle.audit[0].unexpected, undefined);
});
test("failed or oversized exports are rejected", () => {
  assert.throws(() => buildExport([{ success: false, results: [] }], []), /successful/);
  assert.throws(() => buildExport([{ success: true, results: Array(50001).fill({}) }], []), /50,000/);
  assert.throws(() => buildExport([], []), /successful/);
});
test("hosted export uses one bounded SELECT without personal auth columns", () => {
  assert.match(query, /^SELECT /);
  assert.match(query, /ORDER BY a.revision LIMIT 50001$/);
  assert.doesNotMatch(query, /INSERT|UPDATE|DELETE|google_sub|email|token/);
});
