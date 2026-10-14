import { siteConfig } from "../site.config";
import type { AgendaSession } from "./schemas";

export const hallZones = siteConfig.tracks.map((t) => ({
  id: t.slug,
  name: t.name,
}));
export const STALE_MS = 5 * 60_000;
export type Occupancy = {
  zone: string;
  occupied: number;
  revision: number;
  updated_at: number;
};
export type Promotion = {
  session: string;
  recommended: boolean;
  position: number | null;
};
export type HallSnapshot = {
  revision: number;
  serverNow: number;
  clock: number | null;
  occupancy: Occupancy[];
  promotions: Promotion[];
};
export type HallActor = { id: string; organizer: boolean };
export type HallMutation =
  | { kind: "occupancy"; zone: string; occupied: number; expected: number }
  | { kind: "promotions"; promotions: Promotion[]; expected: number }
  | { kind: "clock"; now: number | null; expected: number };

export function occupancyColor(n: number) {
  return n < 50 ? "bg-green" : n < 80 ? "bg-yellow" : "bg-red";
}
// Breaks stay in physical-hall schedules, never claim a track's occupancy in F&B.
export function trackCards(
  agenda: AgendaSession[],
  state: HallSnapshot,
  now: number,
) {
  return hallZones
    .map((zone, order) => {
      const sessions = agenda
        .filter((s) => s.track === zone.id && s.type !== "break")
        .sort(
          (a, b) =>
            Date.parse(a.start) - Date.parse(b.start) ||
            a.id.localeCompare(b.id),
        );
      const primary =
        sessions.find(
          (s) => Date.parse(s.start) <= now && now < Date.parse(s.end),
        ) ?? sessions.find((s) => Date.parse(s.start) > now);
      const next =
        primary &&
        sessions.find(
          (s) =>
            Date.parse(s.start) >= Date.parse(primary.end) &&
            s.id !== primary.id,
        );
      const occupancy = state.occupancy.find((o) => o.zone === zone.id);
      const promotion =
        primary &&
        state.promotions.find(
          (p) => p.session === primary.id && Date.parse(primary.end) > now,
        );
      const phase = !primary ? "finished" : Date.parse(primary.start) <= now ? "current" : sessions.some(s => Date.parse(s.end) <= now) ? "gap" : "not-started";
      return { zone, order, primary, next, occupancy, promotion, phase };
    })
    .sort((a, b) => {
      const ap = a.promotion?.position ?? Infinity,
        bp = b.promotion?.position ?? Infinity;
      return (
        ap - bp ||
        (a.occupancy?.occupied ?? Infinity) -
          (b.occupancy?.occupied ?? Infinity) ||
        a.order - b.order
      );
    });
}

export function acceptSnapshot(
  previous: HallSnapshot | null,
  incoming: HallSnapshot,
) {
  return !previous ||
    incoming.revision > previous.revision ||
    (incoming.revision === previous.revision &&
      incoming.serverNow >= previous.serverNow)
    ? incoming
    : previous;
}

export function sessionsForHall(agenda: AgendaSession[], hall: string) {
  return Array.from(
    new Map(
      agenda.filter((s) => s.hall === hall).map((s) => [s.id, s]),
    ).values(),
  ).sort(
    (a, b) =>
      Date.parse(a.start) - Date.parse(b.start) || a.id.localeCompare(b.id),
  );
}
