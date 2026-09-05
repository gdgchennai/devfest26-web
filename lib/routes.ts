/**
 * Every page on the site, in one place.
 *
 * The header used to hold its own five-item list in `siteConfig.nav` while the
 * site actually had nine routes. A 404 that offers to send you somewhere is
 * only as good as its list of somewheres, and a second hand-written copy of
 * that list is how the 404 ends up recommending a page that no longer exists.
 * The header now filters this down via `inNav` instead.
 */
export type SiteRoute = {
  href: string;
  label: string;
  /** Shown on the 404's rescue grid. One line, says what is actually there. */
  description: string;
  /** Whether the header links to it. The header is curated; this list is not. */
  inNav: boolean;
  /** Account-gated pages: kept in this list so the 404 typo helper still
   *  resolves them, but excluded from the sitemap and disallowed in robots. */
  noIndex?: boolean;
};

/**
 * Off until the schedule and lineup are actually ready to publish — set
 * AGENDA_READY=true (see next.config.ts's `env`) to bring /agenda and
 * /speakers back into the nav, the 404 rescue grid, and nearestRoute's typo
 * suggestions all at once, since all three read this same list.
 */
export const AGENDA_READY = process.env.AGENDA_READY === "true";

export const siteRoutes: SiteRoute[] = [
  { href: "/", label: "Home", description: "Tracks, schedule preview and the lineup.", inNav: true },
  ...(AGENDA_READY
    ? [
        { href: "/agenda", label: "Agenda", description: "The full schedule for the day.", inNav: true },
        { href: "/speakers", label: "Speakers", description: "The lineup, and how to get on it.", inNav: true },
        {
          href: "/my-agenda",
          label: "My agenda",
          description: "Sessions you've saved. Sign in with Google.",
          inNav: false,
          noIndex: true,
        },
      ]
    : []),
  { href: "/tickets", label: "Tickets", description: "Pick an event and get on the list.", inNav: true },
  { href: "/memories", label: "Memories", description: "The 2024 and 2025 photo archive.", inNav: true },
  { href: "/contact", label: "Contact", description: "Reach the chapter directly.", inNav: false },
  { href: "/profile", label: "Profile", description: "Your account and saved sessions.", inNav: false, noIndex: true },
];

export const navRoutes: SiteRoute[] = siteRoutes.filter((r) => r.inNav);

/**
 * Pages that existed and deliberately do not any more. A visitor arriving on
 * one of these is not lost — they followed a link that used to work, often
 * from printed material we can't edit — so they get the actual reason and a
 * useful destination instead of a generic "not found" (see NotFoundRecovery).
 *
 * Currently empty: every previously-retired path (/about, /privacy) is now
 * served by a Cloudflare rewrite, and /sponsors and /code-of-conduct fall
 * through to the normal 404 rescue grid. The mechanism stays for the next one.
 */
export const retiredRoutes: Record<string, { reason: string; goto: string }> = {};
