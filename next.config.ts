import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   allowedDevOrigins: ['192.168.1.37'],
  images: {
    /*
     * AVIF first, WebP as fallback. Measured on the archive photos at w=1200:
     * 30→25 KB, 56→46 KB, 87→82 KB — roughly 14% off for browsers that support
     * it, and no browser is worse off. The cost is a slower first encode per
     * variant and both formats held in cache.
     *
     * Next's default is WebP only, which meant AVIF-capable browsers were
     * being served WebP.
     */
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
