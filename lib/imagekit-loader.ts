/*
 * next.config.ts only wires this in as the image loader when production
 * AND NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is set. Dev (and prod without the
 * endpoint) uses Next's optimizer — Cloudflare Images on the Worker, sharp
 * in `next dev`. useAssetsLoaded.optimizedSrc() mirrors that branch.
 */
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

/**
 * Shared with useAssetsLoaded's preloader, which must build the exact URL
 * this loader will — a mismatched quality means the preloader warms a
 * variant the browser never asks for.
 */
export const IMAGEKIT_QUALITY = 80;

export function usesImageKit(): boolean {
  return process.env.NODE_ENV === "production" && Boolean(IMAGEKIT_URL_ENDPOINT);
}

export default function imagekitLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  if (!IMAGEKIT_URL_ENDPOINT) return src;

  // f-auto: AVIF/WebP by Accept. c-at_max: never upscale a smaller original.
  // pr-true: progressive scan so a coarse preview paints before the full file.
  const params = [`w-${width}`, `q-${quality ?? IMAGEKIT_QUALITY}`, "f-auto", "c-at_max", "pr-true"];
  return `${IMAGEKIT_URL_ENDPOINT}/2026/${src.replace(/^\//, "")}?tr=${params.join(",")}`;
}
