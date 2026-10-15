import assert from "node:assert/strict";
import path from "node:path";
import { moduleUrl } from "./model-tests.mjs";
const { hallTiming, moveHallPriority } = await import(
  moduleUrl(path.resolve("lib/hall-admin-model.ts"))
);
const { trackCards, hallZones } = await import(
  moduleUrl(path.resolve("lib/hall-model.ts"))
);
const agenda = hallZones
  .slice(0, 4)
  .map(({ id: track }, i) => ({
    id: `event-${i}`,
    track,
    type: "talk",
    start: new Date(1000).toISOString(),
    end: new Date(2000).toISOString(),
  }));
const state = {
  revision: 3,
  serverNow: 1500,
  clock: null,
  sessions: [],
  promotions: [],
  occupancy: [],
};
const event = agenda[0];
assert.equal(hallTiming(event, "current", 999).label, "Out of sync · early");
assert.equal(hallTiming(event, "current", 1000).tone, "text-green");
assert.equal(hallTiming(event, "current", 2000).label, "Out of sync · overrun");
assert.equal(
  hallTiming(event, "not-started", 1000).label,
  "Out of sync · awaiting start",
);
assert.equal(hallTiming(event, "not-started", 999).label, "Upcoming");
assert.equal(hallTiming(undefined, "finished", 999).label, "Finished");
const before = structuredClone(state);
const cards = trackCards(agenda, state).filter((c) => c.primary);
assert.ok(cards.length >= 2);
const order = cards.map((c) => c.zone.id);
const promoted = moveHallPriority(agenda, state, order[1], order[0], order);
assert.deepEqual(
  state,
  before,
  "staging a move must not change committed state",
);
assert.equal(
  trackCards(agenda, { ...state, promotions: promoted })[0].zone.id,
  order[1],
);
const lowerMove = moveHallPriority(agenda, state, order[3], order[2], order);
assert.deepEqual(
  trackCards(agenda, { ...state, promotions: lowerMove })
    .filter((c) => c.primary)
    .map((c) => c.zone.id),
  [order[0], order[1], order[3], order[2]],
  "an arrow move changes exactly one position",
);
assert.equal(
  promoted.every((p) => !p.recommended),
  true,
  "reordering must not add recommendations",
);
const badgeState = {...state,promotions:[{session:agenda[1].id,recommended:true,position:null}]};
assert.equal(moveHallPriority(agenda,badgeState,order[1],order[0],order).find(p=>p.session === agenda[1].id).recommended,true,"moving preserves existing recommendations");
const successor = {
  ...agenda.find(s => s.track === order[1]),
  id: "successor",
  start: new Date(3000).toISOString(),
};
const ended = {
  ...state,
  promotions: promoted,
  sessions: [
    { session: agenda.find((s) => s.track === order[1]).id, status: "ended" },
  ],
};
assert.equal(
  trackCards([...agenda, successor], ended).find((c) => c.zone.id === order[1])
    .promotion,
  undefined,
  "ended priority never transfers",
);
console.log(
  "Admin overview: schedule boundaries, immutable staged ordering, badge independence, and ended-event priority noninheritance passed.",
);
