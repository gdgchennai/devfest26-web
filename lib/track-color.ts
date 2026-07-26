import type { Track } from "@/site.config";

/**
 * One Google colour per track, used everywhere a track is named. There are
 * exactly four tracks and exactly four core brand colours, so the mapping is
 * 1:1 and fixed — a fifth track would need a palette decision, not another
 * entry here. Lifted out of AgendaList, which owned the only copy while the
 * homepage rendered every track in blue.
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
  ai: { text: "text-blue", bg: "bg-blue", border: "border-blue", cssVar: "var(--blue)" },
  cloud: { text: "text-green", bg: "bg-green", border: "border-green", cssVar: "var(--green)" },
  mobile: { text: "text-red", bg: "bg-red", border: "border-red", cssVar: "var(--red)" },
  web: { text: "text-yellow", bg: "bg-yellow", border: "border-yellow", cssVar: "var(--yellow)" },
};

const NEUTRAL: TrackPalette = {
  text: "text-paper/60",
  bg: "bg-paper/30",
  border: "border-paper/20",
  cssVar: "var(--paper)",
};

/** Never throws on an unknown slug — content is author-edited JSON. */
export function trackColor(slug: string): TrackPalette {
  return PALETTE[slug] ?? NEUTRAL;
}
