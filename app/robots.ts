import type { MetadataRoute } from "next";
import { siteConfig } from "@/site.config";

export default function robots(): MetadataRoute.Robots {
  const origin = siteConfig.url;
  return {
    rules: [
      {
        userAgent: "Googlebot",
        allow: ["/", "/api/content"],
        disallow: ["/profile", "/my-agenda", "/signin", "/api/auth/", "/api/favorites", "/md"],
      },
      {
        userAgent: "Google-InspectionTool",
        allow: ["/", "/api/content"],
        disallow: ["/profile", "/my-agenda", "/signin", "/api/auth/", "/api/favorites", "/md"],
      },
      {
        userAgent: "*",
        allow: ["/", "/api/content"],
        disallow: ["/profile", "/my-agenda", "/signin", "/api/auth/", "/api/favorites", "/md"],
        other: {
          "Content-Signal": "search=yes, ai-train=no, ai-input=no",
        },
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
