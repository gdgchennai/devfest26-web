import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
// Exercise the actual TypeScript module without introducing a runtime/test dependency.
export function moduleUrl(file) {
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const bundled = source.replace(/from ['"]([^'"]+)['"]/g, (_, specifier) => {
    const resolved = specifier.startsWith("@/")
      ? path.resolve(specifier.slice(2) + ".ts")
      : path.resolve(path.dirname(file), specifier + ".ts");
    return `from '${moduleUrl(resolved)}'`;
  });
  return `data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`;
}
const { trackCards, acceptSnapshot, occupancyColor, sessionsForHall } =
  await import(moduleUrl(path.resolve("lib/hall-model.ts")));
const base = {
  revision: 2,
  serverNow: 1000,
  clock: null,
  occupancy: [],
  promotions: [],
  sessions: [],
};
const event = (id, track, start, end, extra = {}) => ({
  id,
  track,
  start: new Date(start).toISOString(),
  end: new Date(end).toISOString(),
  title: id,
  hall: "Shared hall",
  type: "talk",
  speakerSlugs: [],
  prerequisites: [],
  ...extra,
});
const sessions = [
  event("first", "d7-auditorium", 1000, 2000),
  event("second", "d7-auditorium", 3000, 4000),
  event("parallel", "d7-amphitheater", 1000, 2500),
  event("food", "d7-auditorium", 2000, 3000, { type: "break", hall: "F&B" }),
];
const cards = (now, state = base) => trackCards(sessions, { ...state, serverNow: now });
assert.equal(
  cards(999).find((c) => c.zone.id === "d7-auditorium").phase,
  "not-started",
);
assert.equal(
  cards(0).find((c) => c.zone.id === "d7-auditorium").primary.id,
  "first",
  "empty lifecycle shows each track's first event",
);
assert.equal(
  cards(0).find((c) => c.zone.id === "d7-amphitheater").primary.id,
  "parallel",
  "empty lifecycle shows each track's first event",
);
assert.equal(
  cards(999999).find((c) => c.zone.id === "d7-auditorium").primary.id,
  "first",
  "clock does not advance events",
);
const running = {
  ...base,
  sessions: [{ session: "first", status: "started" }],
};
assert.equal(
  cards(999999, running).find((c) => c.zone.id === "d7-auditorium").phase,
  "current",
);
const ended = { ...base, sessions: [{ session: "first", status: "ended" }] };
assert.equal(
  cards(0, ended).find((c) => c.zone.id === "d7-auditorium").phase,
  "gap",
);
assert.equal(
  cards(0, ended).find((c) => c.zone.id === "d7-auditorium").primary.id,
  "second",
);
assert.equal(
  cards(0, {
    ...base,
    sessions: [
      { session: "first", status: "ended" },
      { session: "second", status: "ended" },
    ],
  }).find((c) => c.zone.id === "d7-auditorium").phase,
  "finished",
);
assert.equal(
  cards(1000).find((c) => c.zone.id === "d7-amphitheater").primary.id,
  "parallel",
);
assert.equal(
  trackCards([], base).every((c) => !c.primary),
  true,
);
const state = {
  ...base,
  occupancy: [
    { zone: "d7-auditorium", occupied: 80, revision: 2, updated_at: 0 },
    { zone: "d7-amphitheater", occupied: 25, revision: 1, updated_at: 0 },
  ],
  promotions: [{ session: "first", recommended: true, position: null }],
};
assert.equal(
  cards(1000, state)[0].zone.id,
  "d7-amphitheater",
  "badge must not sort",
);
state.promotions[0].position = 0;
state.promotions[0].recommended = false;
assert.equal(
  cards(1000, state)[0].zone.id,
  "d7-auditorium",
  "pin is independent",
);
assert.equal(
  cards(2000, {
    ...state,
    sessions: [{ session: "first", status: "ended" }],
  }).find((c) => c.zone.id === "d7-auditorium").promotion,
  undefined,
  "manually ended pin cannot transfer",
);
assert.equal(
  cards(1000, state).at(-1).occupancy,
  undefined,
  "unknown sorts last",
);
const jumped = {
  ...base,
  sessions: [{ session: "later", status: "ended", updated_at: 20 }],
  occupancy: state.occupancy,
};
const reorderedAgenda = [
  ...sessions,
  event("later", "d7-auditorium", 5000, 6000),
  event("after-later", "d7-auditorium", 7000, 8000),
];
const suggestion = trackCards(reorderedAgenda, jumped).find(
  (c) => c.zone.id === "d7-auditorium",
);
assert.equal(
  suggestion.primary.id,
  "after-later",
  "follow the last ended event before returning to skipped earlier choices",
);
assert.equal(suggestion.next.id, "first", "skipped events remain available");
assert.deepEqual(
  suggestion.occupancy,
  state.occupancy[0],
  "selection cannot reset occupancy",
);
assert.equal(acceptSnapshot(base, { ...base, revision: 1 }), base);
assert.equal(
  acceptSnapshot(base, { ...base, serverNow: 999 }),
  base,
  "older same-revision reconciliation cannot rewind time",
);
assert.equal(
  sessionsForHall([...sessions, sessions[0]], "Shared hall").length,
  3,
  "hall sessions deduplicate IDs",
);
assert.equal(
  sessionsForHall(sessions, "F&B")[0].id,
  "food",
  "break belongs to its physical hall",
);
assert.equal(acceptSnapshot(base, { ...base, revision: 2 }).revision, 2);
assert.deepEqual([0, 49, 50, 79, 80, 99, 100].map(occupancyColor), [
  "bg-green",
  "bg-green",
  "bg-yellow",
  "bg-yellow",
  "bg-red",
  "bg-red",
  "bg-red",
]);
const tied = {
  ...base,
  occupancy: [
    { zone: "d7-auditorium", occupied: 25 },
    { zone: "d7-amphitheater", occupied: 25 },
  ],
};
assert.equal(cards(1000, tied)[0].zone.id, "d7-auditorium");
const unusual = [
  event("long", "d7-auditorium", 1000, 2000, {
    title: "Long title ".repeat(30),
    speakerSlugs: ["missing"],
  }),
];
assert.equal(trackCards(unusual, base)[0].primary.id, "long");
console.log(
  "Model: manual lifecycle independent of clock, gaps, breaks, parallel tracks, empty day, ties, unknown, promotion independence/noninheritance, revisions and thresholds passed.",
);
