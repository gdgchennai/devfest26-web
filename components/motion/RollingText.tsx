"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { prefersReducedMotion } from "@/lib/motion-prefs";

gsap.registerPlugin(useGSAP, SplitText);

/* ------------------------------------------------------------------ *
 * Rolling text hover effect (after demos.gsap.com/demo/rolling-text).
 *
 * The label is stacked twice inside a single-line, clipped box: the
 * visible copy sits at rest, an identical copy waits one line below.
 * On hover the characters roll up together — the top copy exits through
 * the clip, the bottom copy rolls into its place — left-to-right with a
 * per-character stagger. It plays through exactly once per hover, then
 * reverses along the same path when the cursor leaves.
 * ------------------------------------------------------------------ */

const ROLL = {
  duration: 0.5,
  ease: "power4.inOut",
  stagger: 0.025,
} as const;

export function RollingText({
  children,
  className = "",
}: {
  /** Plain string — it gets duplicated and split per character. */
  children: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || prefersReducedMotion()) return;

      const top = root.querySelector<HTMLSpanElement>("[data-roll='top']");
      const bottom = root.querySelector<HTMLSpanElement>("[data-roll='bottom']");
      if (!top || !bottom) return;

      const splitTop = new SplitText(top, { type: "chars" });
      const splitBottom = new SplitText(bottom, { type: "chars" });

      // The clone waits one line below, ready to roll up into place.
      gsap.set(splitBottom.chars, { yPercent: 100 });

      tlRef.current = gsap
        .timeline({ paused: true })
        .to(splitTop.chars, { yPercent: -100, ...ROLL }, 0)
        .to(splitBottom.chars, { yPercent: 0, ...ROLL }, 0);

      return () => {
        splitTop.revert();
        splitBottom.revert();
        tlRef.current = null;
      };
    },
    { scope: rootRef },
  );

  return (
    <span
      ref={rootRef}
      onMouseEnter={() => tlRef.current?.play()}
      onMouseLeave={() => tlRef.current?.reverse()}
      className={`relative inline-block overflow-hidden align-bottom ${className}`.trim()}
    >
      <span data-roll="top" className="inline-block">
        {children}
      </span>
      {/* The incoming copy, stacked directly over the first. Hidden from
          assistive tech so the label isn't announced twice. */}
      <span data-roll="bottom" aria-hidden className="absolute left-0 top-0 inline-block">
        {children}
      </span>
    </span>
  );
}
