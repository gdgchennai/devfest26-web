import { siteConfig } from "@/site.config";
import { getBrandShapes } from "@/lib/brandShapes";
import { SectionBoundary } from "@/components/SectionBoundary";
import { HeroSection } from "@/components/motion/HeroSection";
import { StaticHero } from "@/components/motion/StaticHero";
import { ReadySection } from "@/components/motion/ReadySection";
import { ExpectShowcase } from "@/components/motion/ExpectShowcase";
import { BracketsField } from "@/components/motion/BracketsField";
import { VenueReveal } from "@/components/motion/VenueReveal";
import { MoodSection } from "@/components/motion/MoodSection";
import { ShowMoodSection } from "@/components/motion/ShowMoodSection";
import { SeeYouThereSection } from "@/components/motion/SeeYouThereSection";

export default function Home() {
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

        {/* A short beat between the hero and "About DevFest": a two-line
            question wiped into view, line by line. */}
        <div data-scroll-cue-section>
          <ReadySection />
        </div>

        {/* The dark "What to expect" section, over the 3D brand-shape backdrop.
            Carries the load-bearing `id="after-hero"` (skip link + hero escape
            hatch target); degrades to a static row under reduced-motion/lite. */}
        <div data-scroll-cue-section>
          <ExpectShowcase />
        </div>

        <div data-scroll-cue-section>
          <VenueReveal brandShapes={getBrandShapes()} />
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
