import type { AgendaSession } from "./schemas";
import { hallZones, STALE_MS, type HallSnapshot } from "./hall-model";

export const SESSION_RECOMMENDATION_WEIGHTS = { time: 35, seats: 65 } as const;

/** Triangular curve: -5 → 0, 0 → .5, 5 → 1, 10 → .5, 15 → 0. */
export function sessionTimeScore(minutesUntilStart: number) {
  return Math.max(0, 1 - Math.abs(minutesUntilStart - 5) / 10);
}

export function rankSessionRecommendations(
  agenda: AgendaSession[],
  snapshot: HallSnapshot,
  now: number,
  connected: boolean,
) {
  return agenda.flatMap((session) => {
    if (session.type === "break" || !hallZones.some((zone) => zone.id === session.track)) return [];
    const state = snapshot.sessions.find((entry) => entry.session === session.id);
    if (state?.status === "ended") return [];
    // Manual starts take precedence over the planned time when available.
    const start = state?.status === "started" && state.updated_at != null
      ? state.updated_at : Date.parse(session.start);
    const minutesUntilStart = (start - now) / 60_000;
    if (
      !Number.isFinite(minutesUntilStart) || minutesUntilStart < -5 || minutesUntilStart > 15 ||
      (state?.status !== "started" && Date.parse(session.end) <= now)
    ) return [];
    const occupancy = snapshot.occupancy.find((entry) => entry.zone === session.track);
    const seatsKnown = connected && !!occupancy && now - occupancy.updated_at <= STALE_MS;
    // A reported full hall is excluded even if its measurement is stale.
    if (occupancy && occupancy.occupied >= 100) return [];
    const availability = seatsKnown
      ? Math.max(0, Math.min(1, 1 - occupancy.occupied / 100)) : 0.25;
    const timeScore = sessionTimeScore(minutesUntilStart);
    return [{
      session, minutesUntilStart, seatsKnown, availability,
      score: SESSION_RECOMMENDATION_WEIGHTS.time * timeScore + SESSION_RECOMMENDATION_WEIGHTS.seats * availability,
    }];
  }).sort((a, b) => b.score - a.score || a.minutesUntilStart - b.minutesUntilStart || b.availability - a.availability || a.session.id.localeCompare(b.session.id));
}
