import type { MetadataRoute } from "next";
import { siteConfig } from "@/site.config";
import { siteRoutes } from "@/lib/routes";
import speakers from "@/content/speakers.json";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = siteRoutes
    .filter((route) => !route.noIndex)
    .map((route) => ({
    url: `${siteConfig.url}${route.href}`,
    changeFrequency: route.href === "/" ? "weekly" : "monthly",
    priority: route.href === "/" ? 1 : 0.6,
  }));

  const ticketSelectEntry: MetadataRoute.Sitemap = [
    { url: `${siteConfig.url}/tickets/select`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const speakerEntries: MetadataRoute.Sitemap = (speakers as { slug: string }[]).map((speaker) => ({
    url: `${siteConfig.url}/speakers/${speaker.slug}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...ticketSelectEntry, ...speakerEntries];
}
