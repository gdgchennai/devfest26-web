import { Button } from "@/components/Button";
import { TiltCard } from "@/components/TiltCard";
import { siteConfig, formatEventDate, uiCopy } from "@/site.config";
import { ticketCta } from "@/lib/cta";

/**
 * The closing CTA, as a ticket stub.
 *
 * It replaces an `<h2>See you there.</h2>` and a lone button. The shape is
 * doing real work: almost nothing about this event is confirmed yet — the date
 * is null, the venue is unconfirmed, ticketing has no URL — and printed as
 * body copy that reads as an unfinished page. Printed as mono fields on a
 * ticket, "TBA" reads as a ticket that has not been issued yet, which is
 * exactly the true state of things.
 *
 * Every muted label here is one opacity step higher than it looks like it
 * needs to be. The panel behind them is a four-colour wash and the torn half
 * is lifted 5% lighter again, and at the original values `Date`/`Venue`
 * (4.02:1) and the stub labels (3.83–4.37:1) all sat under the 4.5:1 floor for
 * text this size. Checked against the lightest point the gradient reaches, not
 * against flat ink.
 */
export function TicketStub() {
  const cta = ticketCta();
  const dateKnown = siteConfig.date !== null;

  return (
    <TiltCard className="ticket-stub">
      <div className="ticket-stub__body">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-paper/60">
          {uiCopy.common.chapterPresents}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h2>
        <p className="mt-1 text-paper/70">{siteConfig.tagline}</p>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field label={uiCopy.ticketStub.dateFieldLabel}>
            {dateKnown ? formatEventDate(siteConfig.date) : uiCopy.ticketStub.tbaDate}
          </Field>
          <Field label={uiCopy.ticketStub.venueFieldLabel}>
            {siteConfig.venue.name}
            {!siteConfig.venue.confirmed && (
              <span className="text-paper/60">{uiCopy.common.unconfirmedSuffix}</span>
            )}
          </Field>
        </dl>
      </div>

      <div className="ticket-stub__perf" aria-hidden />

      <div className="ticket-stub__end">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-paper/65">{uiCopy.ticketStub.admitOneLabel}</p>

        <Button href={cta.href} size="lg" className="mt-4">
          {cta.label}
        </Button>
      </div>
    </TiltCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[0.6875rem] uppercase tracking-wider text-paper/60">{label}</dt>
      <dd className="mt-0.5 text-sm text-paper/90">{children}</dd>
    </div>
  );
}
