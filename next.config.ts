import type { NextConfig } from "next";
import { withPostHogConfig } from "@posthog/nextjs-config";
import { IMAGE_DEVICE_SIZES, IMAGE_IMAGE_SIZES } from "./lib/image-sizes";

const imagesShared = {
  deviceSizes: [...IMAGE_DEVICE_SIZES],
  imageSizes: [...IMAGE_IMAGE_SIZES],
  qualities: [75],
  remotePatterns: [
    {
      protocol: "https" as const,
      hostname: "*.googleusercontent.com",
    },
    {
      protocol: "https" as const,
      hostname: "lh3.googleusercontent.com",
    },
  ],
};

/*
 * Images always go through Next's default loader (`/_next/image`): sharp in
 * `next dev`, the Worker `IMAGES` binding (Cloudflare Images) in production via
 * OpenNext. useAssetsLoaded.optimizedSrc() builds the same URLs.
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
  ...(process.env.NODE_ENV === "production" ? {} : { allowedDevOrigins: ["192.168.1.*"] }),
  images: {
    ...imagesShared,
    // AVIF first, WebP as fallback. Measured on the archive photos at
    // w=1200: 30→25 KB, 56→46 KB, 87→82 KB — roughly 14% off for
    // browsers that support it, and no browser is worse off. Next's
    // default is WebP only.
    formats: ["image/avif", "image/webp"],
  },
};

/**
 * `@posthog/nextjs-config` uploads error-tracking sourcemaps during
 * `next build`. It needs a personal API key (phx_…, never the public phc_
 * token) — skip the wrap when that isn't in the environment so local
 * `next dev` / deploys without the secret still build. Must be the
 * outermost config wrapper when it does run.
 *
 * Do not set `productionBrowserSourceMaps` ourselves: the plugin turns
 * that on only for the upload, then `deleteAfterUpload` strips the maps
 * so they don't ride along in the OpenNext Worker (3 MiB gz cap).
 */
function withOptionalPostHog(config: NextConfig): NextConfig {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY ?? process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID ?? process.env.POSTHOG_ENV_ID;
  if (!personalApiKey || !projectId) {
    return config;
  }
  return withPostHogConfig(config, {
    personalApiKey,
    projectId,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    sourcemaps: {
      enabled: true,
      deleteAfterUpload: true,
    },
  });
}

export default withOptionalPostHog(nextConfig);

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
