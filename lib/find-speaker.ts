import type { Speaker } from "@/lib/schemas";

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
