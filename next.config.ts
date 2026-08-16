import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   allowedDevOrigins: ['192.168.1.*'],
  images: {
    /*
     * Custom loader hands resizing/format negotiation to ImageKit in prod
     * (Cloudflare Pages doesn't run Next's built-in Node/sharp optimizer).
     * The loader itself falls back to unmodified /public paths in dev.
     */
    loader: "custom",
    loaderFile: "./lib/imagekit-loader.ts",
  },
};

export default nextConfig;
