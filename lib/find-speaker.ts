import type { AgendaSession, Speaker } from "@/lib/schemas";

/** Client-safe lookup — speakers arrive as props from the content API / D1. */
export function findSpeaker(speakers: Speaker[], slug: string | null | undefined): Speaker | undefined {
  if (!slug) return undefined;
  return speakers.find((s) => s.slug === slug);
}

/** Same lookup for a co-presented talk's `speakerSlugs` — in listed order,
 *  silently dropping any slug that doesn't resolve rather than erroring, same
 *  as `findSpeaker`. */
export function findSpeakers(speakers: Speaker[], slugs: string[]): Speaker[] {
  return slugs.map((slug) => findSpeaker(speakers, slug)).filter((s): s is Speaker => s !== undefined);
}

/** "A", "A & B", or "A, B & C" — how a session's speakers are named as one
 *  line of text (the agenda list row, the markdown twin). */
export function joinSpeakerNames(speakers: Speaker[]): string {
  const names = speakers.map((s) => s.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** The sessions a speaker's `talkIds` reference, in agenda order (not
 *  `talkIds` order) — so a speaker's talk list reads chronologically, same as
 *  everywhere else a set of sessions is shown. Silently drops any id that
 *  doesn't resolve, same convention as `findSpeakers`. */
export function findTalksForSpeaker(agenda: AgendaSession[], speaker: Speaker): AgendaSession[] {
  return agenda.filter((session) => speaker.talkIds.includes(session.id));
}

/** The speaker roster (e.g. SpeakerWall's content.json order) re-ordered by
 *  when each speaker's earliest talk actually happens — so the lineup reads
 *  the same way the day does. `pinnedSlugs` stay first, in the order given
 *  (the keynote duo, who open the roster regardless of their own talk time).
 *  A speaker with no scheduled talk sorts after every speaker who has one,
 *  keeping its place relative to other talk-less speakers (a stable sort). */
export function sortSpeakersByAgenda(
  speakers: Speaker[],
  agenda: AgendaSession[],
  pinnedSlugs: string[] = [],
): Speaker[] {
  const earliestStart = new Map<string, number>();
  for (const speaker of speakers) {
    const starts = findTalksForSpeaker(agenda, speaker).map((s) => new Date(s.start).getTime());
    if (starts.length > 0) earliestStart.set(speaker.slug, Math.min(...starts));
  }

  const pinned = pinnedSlugs
    .map((slug) => findSpeaker(speakers, slug))
    .filter((s): s is Speaker => s !== undefined);
  const pinnedSet = new Set(pinned.map((s) => s.slug));

  const rest = speakers
    .filter((s) => !pinnedSet.has(s.slug))
    .map((speaker, index) => ({ speaker, index }))
    .sort((a, b) => {
      const aStart = earliestStart.get(a.speaker.slug) ?? Infinity;
      const bStart = earliestStart.get(b.speaker.slug) ?? Infinity;
      if (aStart !== bStart) return aStart - bStart;
      return a.index - b.index;
    })
    .map((x) => x.speaker);

  return [...pinned, ...rest];
}
