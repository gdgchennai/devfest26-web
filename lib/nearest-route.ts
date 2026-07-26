import { siteRoutes, type SiteRoute } from "@/lib/routes";

/**
 * Which real page did they probably mean?
 *
 * The single most useful thing a 404 can do is end the visit it interrupted,
 * so a mistyped or truncated URL gets offered the closest real route rather
 * than a shrug. `/speaker` → Speakers, `/agend` → Agenda.
 */

/** Standard Levenshtein, two-row variant — the strings here are URL-short. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, substitution);
    }
    previous = current;
  }

  return previous[b.length];
}

/*
 * Distance as a fraction of the longer string, so a typo in a short slug isn't
 * held to the same absolute budget as one in a long slug. 0.4 was picked
 * against the real route table: it accepts /speaker and /agend, and rejects
 * /sponsors → /speakers (0.5), which is correct — that page is retired, not
 * misspelled, and guessing at it would be worse than saying nothing.
 */
const MAX_DISSIMILARITY = 0.4;

export function nearestRoute(pathname: string): SiteRoute | null {
  const target = pathname.replace(/\/+$/, "").toLowerCase() || "/";
  if (target === "/") return null;

  let best: SiteRoute | null = null;
  let bestScore = Infinity;

  for (const route of siteRoutes) {
    if (route.href === "/") continue;

    const distance = editDistance(target, route.href.toLowerCase());
    const score = distance / Math.max(target.length, route.href.length);
    if (score < bestScore) {
      bestScore = score;
      best = route;
    }
  }

  return bestScore <= MAX_DISSIMILARITY ? best : null;
}
