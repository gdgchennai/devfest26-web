import type { AgendaSession } from "./schemas";
import type { AnalysisData, AuditRow, Mutation } from "./post-event-analysis";
import { MINUTE } from "./post-event-analysis";

/** Deterministic synthetic reports for local design review. No production data. */
export function sampleAnalysisData(agenda: AgendaSession[]): AnalysisData {
  const pending: { actor: string; changed_at: number; payload: Mutation }[] = [];
  const tracks = [...new Set(agenda.map((s) => s.track).filter(Boolean))];
  const actors: Record<string, string> = {};
  for (const [index, track] of tracks.entries()) {
    const actor = `sample-lead-${index + 1}`;
    actors[actor] = `Sample lead ${index + 1}`;
    let available = 0;
    for (const [i, session] of agenda.filter((s) => s.track === track && s.type !== "break").sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).entries()) {
      const start = Math.max(available, Date.parse(session.start) + 35 * MINUTE + index * MINUTE);
      const end = start + Date.parse(session.end) - Date.parse(session.start);
      available = end + MINUTE;
      pending.push({ actor, changed_at: start, payload: { kind: "session", zone: track!, session: session.id, status: "started" } });
      let n = 0;
      for (let time = start + MINUTE; time < end; time += 3 * MINUTE, n++) {
        if (i % 4 === 2 && n > 2 && n < 6) continue;
        const occupied = i % 7 === 1 ? 10 + Math.min(n, 3) * 4
          : i % 9 === 4 ? (n >= 2 ? 0 : 18)
          : i % 3 === 0 && n >= 3 ? 40
          : Math.min(100, 60 + ((i + index) % 4) * 10 + Math.min(n, 3) * 4);
        pending.push({ actor, changed_at: time, payload: { kind: "occupancy", zone: track!, occupied } });
      }
      pending.push({ actor, changed_at: end, payload: { kind: "session", zone: track!, session: session.id, status: "ended" } });
    }
  }
  const audit: AuditRow[] = pending.sort((a, b) => a.changed_at - b.changed_at).map((row, i) => ({ ...row, revision: i + 1 }));
  return { audit, actors, agenda, source: "Synthetic sample — not event-day measurements", loadedAt: Date.now() };
}
