import type { NextConfig } from "next";

/*
 * Production hands resizing/format negotiation to ImageKit (Cloudflare Pages
 * doesn't run Next's built-in Node/sharp optimizer). Dev keeps Next's
 * built-in optimizer — a real "next dev" server can run it, and it's one
 * less thing (an ImageKit endpoint, network access) local iteration depends
 * on. useAssetsLoaded.ts's optimizedSrc() mirrors this same branch so the
 * preloader always warms the URL the current environment will actually
 * request — see the comment there.
 */
const nextConfig: NextConfig = {
  // Exposed (unprefixed) to both server and client bundles here, rather than
  // requiring the usual NEXT_PUBLIC_ prefix, since it gates rendering in
  // client components (Header, HamburgerMenu) as well as server pages.
  // AGENDA_READY: see lib/routes.ts. HERO_BUTTONS: optional comma-separated
  // allow-list of hero CTAs ("tickets,cfp,volunteer,agenda") — trims/hides the
  // hero button row without a code change. Both unprefixed (not NEXT_PUBLIC_)
  // because they gate rendering in client components too — see HeroCopy.tsx.
  env: {
    AGENDA_READY: process.env.AGENDA_READY,
    HERO_BUTTONS: process.env.HERO_BUTTONS,
  },
  // cacheComponents (PPR / `use cache`) needs the Node.js runtime and is not
  // safe on the Cloudflare Worker OpenNext target — keep the previous-model
  // `export const dynamic = "force-static"` on public pages instead.
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["gsap", "@gsap/react", "three", "lenis"],
  },
  ...(process.env.NODE_ENV === "production"
    ? {
        images: { loader: "custom", loaderFile: "./lib/imagekit-loader.ts" },
      }
    : {
        allowedDevOrigins: ["192.168.1.*"],
        // AVIF first, WebP as fallback. Measured on the archive photos at
        // w=1200: 30→25 KB, 56→46 KB, 87→82 KB — roughly 14% off for
        // browsers that support it, and no browser is worse off. Next's
        // default is WebP only.
        images: { formats: ["image/avif", "image/webp"] },
      }),
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
