import type { Ref } from "react";
import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";
import { siteConfig, formatEventDate } from "@/site.config";

/**
 * The hero's words and calls to action, rendered identically by the motion hero
 * and the static baseline. It previously existed as two hand-kept copies in one
 * file, which meant a tagline change had to be made twice — and the copy that
 * silently went stale would be the one reduced-motion visitors saw.
 *
 * The motion hero passes refs so it can slide each line up from behind its
 * clipping wrapper; the static hero passes none and the same markup renders
 * inert. The wrappers are always present so both paths share one layout.
 */
// Passed as flat props rather than bundled into one `refs` object: reading
// members off an object of refs during render trips react-hooks/refs.
export function HeroCopy({
  eyebrowRef,
  wordmarkRef,
  taglineRef,
  factsRef,
  showScrollHint = false,
}: {
  eyebrowRef?: Ref<HTMLDivElement>;
  wordmarkRef?: Ref<HTMLHeadingElement>;
  taglineRef?: Ref<HTMLParagraphElement>;
  factsRef?: Ref<HTMLDivElement>;
  /** Only the motion hero shows it — the static hero has no pinned section to scroll through. */
  showScrollHint?: boolean;
}) {
  return (
    <>
      <div className="overflow-hidden">
        <Eyebrow ref={eyebrowRef} className="mb-3">
          {siteConfig.chapter}
        </Eyebrow>
      </div>
      <div className="overflow-hidden">
        <h1 ref={wordmarkRef} className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          {siteConfig.name}
        </h1>
      </div>
      <div className="overflow-hidden">
        <p ref={taglineRef} className="mt-3 max-w-xl text-lg text-paper/85 sm:text-xl">
          {siteConfig.tagline}
        </p>
      </div>

      <div ref={factsRef}>
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

        {showScrollHint && (
          <a
            href="#after-hero"
            className="mt-10 block text-center font-mono text-xs uppercase tracking-wide text-paper/60 hover:text-paper"
          >
            Scroll
          </a>
        )}
      </div>
    </>
  );
}
