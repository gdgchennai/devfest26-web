import type { AgendaSession } from "./schemas";
import { trackCards, type HallSnapshot, type Promotion } from "./hall-model";

/** Planned times are an operational hint, never an automatic lifecycle action. */
export function hallTiming(
  session: AgendaSession | undefined,
  phase: string,
  now: number,
) {
  if (!session) return { label: "Finished", tone: "text-paper/50" };
  if (phase === "current") {
    if (now < Date.parse(session.start))
      return { label: "Out of sync · early", tone: "text-red" };
    if (now >= Date.parse(session.end))
      return { label: "Out of sync · overrun", tone: "text-red" };
    return { label: "On schedule", tone: "text-green" };
  }
  return now >= Date.parse(session.start)
    ? { label: "Out of sync · awaiting start", tone: "text-red" }
    : { label: "Upcoming", tone: "text-paper/60" };
}

/** Stage a relative move using session IDs, so priority never transfers to a successor. */
export function moveHallPriority(
  agenda: AgendaSession[],
  snapshot: HallSnapshot,
  from: string,
  to: string,
  visibleOrder?: string[],
): Promotion[] {
  const cards = trackCards(agenda, snapshot);
  const fromId = cards.find((c) => c.zone.id === from)?.primary?.id;
  const toId = cards.find((c) => c.zone.id === to)?.primary?.id;
  if (!fromId || !toId || from === to) return snapshot.promotions;
  const order = visibleOrder ?? cards.map((c) => c.zone.id);
  const fromIndex = order.indexOf(from),
    toIndex = order.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return snapshot.promotions;
  const moved = [...order];
  moved.splice(toIndex, 0, ...moved.splice(fromIndex, 1));
  // Pin the minimum prefix needed to preserve this exact visible move. Rows
  // below that prefix retain availability ordering; existing pins are retained.
  let ids = moved
    .slice(0, Math.max(fromIndex, toIndex) + 1)
    .map((id) => cards.find((c) => c.zone.id === id)?.primary?.id)
    .filter((id): id is string => !!id);
  ids = ids.concat(
    snapshot.promotions
      .filter((p) => p.position !== null && !ids.includes(p.session))
      .sort((a, b) => a.position! - b.position!)
      .map((p) => p.session),
  );
  return snapshot.promotions
    .filter((p) => !ids.includes(p.session))
    .concat(
      ids.map((session, position) => ({
        session,
        position,
        recommended:
          snapshot.promotions.find((p) => p.session === session)?.recommended ??
          false,
      })),
    );
}
