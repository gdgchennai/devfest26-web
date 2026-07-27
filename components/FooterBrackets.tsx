"use client";

import { usePathname } from "next/navigation";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

/*
 * Static footer brackets — the fallback lockup for everywhere the 3D
 * BracketsField won't settle a pair into the footer logo: any non-home route
 * (the field only lives on the homepage), and reduced-motion / lite / save-data
 * on the homepage (the field bails out there too).
 *
 * Positions/sizes are lifted straight from brand-assets/devfest-logo.svg,
 * expressed as percentages of the wo-brackets logo box (viewBox 1370×531) that
 * this sits inside:
 *   left bracket  x ∈ [-257.6, -80.9]  → left -18.80%, width 12.90%
 *   right bracket x ∈ [1449.4, 1626.2] → left 105.80%, width 12.90%
 * Both span the full box height. The svgs crop the exact bracket out of the
 * full-logo viewBox, so the shape matches the wordmark's brackets precisely.
 */

const BOX = { leftPct: -18.8, rightPct: 105.8, widthPct: 12.9 } as const;

function bracketStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: 0,
    height: "100%",
    width: `${BOX.widthPct}%`,
    left: `${side === "left" ? BOX.leftPct : BOX.rightPct}%`,
  };
}

export function FooterBrackets() {
  const pathname = usePathname();
  // Default true on the server / first paint: render the static pair unless we
  // positively know the 3D field is going to provide it (home + motion on).
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);
  const field3DProvides = pathname === "/" && !staticBaseline;
  if (field3DProvides) return null;

  return (
    <>
      {/* Left bracket, cropped from the full-logo viewBox (x 0..176.7). */}
      <svg
        aria-hidden
        style={bracketStyle("left")}
        viewBox="0 0 176.7 531"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M5.7 312.8H27.9C35.8 312.8 42.2 319.2 42.2 327.1V458.7C42.2 498.3 74.2 530.3 113.8 530.3H171C174.2 530.3 176.7 527.8 176.7 524.6V444.3C176.7 441.1 174.2 438.6 171 438.6H127.1C119.2 438.6 112.8 432.2 112.8 424.2V106.1C112.8 98.2 119.2 91.8 127.1 91.8H171C174.2 91.8 176.7 89.2 176.7 86.1V5.8C176.7 2.6 174.2 0 171 0H113.8C74.2 0 42.2 32.1 42.2 71.6V203.2C42.2 211.1 35.8 217.5 27.9 217.5H5.7C2.5 217.5 0 220 0 223.2V307.1C0 310.2 2.5 312.8 5.7 312.8Z"
          fill="var(--yellow)"
        />
      </svg>
      {/* Right bracket, cropped from the full-logo viewBox (x 1707..1883.8). */}
      <svg
        aria-hidden
        style={bracketStyle("right")}
        viewBox="1707 0 176.8 531"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M1878.1 217.6H1855.9C1848 217.6 1841.6 211.1 1841.6 203.2V71.6C1841.6 32.1 1809.5 0 1770 0H1712.7C1709.6 0 1707 2.6 1707 5.8V86.1C1707 89.2 1709.6 91.8 1712.7 91.8H1756.7C1764.6 91.8 1771 98.2 1771 106.1V424.2C1771 432.2 1764.6 438.6 1756.7 438.6H1712.7C1709.6 438.6 1707 441.1 1707 444.3V524.6C1707 527.8 1709.6 530.3 1712.7 530.3H1770C1809.5 530.3 1841.6 498.3 1841.6 458.7V327.2C1841.6 319.3 1848 312.9 1855.9 312.9H1878.1C1881.2 312.9 1883.8 310.3 1883.8 307.2V223.3C1883.8 220.1 1881.2 217.6 1878.1 217.6Z"
          fill="var(--yellow)"
        />
      </svg>
    </>
  );
}
