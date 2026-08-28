import type { AgendaSession } from "@/lib/schemas";

/**
 * A stable identifier for an agenda entry. content/agenda.json has no ids of
 * its own, but (track, start) is unique within the schedule — one track can't
 * run two things at once — and both halves are already immutable content, so
 * a saved favorite keeps pointing at the same session across edits to titles,
 * halls or descriptions.
 */
export function sessionKey(session: Pick<AgendaSession, "track" | "start">): string {
  return `${session.track}@${session.start}`;
}

/** Resolve saved keys back to full sessions, preserving schedule order. */
export function sessionsForKeys(
  all: AgendaSession[],
  keys: Iterable<string>,
): AgendaSession[] {
  const wanted = new Set(keys);
  return all.filter((s) => wanted.has(sessionKey(s)));
}
