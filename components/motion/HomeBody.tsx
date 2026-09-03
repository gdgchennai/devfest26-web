"use client";

import dynamic from "next/dynamic";
import { SectionBoundary } from "@/components/SectionBoundary";
import { HeroSection } from "@/components/motion/HeroSection";
import { StaticHero } from "@/components/motion/StaticHero";

/**
 * Homepage sections below the hero. Imported with `next/dynamic` from this
 * Client Component (not from the Server page) so they actually code-split —
 * Next does not split a Client Component that a Server Component dynamic()s.
 * SSR stays on (default): the HTML still contains every section for SEO and
 * no-JS; only the GSAP/Three chunks hydrate asynchronously.
 */
const BracketsField = dynamic(() => import("./BracketsField").then((m) => ({ default: m.BracketsField })));
const ReadySection = dynamic(() => import("./ReadySection").then((m) => ({ default: m.ReadySection })));
const ExpectShowcase = dynamic(() => import("./ExpectShowcase").then((m) => ({ default: m.ExpectShowcase })));
const VenueReveal = dynamic(() => import("./VenueReveal").then((m) => ({ default: m.VenueReveal })));
const MoodSection = dynamic(() => import("./MoodSection").then((m) => ({ default: m.MoodSection })));
const ShowMoodSection = dynamic(() => import("./ShowMoodSection").then((m) => ({ default: m.ShowMoodSection })));
const SeeYouThereSection = dynamic(() =>
  import("./SeeYouThereSection").then((m) => ({ default: m.SeeYouThereSection })),
);

export function HomeBody({ brandShapes }: { brandShapes: string[] }) {
  return (
    <>
      {/* The sticky 3D brackets backdrop: a fixed black layer behind the whole
          homepage (z-0). It never scrolls — content below slides over it — and
          the hero covers it until the visitor scrolls down off the first
          screen. All page content is lifted above it by the z-10 wrapper. */}
      <BracketsField />

      <div className="relative z-10">
        {/* If the motion hero throws at runtime, degrade to the static hero
            instead of taking down the whole homepage. The fallback is
            StaticHero, not CurvedMarqueeHero: a fallback that itself needs
            WebGL to show any content is no fallback at all. */}
        {/*
         * `data-scroll-cue-section` on every top-level section below marks
         * the boundaries ScrollCueController (see components/motion/ScrollCue.tsx)
         * walks to find "the next section" for its floating down/right arrow.
         * Plain wrapper divs, deliberately: they add no styling of their own
         * and sit outside every section's internal refs, so GSAP's pinning
         * (ExpectShowcase, VenueReveal, MoodSection all pin an element INSIDE
         * their own <section>) is completely unaffected by their presence.
         */}
        <div data-scroll-cue-section>
          <SectionBoundary label="hero" fallback={<StaticHero />}>
            <HeroSection />
          </SectionBoundary>
        </div>

        <div data-scroll-cue-section>
          <ReadySection />
        </div>

        <div data-scroll-cue-section>
          <ExpectShowcase />
        </div>

        <div data-scroll-cue-section>
          <VenueReveal brandShapes={brandShapes} />
        </div>

        <div data-scroll-cue-section>
          <MoodSection />
        </div>

        <div data-scroll-cue-section>
          <ShowMoodSection />
        </div>

        <div data-scroll-cue-section>
          <SeeYouThereSection />
        </div>
      </div>
    </>
  );
}
