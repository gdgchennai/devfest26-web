"use client";

import Image from "next/image";
import { useState } from "react";
import { fallbackColorFor, type FallbackColor } from "@/lib/fallback-color";

const FALLBACK_BG: Record<FallbackColor, string> = {
  blue: "bg-fb-blue",
  red: "bg-fb-red",
  yellow: "bg-fb-yellow",
  green: "bg-fb-green",
};

type FrameProps = {
  src: string | null;
  alt: string;
  title: string;
  aspectRatio?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Previous frame's fallback colour, so adjacent frames never match. */
  previousColor?: FallbackColor;
  onColorResolved?: (color: FallbackColor) => void;
};

/**
 * Every image on every route renders through this component. If `src` is
 * missing, the image errors, or the visitor is on Save-Data, the frame fills
 * with a flat muted Google-colour panel instead of a broken-image icon —
 * the page should never stop looking finished. Same panel doubles as the
 * pre-load placeholder, cross-fading to the photo on decode.
 */
export function Frame({
  src,
  alt,
  title,
  aspectRatio = "16 / 9",
  priority = false,
  sizes = "100vw",
  className = "",
  previousColor,
  onColorResolved,
}: FrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const color = fallbackColorFor(title || src || alt, previousColor);
  const showFallback = !src || errored || !loaded;

  return (
    <div
      className={`relative overflow-hidden rounded-[6px] ${className}`}
      style={{ aspectRatio }}
    >
      <div
        className={`absolute inset-0 flex items-end p-3 transition-opacity duration-250 ${FALLBACK_BG[color]} ${
          showFallback ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!showFallback}
      >
        <span className="font-mono text-[0.75rem] text-paper/55 tabular-nums">{title}</span>
      </div>

      {src && (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={`object-cover transition-opacity duration-250 ${loaded && !errored ? "opacity-100" : "opacity-0"}`}
          onLoad={() => {
            setLoaded(true);
            onColorResolved?.(color);
          }}
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}
