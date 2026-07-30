import { Button, inertButtonClasses } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";
import { heroCopy } from "@/components/motion/HeroCopy";

/**
 * The hero for everyone who is not getting WebGL: lite mode, no-JS, crawlers,
 * and the error fallback if the motion hero throws.
 *
 * It replaces nothing — before this, lite mode rendered `CurvedMarqueeHero`
 * with both of its three.js effects short-circuited, which left a full black
 * viewport containing an `sr-only` <h1> and two links. Everything visible in
 * that hero (the photo strip AND the title) is drawn in WebGL, so skipping the
 * download skipped the content. That is the whole reason lite did not deserve
 * the name.
 *
 * Built entirely from the existing design system — `Eyebrow`, `Button`, the
 * `HashTitle` display scale, the `TicketStub` mono field treatment — so it
 * reads as the same site rather than as a stripped-down apology for it. No new
 * tokens, no hand-mixed shades.
 *
 * Normal flow, not the absolute positioning the WebGL hero uses for its CTA
 * row: this variant has to survive 200% zoom and long translated strings, and
 * `min-h` + centred flex lets the section grow instead of clipping.
 *
 * Lives beside the other hero variants (not in components/) so all three files
 * — this, `CurvedMarqueeHero`, and the `HeroSection` that chooses between them
 * — sit together.
 */
export function StaticHero() {
  const { ticket, agenda } = heroCopy;

  return (
    <section className="relative flex min-h-[100vh] flex-col items-center justify-center overflow-hidden px-4 py-24 sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <Eyebrow dotColor="blue">{heroCopy.eyebrow}</Eyebrow>

        {/* Same display scale as HashTitle, so the page's two largest pieces of
            type are the same size rather than nearly the same size. */}
        <h1 className="mt-5 text-5xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl">
          {heroCopy.title}
        </h1>

        <p className="mt-6 text-xl text-paper/80 sm:text-2xl">{heroCopy.tagline}</p>

        {/* Mono facts, as on the ticket stub — including its "· unconfirmed"
            hedge, because the venue genuinely is not confirmed and the hero is
            the worst place on the site to imply otherwise. */}
        <p className="mt-6 font-mono text-sm text-paper/75">
          {heroCopy.dateLabel}
          <span className="px-2 text-paper/50" aria-hidden>
            ·
          </span>
          {heroCopy.venueLabel}
          {!heroCopy.venueConfirmed && <span className="text-paper/60"> · unconfirmed</span>}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {ticket.available ? (
            <Button href={ticket.href} size="lg">
              {ticket.label}
            </Button>
          ) : (
            // A statement, not a control — see inertButtonClasses. It holds the
            // primary CTA's place and weight without offering a dead tab stop.
            <p className={inertButtonClasses("lg")}>{ticket.label}</p>
          )}
          <Button href={agenda.href} variant="secondary" size="lg">
            {agenda.label}
          </Button>
        </div>

        {!ticket.available && (
          <p className="mt-3 font-mono text-xs text-paper/60">{ticket.note}</p>
        )}
      </div>
    </section>
  );
}
