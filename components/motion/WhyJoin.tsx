"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { siteConfig } from "@/site.config";
import { Card } from "@/components/Card";
import { HashTitle } from "@/components/motion/HashTitle";
import { prefersReducedMotion } from "@/lib/motion-prefs";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * "Why join" — the section where the page hands off to the light theme.
 *
 * There's a single fixed background (BracketsField) coloured var(--ink), and
 * all text is var(--paper). Both resolve from --theme (0 = dark, 1 = light), so
 * scrubbing --theme from 0 → 1 as this section is reached turns the fixed
 * background white and every font black at once — and it stays light below
 * (the scrub clamps at 1). Scrolling back up returns the upper sections to dark.
 */
export function WhyJoin() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !ref.current) return;
      gsap.fromTo(
        document.documentElement,
        { "--theme": 0 },
        {
          "--theme": 1,
          ease: "none",
          scrollTrigger: {
            // Begin the flip only once the section's top reaches the middle of
            // the viewport, and complete it over the next stretch of scroll.
            trigger: ref.current,
            start: "top 50%",
            end: "top 10%",
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );
      // This section sits below the pinned "What to expect" panel, whose spacer
      // sets our real scroll position. Recompute once everything's mounted so
      // this trigger measures against the final (spaced) layout, not a stale one.
      ScrollTrigger.refresh();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="flex min-h-[70vh] flex-col justify-center px-6 py-20 sm:px-10">
      <div className="mb-10">
        <HashTitle>Why join</HashTitle>
      </div>
      <ul className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {siteConfig.whyJoinUs.map((reason) => (
          <li key={reason}>
            <Card className="h-full text-lg text-paper/85">{reason}</Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
