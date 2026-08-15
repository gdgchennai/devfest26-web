import { siteConfig } from "@/site.config";
// import { speakers } from "@/lib/content";
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
// import { TrackCards } from "@/components/TrackCards";
// import { SpeakerWall } from "@/components/SpeakerWall";
import { TicketStub } from "@/components/TicketStub";

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

        {/* "Why join" is folded into "About DevFest" above and not rendered
            here — its reasons UI is unused, and its one load-bearing side
            effect (the dark → light --theme scrub the sections below need for
            readable text over their light backgrounds) now lives in
            VenueReveal instead, timed to that section's own reveal rather
            than firing the instant this point in the page is reached. */}

        {/* <Section eyebrow="Four lanes" title="Tracks" dotColor="yellow">
          <TrackCards tracks={siteConfig.tracks} />
        </Section> */}

        {/* Lineup, shown as open places while speakers.json is empty — the CFP
            pitch belongs where someone is already looking for speakers. */}
        {/* <Section eyebrow="Lineup" title="Speakers" dotColor="blue">
          <p className="-mt-4 mb-6 text-sm text-paper/60">
            {speakers.length === 0
              ? "The 2026 lineup is being finalised. The call for proposals is how you get on it."
              : "More speakers still to be announced."}
          </p>
          <SpeakerWall />
        </Section> */}

        {/* No sponsors section: 2026 is not running sponsorship at all. The
            route and its data are gone too — see the architecture doc. */}

        {/* The pinned "Location" reveal: heading settles up top while the
            venue's hand-drawn outline draws itself in, then the real photo,
            caption, and a save-the-date beat follow. Not built on <Section> —
            it's a full-bleed stage, not a padded content block (see
            VenueReveal for why <Section> itself is untouched). */}
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

        {/* Hiding this for the time being. Don't remove. This needs to be repurposed differently
        <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-8">
          <TicketStub />
        </section> */}
      </div>
    </>
  );
}
