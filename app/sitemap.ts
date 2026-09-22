import type { MetadataRoute } from "next";
import { AGENDA_READY, siteRoutes, unlistedPublicRoutes } from "@/lib/routes";
import { getSpeakers } from "@/lib/content";
import { absoluteUrl } from "@/lib/seo";

// Speaker pages come from content that can change without a deploy.
export const revalidate = 300;

/**
 * No `lastModified`, `changeFrequency` or `priority`, on purpose. This used to stamp
 * every URL with `new Date()` — i.e. "changed just now" for every page on every
 * rebuild — which is untrue, and crawlers that catch a sitemap out on `lastmod`
 * stop trusting it. `lastmod` is optional; an honest omission beats an invented date.
 * Google ignores `changefreq` and `priority` outright.
 *
 * What's listed: every indexable page in `lib/routes.ts` (`siteRoutes` minus
 * `noIndex`), the public pages kept out of the nav (`unlistedPublicRoutes`), and the
 * speaker pages once the agenda is live.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = new Set<string>([
    ...siteRoutes.filter((route) => !route.noIndex).map((route) => route.href),
    ...unlistedPublicRoutes.map((route) => route.href),
  ]);

  if (AGENDA_READY) {
    for (const path of await speakerPaths()) paths.add(path);
  }

  return [...paths].map((path) => ({ url: absoluteUrl(path) }));
}

/** Speaker pages. A content hiccup must not turn the whole sitemap into a 500. */
async function speakerPaths(): Promise<string[]> {
  try {
    return (await getSpeakers()).map((speaker) => `/speakers/${speaker.slug}`);
  } catch (error) {
    console.warn("sitemap: could not load speakers, listing the static pages only", error);
    return [];
  }
}
