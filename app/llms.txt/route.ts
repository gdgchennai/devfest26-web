import { formatEventDate, siteConfig } from "@/site.config";
import { buildLlmsTxt } from "@/lib/llms-txt";
import { siteRoutes, unlistedPublicRoutes } from "@/lib/routes";
import { markdownUrl } from "@/lib/seo";

// Built at deploy time, so `AGENDA_READY` decides whether /agenda and /speakers are listed.
export const dynamic = "force-static";

/**
 * Short links on this domain that Cloudflare redirects to other sites (they are dashboard
 * rules, not app routes, so nothing in the repo enumerates them). Keep in step with the
 * dashboard; the CFP and volunteer targets are also `siteConfig.cfp` / `siteConfig.volunteer`.
 */
const SHORT_LINKS = [
  { path: "/cfp", purpose: "call for proposals" },
  { path: "/cfv", purpose: "volunteer sign-up" },
  { path: "/about", purpose: "the GDG Chennai chapter page" },
  { path: "/privacy", purpose: "the privacy policy" },
];

/** `/llms.txt` — a briefing for AI tools. Built from the same config and route lists as the
 *  site itself (see lib/llms-txt.ts), so it can't drift; `charset` is set here because a
 *  bare `text/plain` leaves the em dashes to the reader's guess. */
export function GET() {
  const pages = [...siteRoutes.filter((route) => !route.noIndex), ...unlistedPublicRoutes].map((route) => ({
    href: route.href,
    label: route.label,
    description: route.description,
    markdownUrl: markdownUrl(route.href),
  }));

  const body = buildLlmsTxt({
    origin: siteConfig.url,
    name: siteConfig.name,
    tagline: siteConfig.tagline,
    chapter: siteConfig.chapter,
    disclaimer: siteConfig.brandDisclaimer,
    dateLabel: siteConfig.date ? formatEventDate(siteConfig.date) : null,
    venue: { name: siteConfig.venue.name, line1: siteConfig.venue.line1, line2: siteConfig.venue.line2 },
    email: siteConfig.contact.email,
    cfpUrl: siteConfig.cfp.formUrl,
    volunteerUrl: siteConfig.volunteer.formUrl,
    sponsorshipBrochureUrl: siteConfig.sponsorship.brochureUrl,
    tracks: siteConfig.tracks,
    pages,
    shortLinks: SHORT_LINKS,
    accountPaths: [...siteRoutes.filter((route) => route.noIndex).map((route) => route.href), "/signin"],
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
