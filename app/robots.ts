import type { MetadataRoute } from "next";
import { siteConfig } from "@/site.config";

/**
 * Paths crawlers must not fetch. Longest match wins (RFC 9309, and how Google and
 * Bing read it), so `/api/content` below can be re-allowed inside the blocked `/api/`.
 *
 * - The account pages match the `noIndex` routes in `lib/routes.ts`.
 * - All of `/api/` is blocked except `/api/content`: the leaderboard, game and auth
 *   routes are JSON for the site's own pages, and some run a database query per hit.
 *   Blocking the prefix (not a list of routes) covers the next API route too.
 *
 * `/md/*` is deliberately NOT here. Those pages are crawlable on purpose: they carry
 * `X-Robots-Tag: noindex` and a canonical `Link` back to the HTML page (see
 * `next.config.ts`), and `noindex` only works if the crawler is allowed to read it.
 * Blocking them here would hide those headers and turn away agents that follow the
 * `<link rel="alternate" type="text/markdown">` every page advertises.
 */
const DISALLOW = ["/profile", "/my-agenda", "/signin", "/api/"];

/** `/` is the default; `/api/content` is the machine-readable data `llms.txt` points at. */
const ALLOW = ["/", "/api/content"];

/**
 * Open to search, to AI answers (`ai-input`) and to AI training (`ai-train`) — Cloudflare's
 * Content-Signal convention. The signal is advisory (only crawlers that read it honour it),
 * so this states the policy rather than enforcing it. It has to agree with what the site
 * publishes for AI tools: `/llms.txt`, the `/md/*` pages and `/api/content` exist to be
 * read, and `/llms.txt` says the same thing in words. Change them together: flip a value
 * here and also its sentence in lib/llms-txt.ts.
 */
const CONTENT_SIGNAL = "search=yes, ai-train=yes, ai-input=yes";

export default function robots(): MetadataRoute.Robots {
  return {
    // One group. Googlebot and Google-InspectionTool used to have their own copies of
    // the same rules; a crawler with no group of its own falls back to `*`, so they
    // behave identically and there is one list to keep right instead of three.
    rules: [{ userAgent: "*", allow: ALLOW, disallow: DISALLOW, other: { "Content-Signal": CONTENT_SIGNAL } }],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
