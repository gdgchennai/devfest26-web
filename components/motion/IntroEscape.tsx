"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { siteConfig } from "@/site.config";
import { useClientValue } from "@/lib/useClientValue";

export type IntroPhase = "loading" | "hallway";

/**
 * The persistent way out of the intro, and the only accessible one.
 *
 * Portalled to document.body rather than into the curtain: the curtain is
 * aria-hidden, so anything inside it is invisible to assistive tech while still
 * being focusable — which is why the old hatch inside <Loader> was both
 * unreachable by screen reader and silently dropped the "Loading" announcement.
 *
 * It also must not unmount between phases. The old hatch lived in <Loader> and
 * disappeared the moment the reveal finished, i.e. exactly when a visitor
 * watching a dozen photos fly past would want it.
 *
 * Bottom-right because it is the only free corner: the hero copy and CTAs own
 * bottom-left, and StackControls plus both Scroll hints own bottom-centre.
 *
 * Carries no progress indicator. The loading phase already has the % counter in
 * <Loader>, and the hallway has the beacon — the stack glowing into view as the
 * camera approaches it (see HALLWAY_BEACON_CLASS in usePhotoHallway).
 */
export function IntroEscape({
  phase,
  emphasis,
  onSkip,
}: {
  phase: IntroPhase;
  /** Full opacity once the visitor has waited long enough to want an exit. */
  emphasis: boolean;
  onSkip: () => void;
}) {
  // document.body only exists on the client, and this portals into it.
  const mounted = useClientValue(() => true, false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      onSkip();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  if (!mounted) return null;

  return createPortal(
    <div
      // Above the curtain (z-999) — this is the one thing that must stay
      // reachable while everything else is covered.
      className={`fixed bottom-0 right-0 z-[1000] flex items-center gap-3 p-6 font-mono text-[0.8rem] transition-opacity duration-500 focus-within:opacity-100 sm:p-8 ${
        emphasis ? "opacity-100" : "opacity-45"
      }`}
      style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
    >
      <span className="sr-only" role="status">
        {phase === "loading" ? "Loading DevFest Chennai" : "Intro playing"}
      </span>

      {phase === "loading" && (
        <>
          <a href="/agenda" className="text-paper/70 hover:text-paper">
            Agenda
          </a>
          <a
            href={siteConfig.ticketing.url ?? "/agenda"}
            className="text-paper/70 hover:text-paper"
          >
            Tickets
          </a>
        </>
      )}
      <button
        type="button"
        onClick={onSkip}
        className="rounded-full border border-paper/30 bg-ink/70 px-4 py-2 uppercase tracking-wide text-paper hover:bg-paper/10"
      >
        Skip intro
      </button>
    </div>,
    document.body,
  );
}
