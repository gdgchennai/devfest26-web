import { Button, inertButtonClasses } from "@/components/Button";
import { siteConfig, formatEventDate } from "@/site.config";
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
 */
export function TicketStub() {
  const cta = ticketCta();
  const dateKnown = siteConfig.date !== null;

  return (
    <div className="ticket-stub">
      <div className="ticket-stub__body">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-paper/50">
          {siteConfig.chapter} presents
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h2>
        <p className="mt-1 text-paper/70">{siteConfig.tagline}</p>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field label="Date">
            {dateKnown ? formatEventDate(siteConfig.date) : "TBA"}
          </Field>
          <Field label="Venue">
            {siteConfig.venue.name}
            {!siteConfig.venue.confirmed && (
              <span className="text-paper/45"> · unconfirmed</span>
            )}
          </Field>
        </dl>
      </div>

      <div className="ticket-stub__perf" aria-hidden />

      <div className="ticket-stub__end">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-paper/50">Admit one</p>

        {cta.available ? (
          <Button href={cta.href} size="lg" className="mt-4">
            {cta.label}
          </Button>
        ) : (
          <>
            <p className={`mt-4 ${inertButtonClasses("lg")}`}>{cta.label}</p>
            <p className="mt-2 font-mono text-[0.6875rem] text-paper/45">{cta.note}</p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[0.6875rem] uppercase tracking-wider text-paper/45">{label}</dt>
      <dd className="mt-0.5 text-sm text-paper/90">{children}</dd>
    </div>
  );
}
