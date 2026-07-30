"use client";

import Image from "next/image";
import { useState } from "react";
import { fallbackColorFor, type FallbackColor } from "@/lib/fallback-color";

/*
 * Brand halftones, with an ink label over them (7.0–11.7:1, AAA/AA). These
 * replaced four hand-mixed dark shades whose paper/55 label sat at 1.49–2.33:1
 * — effectively invisible. Halftones rather than pastels so a panel awaiting a
 * photo doesn't flash near-white against the dark page.
 */
const FALLBACK_BG: Record<FallbackColor, string> = {
  blue: "bg-blue-halftone",
  red: "bg-red-halftone",
  yellow: "bg-yellow-halftone",
  green: "bg-green-halftone",
};

/*
 * A brand shape per fallback colour, so a frame without its photo reads as a
 * designed panel rather than a flat swatch waiting for something. Paired to the
 * colour it already carries in the kit (dot is green, the brackets gold, the
 * slashes blue, the angle pink), so the panel stays one brand object.
 *
 * Used as a MASK, not an <img>: the source SVGs are drawn in their own brand
 * colour, which would clash on a halftone ground. Masking lets the shape be
 * tinted in ink — the same ink as the label — so the panel reads as one thing.
 */
const FALLBACK_SHAPE: Record<FallbackColor, string> = {
  blue: "/brand-shapes/double_slash.svg",
  red: "/brand-shapes/angle.svg",
  yellow: "/brand-shapes/left_bracket.svg",
  green: "/brand-shapes/dot.svg",
};

type FrameProps = {
  src: string | null;
  alt: string;
  title: string;
  aspectRatio?: string;
  /** Preloads via a <link> in <head>. Next 16 deprecated `priority` for this. */
  preload?: boolean;
  /**
   * Serve the raw `src` instead of a resized /_next/image variant. Use when the
   * image is preloaded by exact URL elsewhere (e.g. the intro flythrough, warmed
   * by useAssetsLoaded) so it hits the cache instead of fetching a fresh size.
   */
  unoptimized?: boolean;
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
  preload = false,
  unoptimized = false,
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
        {/* The brand mark. Centred and held at 18% so it reads as a watermark
            behind the label rather than competing with it — the label sits
            bottom-left, the mark centre, so they rarely overlap and the ink
            label keeps its 7.0–11.7:1 against the halftone either way. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            background: "var(--ink)",
            maskImage: `url("${FALLBACK_SHAPE[color]}")`,
            WebkitMaskImage: `url("${FALLBACK_SHAPE[color]}")`,
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
            maskSize: "42%",
            WebkitMaskSize: "42%",
          }}
        />
        <span className="relative font-mono text-[0.75rem] text-ink tabular-nums">{title}</span>
      </div>

      {src && (
        <Image
          src={src}
          alt={alt}
          fill
          preload={preload}
          unoptimized={unoptimized}
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
