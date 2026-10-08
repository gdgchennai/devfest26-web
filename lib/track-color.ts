import type { Track } from "@/site.config";

/**
 * One brand colour per track, used everywhere a track is named.
 * The core Google colours go to the two stages and the three D6 competitions.
 * Halftones cover the remaining programs so every filter pill stays distinct.
 * Lifted out of AgendaList, which owned the only copy while the homepage
 * rendered every track in blue.
 */
export type TrackSlug = Track["slug"];

type TrackPalette = {
  /** Label colour, e.g. the mono track name. */
  text: string;
  /** Solid fill, for dots and chips. */
  bg: string;
  /** The card's accent hairline. */
  border: string;
  /** Raw custom property, for gradients that can't take a utility class. */
  cssVar: string;
};

const PALETTE: Record<string, TrackPalette> = {
  "d7-auditorium": { text: "text-blue", bg: "bg-blue", border: "border-blue", cssVar: "var(--blue)" },
  "d7-amphitheater": { text: "text-green", bg: "bg-green", border: "border-green", cssVar: "var(--green)" },
  "agent-wars": { text: "text-red", bg: "bg-red", border: "border-red", cssVar: "var(--red)" },
  lightning: { text: "text-yellow", bg: "bg-yellow", border: "border-yellow", cssVar: "var(--yellow)" },
  "vibe-coding": { text: "text-purple", bg: "bg-purple", border: "border-purple", cssVar: "var(--purple)" },
  "raman-hall": {
    text: "text-blue-halftone",
    bg: "bg-blue-halftone",
    border: "border-blue-halftone",
    cssVar: "var(--blue-halftone)",
  },
  "creators-lounge": {
    text: "text-green-halftone",
    bg: "bg-green-halftone",
    border: "border-green-halftone",
    cssVar: "var(--green-halftone)",
  },
  "meetup-lounge": {
    text: "text-red-halftone",
    bg: "bg-red-halftone",
    border: "border-red-halftone",
    cssVar: "var(--red-halftone)",
  },
};

const NEUTRAL: TrackPalette = {
  text: "text-paper/60",
  bg: "bg-paper/30",
  border: "border-paper/20",
  cssVar: "var(--paper)",
};

/** Never throws on an unknown slug — content is author-edited JSON. `null` is
 *  a venue-wide session with no single track (see agendaSessionSchema). */
export function trackColor(slug: string | null): TrackPalette {
  return (slug ? PALETTE[slug] : undefined) ?? NEUTRAL;
}
