"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { heroCopy } from "@/components/motion/HeroCopy";
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
 * bottom-left, and both Scroll hints own bottom-centre.
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
          <a href={heroCopy.agenda.href} className="text-paper/70 hover:text-paper">
            Agenda
          </a>
          {/* Only when there is somewhere to go — see lib/cta.ts. */}
          {heroCopy.ticket.available && (
            <a href={heroCopy.ticket.href} className="text-paper/70 hover:text-paper">
              Tickets
            </a>
          )}
        </>
      )}

      {/*
       * Two different exits, and the difference matters. "Skip intro" ends this
       * playthrough; "Lite version" is the standing answer — it turns the whole
       * motion layer off for good, and someone who is already regretting the
       * flythrough should not have to scroll the length of the homepage to the
       * footer toggle to find it.
       *
       * A plain anchor, not a button calling into motion-prefs: it works with
       * no JS, it is the same `?lite=1` URL the footer toggle navigates to, and
       * a full page load is what re-reads the preference anyway.
       */}
      <a
        href="?lite=1"
        className="rounded-full border border-paper/30 bg-ink/70 px-4 py-2 uppercase tracking-wide text-paper/80 hover:bg-paper/10 hover:text-paper"
      >
        Lite version
      </a>
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
