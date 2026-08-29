import type { MetadataRoute } from "next";
import { siteConfig } from "@/site.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Account-gated, per-user pages — nothing for a crawler to index.
      disallow: ["/profile", "/my-agenda", "/signin", "/api/"],
      other: {
        "Content-Signal": "ai-train=no, search=yes, ai-input=no",
      },
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
