import Link from "next/link";
import { siteConfig } from "@/site.config";
import { agenda, speakers } from "@/lib/content";
import { Card } from "@/components/Card";
import { Section } from "@/components/Section";
import { Faq } from "@/components/Faq";
import { SectionBoundary } from "@/components/SectionBoundary";
import { HeroSection, StaticHero } from "@/components/motion/HeroSection";
import { TrackCards } from "@/components/TrackCards";
import { AgendaTimeline } from "@/components/AgendaTimeline";
import { SpeakerWall } from "@/components/SpeakerWall";
import { TicketStub } from "@/components/TicketStub";

export default function Home() {
  const previewSessions = agenda.slice(0, 4);

  return (
    <>
      {/* If the motion hero throws at runtime, degrade to the static hero
          instead of taking down the whole homepage. */}
      <SectionBoundary label="hero" fallback={<StaticHero />}>
        <HeroSection />
      </SectionBoundary>

      {/* `id` is load-bearing: the skip link and the hero's escape hatch both
          target it. No divider — the hero is already its own boundary. */}
      <Section
        id="after-hero"
        index={1}
        eyebrow="Why come"
        title="What you'll get"
        dotColor="blue"
        divider={false}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {siteConfig.whatYoullGet.map((item) => (
            <Card key={item.title} className="h-full">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-paper/70">{item.description}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Why join us — 4 items, stated still (cut from 2025's 12-item marquee) */}
      <Section index={2} eyebrow="The pitch" title="Why join us" dotColor="red">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {siteConfig.whyJoinUs.map((reason) => (
            <li key={reason}>
              <Card className="h-full text-paper/85">{reason}</Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section index={3} eyebrow="Four lanes" title="Tracks" dotColor="yellow">
        <TrackCards tracks={siteConfig.tracks} />
      </Section>

      <Section index={4} eyebrow="Sample schedule" title="Agenda preview" dotColor="green">
        <p className="-mt-4 mb-6 text-sm text-paper/60">
          Final sessions and speakers are still being confirmed — this is a placeholder shape of
          the day.
        </p>
        <AgendaTimeline sessions={previewSessions} />
      </Section>

      {/* Lineup, shown as open places while speakers.json is empty — the CFP
          pitch belongs where someone is already looking for speakers. */}
      <Section index={5} eyebrow="Lineup" title="Speakers" dotColor="blue">
        <p className="-mt-4 mb-6 text-sm text-paper/60">
          {speakers.length === 0
            ? "The 2026 lineup is being finalised. The call for proposals is how you get on it."
            : "More speakers still to be announced."}
        </p>
        <SpeakerWall />
      </Section>

      {/* No sponsors section this year — see /sponsors for the tier page. */}

      <Section index={6} eyebrow="Where" title="Venue" dotColor="red">
        <p className="max-w-xl text-paper/80">
          {siteConfig.venue.line1}, {siteConfig.venue.line2}
          {!siteConfig.venue.confirmed && " — pending final confirmation."}
        </p>
        <Link
          href="/venue"
          className="mt-3 inline-block text-sm text-blue underline-offset-4 hover:underline"
        >
          Venue details & travel →
        </Link>
      </Section>

      <Section index={7} eyebrow="Questions" title="FAQ" dotColor="yellow">
        <Faq />
      </Section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:px-8">
        <TicketStub />
      </section>
    </>
  );
}
