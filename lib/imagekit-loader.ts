"use client";

/*
 * Only prod builds go through ImageKit. Dev serves straight from /public so
 * iterating locally doesn't burn ImageKit requests/bandwidth or require
 * network access.
 */
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

export default function imagekitLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  if (process.env.NODE_ENV !== "production" || !IMAGEKIT_URL_ENDPOINT) {
    return src;
  }

  const params = [`w-${width}`, `q-${quality ?? 80}`, "f-auto"];
  return `${IMAGEKIT_URL_ENDPOINT}/${src.replace(/^\//, "")}?tr=${params.join(",")}`;
}
