import Link from "next/link";
import { siteConfig } from "@/site.config";
import { speakers } from "@/lib/content";
import { Section } from "@/components/Section";
import { Faq } from "@/components/Faq";
import { SectionBoundary } from "@/components/SectionBoundary";
import { HeroSection } from "@/components/motion/HeroSection";
import { StaticHero } from "@/components/motion/StaticHero";
import { ExpectShowcase } from "@/components/motion/ExpectShowcase";
import { BracketsField } from "@/components/motion/BracketsField";
import { SectionBackdrop } from "@/components/motion/SectionBackdrop";
import { WhyJoin } from "@/components/motion/WhyJoin";
import { TrackCards } from "@/components/TrackCards";
import { SpeakerWall } from "@/components/SpeakerWall";
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
        {/* Scroll-driven background cycle. Mounted first so its per-section
            triggers exist before WhyJoin's ScrollTrigger.refresh() runs. It
            renders nothing; it scrubs --page-bg (the backdrop colour) through
            the pastel cycle configured in globals.css as each [data-bg-cycle]
            section below reaches the viewport. */}
        <SectionBackdrop />

        {/* If the motion hero throws at runtime, degrade to the static hero
            instead of taking down the whole homepage. The fallback is
            StaticHero, not CurvedMarqueeHero: a fallback that itself needs
            WebGL to show any content is no fallback at all. */}
        <SectionBoundary label="hero" fallback={<StaticHero />}>
          <HeroSection />
        </SectionBoundary>

        {/* The dark "What to expect" section, over the 3D brand-shape backdrop.
            Carries the load-bearing `id="after-hero"` (skip link + hero escape
            hatch target); degrades to a static row under reduced-motion/lite. */}
        <ExpectShowcase />

        {/* From "Why join" down the page hands off to the light theme: WhyJoin
            scrubs the global --theme 0 → 1, turning the single fixed background
            white and all text ink, and it stays light for the sections below.
            It also carries the page's one-shot ScrollTrigger.refresh() (see the
            comment inside) — the last component here that creates a trigger. */}
        <WhyJoin />

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

        <Section eyebrow="Where" title="Venue" dotColor="red" cycleBg>
          <p className="max-w-xl text-paper/80">
            {siteConfig.venue.line1}, {siteConfig.venue.line2}
            {!siteConfig.venue.confirmed && " — pending final confirmation."}
          </p>
          <Link
            href="/venue"
            className="mt-3 inline-block text-sm text-blue underline underline-offset-4 hover:decoration-2"
          >
            Venue details & travel →
          </Link>
        </Section>

        <Section eyebrow="Questions" title="FAQ" dotColor="yellow" cycleBg>
          <Faq />
        </Section>

        <section data-bg-cycle className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-8">
          <TicketStub />
        </section>
      </div>
    </>
  );
}
