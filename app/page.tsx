import Link from "next/link";
import { siteConfig } from "@/site.config";
import { agenda, sponsors } from "@/lib/content";
import { formatSessionTime } from "@/lib/format";
import { SectionHeading } from "@/components/SectionHeading";
import { EmptyState } from "@/components/EmptyState";
import { Faq } from "@/components/Faq";
import { HeroSection } from "@/components/motion/HeroSection";

const TIER_LABELS = [
  { tier: "gold" as const, label: "Gold" },
  { tier: "associate" as const, label: "Associate" },
  { tier: "community" as const, label: "Community Partners" },
];

export default function Home() {
  const previewSessions = agenda.slice(0, 4);

  return (
    <>
      <HeroSection />

      {/* What you'll get */}
      <section id="after-hero" className="px-4 py-20 sm:px-8">
        <SectionHeading eyebrow="Why come" title="What you'll get" dotColor="blue" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {siteConfig.whatYoullGet.map((item) => (
            <div key={item.title} className="rounded-lg border border-paper/10 p-5">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-paper/70">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why join us — 4 items, stated still (cut from 2025's 12-item marquee) */}
      <section className="px-4 py-20 sm:px-8">
        <SectionHeading eyebrow="The pitch" title="Why join us" dotColor="red" />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {siteConfig.whyJoinUs.map((reason) => (
            <li key={reason} className="rounded-lg bg-paper/5 p-5 text-paper/85">
              {reason}
            </li>
          ))}
        </ul>
      </section>

      {/* Tracks */}
      <section className="px-4 py-20 sm:px-8">
        <SectionHeading eyebrow="Four lanes" title="Tracks" dotColor="yellow" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {siteConfig.tracks.map((track) => (
            <div key={track.slug} className="rounded-lg border border-paper/10 p-5">
              <h3 className="font-mono text-sm uppercase tracking-wide text-blue">{track.name}</h3>
              <p className="mt-2 text-sm text-paper/70">{track.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agenda preview */}
      <section className="px-4 py-20 sm:px-8">
        <SectionHeading eyebrow="Sample schedule" title="Agenda preview" dotColor="green" />
        <p className="-mt-4 mb-6 text-sm text-paper/60">
          Final sessions and speakers are still being confirmed — this is a placeholder shape of
          the day.
        </p>
        <div className="divide-y divide-paper/10 rounded-lg border border-paper/10">
          {previewSessions.map((session, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <span className="font-mono text-sm tabular-nums text-paper/60">
                {formatSessionTime(session.start)}
              </span>
              <span className="flex-1">{session.title}</span>
              <span className="font-mono text-xs uppercase text-paper/50">{session.hall}</span>
            </div>
          ))}
        </div>
        <Link
          href="/agenda"
          className="mt-4 inline-block text-sm text-blue underline-offset-4 hover:underline"
        >
          View full agenda →
        </Link>
      </section>

      {/* Sponsors */}
      <section className="px-4 py-20 sm:px-8">
        <SectionHeading eyebrow="Thank you" title="Sponsors" dotColor="blue" />
        <div className="space-y-8">
          {TIER_LABELS.map(({ tier, label }) => {
            const tierSponsors = sponsors.filter((s) => s.tier === tier);
            return (
              <div key={tier}>
                <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-paper/60">
                  {label}
                </h3>
                {tierSponsors.length === 0 ? (
                  <EmptyState
                    message={`${label} sponsors will be announced soon.`}
                    linkHref="/sponsors"
                    linkLabel="View sponsorship tiers"
                  />
                ) : (
                  <div className="flex flex-wrap gap-6">
                    {tierSponsors.map((s) => (
                      <span key={s.name} className="text-paper/80">
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Venue teaser */}
      <section className="px-4 py-20 sm:px-8">
        <SectionHeading eyebrow="Where" title="Venue" dotColor="red" />
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
      </section>

      {/* FAQ */}
      <section className="px-4 py-20 sm:px-8">
        <SectionHeading eyebrow="Questions" title="FAQ" dotColor="yellow" />
        <Faq />
      </section>

      {/* Final CTA */}
      <section className="px-4 py-24 text-center sm:px-8">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">See you there.</h2>
        <a
          href={siteConfig.ticketing.url ?? "/agenda"}
          className="mt-6 inline-block rounded-full bg-blue px-8 py-3 text-sm font-medium text-paper hover:opacity-90"
        >
          Get Tickets
        </a>
      </section>
    </>
  );
}
