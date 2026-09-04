import type { NextConfig } from "next";
import { IMAGE_DEVICE_SIZES, IMAGE_IMAGE_SIZES } from "./lib/image-sizes";

const IMAGEKIT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

const imagesShared = {
  deviceSizes: [...IMAGE_DEVICE_SIZES],
  imageSizes: [...IMAGE_IMAGE_SIZES],
  // 75 = Next's default (dev `/_next/image`). 80 = ImageKit loader quality.
  qualities: [75, 80],
};

/*
 * Production prefers ImageKit when NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is set.
 * Without it, Next's default loader lets OpenNext use the Worker `IMAGES`
 * binding instead of shipping raw 1920px files. Dev always uses sharp via
 * `/_next/image`. useAssetsLoaded.optimizedSrc() must stay on the same branch.
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
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/md/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["gsap", "@gsap/react", "three", "lenis"],
  },
  ...(process.env.NODE_ENV === "production"
    ? {
        images: IMAGEKIT
          ? { ...imagesShared, loader: "custom" as const, loaderFile: "./lib/imagekit-loader.ts" }
          : { ...imagesShared, formats: ["image/avif" as const, "image/webp" as const] },
      }
    : {
        allowedDevOrigins: ["192.168.1.*"],
        images: {
          ...imagesShared,
          // AVIF first, WebP as fallback. Measured on the archive photos at
          // w=1200: 30→25 KB, 56→46 KB, 87→82 KB — roughly 14% off for
          // browsers that support it, and no browser is worse off. Next's
          // default is WebP only.
          formats: ["image/avif", "image/webp"],
        },
      }),
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
