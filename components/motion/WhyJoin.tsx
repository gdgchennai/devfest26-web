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
 * "Why join" — the section where the page hands off from dark to light.
 *
 * The whole site's greyscale resolves from a single --theme value (0 = dark,
 * 1 = light) in globals.css: the fixed backdrop is var(--ink), all text is
 * var(--paper), and the card surfaces are mixed from those. Scrubbing --theme
 * from 0 → 1 as this section reaches the middle of the viewport turns the fixed
 * background white and every font ink at once, eased by the scroll. It clamps
 * at 1, so the page stays light below and returns to dark when scrolled above.
 */
export function WhyJoin() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !ref.current) return;
      // Scrub the global theme from dark → light. Begin once this section's top
      // reaches the middle of the viewport, and finish over the next stretch.
      gsap.fromTo(
        document.documentElement,
        { "--theme": 0 },
        {
          "--theme": 1,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 50%",
            end: "top 10%",
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );
      /*
       * The only global ScrollTrigger.refresh() on first load, and load-bearing.
       *
       * Why it is needed: the pinned "What to expect" panel above inserts a pin
       * spacer, which changes document height. HashTitle's spin is bound to
       * absolute scroll bounds (0 → scrollHeight − innerHeight) with
       * invalidateOnRefresh, so it measures short unless something recomputes
       * after the spacer exists. MotionProvider does refresh, but only on route
       * CHANGE — `previousPathname` starts equal to `pathname`, so its effect
       * early-returns on the first render and never fires here.
       *
       * Why it belongs in this component: effects run children-before-parents
       * and siblings in mount order, so by the time this runs, every trigger on
       * the page has been created (ExpectShowcase and its HashTitle above, this
       * section's own HashTitle below it in the tree). Nothing further down the
       * page creates one. This is the last moment where a single refresh fixes
       * everything at once.
       *
       * Why the reduced-motion guard stays: under reduced motion ExpectShowcase
       * does not pin and HashTitle does not animate, so there is no spacer and
       * no trigger — the refresh would have nothing to correct.
       */
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
