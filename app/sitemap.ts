import type { MetadataRoute } from "next";
import { siteConfig } from "@/site.config";
import { AGENDA_READY, siteRoutes } from "@/lib/routes";
import { speakers } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = siteRoutes
    .filter((route) => !route.noIndex)
    .map((route) => ({
      url: `${siteConfig.url}${route.href === "/" ? "" : route.href}`,
      lastModified,
      changeFrequency: route.href === "/" ? "weekly" : "monthly",
      priority: route.href === "/" ? 1 : route.href === "/tickets" ? 0.9 : 0.7,
    }));

  const extras: MetadataRoute.Sitemap = [
    { url: `${siteConfig.url}/tickets/select`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteConfig.url}/partner`, lastModified, changeFrequency: "monthly", priority: 0.5 },
  ];

  const speakerEntries: MetadataRoute.Sitemap =
    AGENDA_READY && speakers.length > 0
      ? speakers.map((speaker) => ({
          url: `${siteConfig.url}/speakers/${speaker.slug}`,
          lastModified,
          changeFrequency: "weekly",
          priority: 0.6,
        }))
      : [];

  return [...staticEntries, ...extras, ...speakerEntries];
}
