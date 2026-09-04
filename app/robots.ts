import type { MetadataRoute } from "next";
import { siteConfig } from "@/site.config";

export default function robots(): MetadataRoute.Robots {
  const origin = siteConfig.url;
  return {
    rules: [
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/profile", "/my-agenda", "/signin", "/api/", "/md"],
      },
      {
        userAgent: "Google-InspectionTool",
        allow: "/",
        disallow: ["/profile", "/my-agenda", "/signin", "/api/", "/md"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/profile", "/my-agenda", "/signin", "/api/", "/md"],
        other: {
          "Content-Signal": "search=yes, ai-train=no, ai-input=no",
        },
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
