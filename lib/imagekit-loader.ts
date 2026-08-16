"use client";

/*
 * next.config.ts only wires this in as the image loader for production
 * builds — dev keeps Next's built-in optimizer instead (see there for why).
 * So this only ever runs in prod, and the one thing left to guard against is
 * the env var itself being unset there.
 */
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

/**
 * Shared with useAssetsLoaded's preloader, which must build the exact URL
 * this loader will — a mismatched quality means the preloader warms a
 * variant the browser never asks for.
 */
export const IMAGEKIT_QUALITY = 80;

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

  const params = [`w-${width}`, `q-${quality ?? IMAGEKIT_QUALITY}`, "f-auto"];
  return `${IMAGEKIT_URL_ENDPOINT}/2026/${src.replace(/^\//, "")}?tr=${params.join(",")}`;
}
