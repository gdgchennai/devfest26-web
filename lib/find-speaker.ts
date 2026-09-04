import type { Speaker } from "@/lib/schemas";

/** Client-safe lookup — speakers arrive as props from the content API / D1. */
export function findSpeaker(speakers: Speaker[], slug: string | null | undefined): Speaker | undefined {
  if (!slug) return undefined;
  return speakers.find((s) => s.slug === slug);
}
