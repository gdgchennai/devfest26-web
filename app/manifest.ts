import type { MetadataRoute } from "next";
import { siteConfig } from "@/site.config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.tagline,
    start_url: "/",
    display: "standalone",
    // Matches viewport.themeColor in layout.tsx — the site is committed-dark.
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        // Padded well inside the safe zone (logo sits in ~65% of the canvas
        // on an opaque background), so it's fine as both a regular and a
        // masked (circle/squircle) icon — see "any maskable" below.
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
