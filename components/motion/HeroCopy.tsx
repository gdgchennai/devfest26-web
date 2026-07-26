import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";
import { siteConfig, formatEventDate } from "@/site.config";

/**
 * The hero's words and calls to action, rendered identically by the motion hero
 * and the static baseline. It previously existed as two hand-kept copies in one
 * file, which meant a tagline change had to be made twice — and the copy that
 * silently went stale would be the one reduced-motion visitors saw.
 *
 * No per-line animation hooks. The motion hero raises this whole block as one
 * sheet (see HALLWAY_RISE_CLASS), because the tunnel spends four viewport
 * heights establishing a space to travel through, and ending that with five
 * words each popping out of their own clip switches to a different, fussier
 * design language right at the payoff.
 */
export function HeroCopy() {
  return (
    <>
      <Eyebrow className="mb-3">{siteConfig.chapter}</Eyebrow>

      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
        {siteConfig.name}
      </h1>

      <p className="mt-3 max-w-xl text-lg text-paper/85 sm:text-xl">{siteConfig.tagline}</p>

      <p className="mt-4 font-mono text-sm tabular-nums text-paper/80">
        {formatEventDate(siteConfig.date)} · {siteConfig.venue.line2}
        {!siteConfig.venue.confirmed && " (venue TBC)"}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button href={siteConfig.ticketing.url ?? "/agenda"}>Get Tickets</Button>
        <Button href="/agenda" variant="secondary">
          View Agenda
        </Button>
      </div>
    </>
  );
}
