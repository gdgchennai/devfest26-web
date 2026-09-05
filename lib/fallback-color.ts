export const FALLBACK_COLORS = ["blue", "red", "yellow", "green"] as const;
export type FallbackColor = (typeof FALLBACK_COLORS)[number];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic per-image fallback colour. Walks a permutation from the
 * filename hash and skips forward when it would collide with the previous
 * frame's colour, so adjacent frames never match — without ever using
 * Math.random(), which would reshuffle on every re-render / break hydration.
 */
export function fallbackColorFor(filename: string, previousColor?: FallbackColor): FallbackColor {
  const hash = hashString(filename);
  let index = hash % FALLBACK_COLORS.length;
  if (previousColor && FALLBACK_COLORS[index] === previousColor) {
    index = (index + 1) % FALLBACK_COLORS.length;
  }
  return FALLBACK_COLORS[index];
}

/** Tailwind halftone class for a fallback colour — lives here so `Frame.tsx`
 *  can stay a component-only module (Fast Refresh). */
export const FALLBACK_BG: Record<FallbackColor, string> = {
  blue: "bg-blue-halftone",
  red: "bg-red-halftone",
  yellow: "bg-yellow-halftone",
  green: "bg-green-halftone",
};
