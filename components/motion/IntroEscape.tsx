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

  /*
   * The two phases sit on opposite grounds and the controls have to follow.
   * `loading` is the <Loader>'s white field; `hallway` is the photos on black.
   * Styled for the dark ground alone, the loading phase rendered near-white
   * links on white — "Agenda" was a ghost — and a translucent pill that washed
   * out to light grey.
   */
  const onWhite = phase === "loading";
  const linkClass = onWhite
    ? "text-ink/70 hover:text-ink"
    : "text-paper/70 hover:text-paper";
  // Solid, not a wash: an alpha fill composites toward whatever is behind it,
  // which is exactly what made this unreadable on the white field.
  const pillClass = onWhite
    ? "border-ink/25 bg-ink text-paper hover:bg-ink/85"
    : "border-paper/30 bg-ink/70 text-paper hover:bg-paper/10";

  return createPortal(
    <div
      // Above the curtain (z-999) — this is the one thing that must stay
      // reachable while everything else is covered.
      //
      // The resting state is 80%, not the 45% this was written with: it is the
      // only exit from a scroll-locked intro, and at 45% the label sat under
      // the contrast floor on both grounds. Dimming it to "out of the way" is
      // fine; dimming it to "hard to read" defeats the point.
      className={`fixed bottom-0 right-0 z-[1000] flex items-center gap-3 p-6 font-mono text-[0.8rem] transition-opacity duration-500 focus-within:opacity-100 sm:p-8 ${
        emphasis ? "opacity-100" : "opacity-80"
      }`}
      style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
    >
      <span className="sr-only" role="status">
        {phase === "loading" ? "Loading DevFest Chennai" : "Intro playing"}
      </span>

      {phase === "loading" && (
        <>
          <a href={heroCopy.agenda.href} className={linkClass}>
            Agenda
          </a>
          {/* Only when there is somewhere to go — see lib/cta.ts. */}
          {heroCopy.ticket.available && (
            <a href={heroCopy.ticket.href} className={linkClass}>
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
       * Hallway phase only. During loading the same option sits directly under
       * the loader's "Enter the DevFest experience" CTA, which is where the
       * choice is actually being made; rendering it here too would put two lite
       * links on one screen. Once the flythrough starts, that screen is gone and
       * this corner is the only place left for it.
       *
       * A plain anchor, not a button calling into motion-prefs: it works with
       * no JS, it is the same `?lite=1` URL the footer toggle navigates to, and
       * a full page load is what re-reads the preference anyway.
       */}
      {phase === "hallway" && (
        <a
          href="?lite=1"
          className={`rounded-full border px-4 py-2 uppercase tracking-wide transition-colors ${pillClass}`}
        >
          Lite version
        </a>
      )}
      <button
        type="button"
        onClick={onSkip}
        className={`rounded-full border px-4 py-2 uppercase tracking-wide transition-colors ${pillClass}`}
      >
        Skip intro
      </button>
    </div>,
    document.body,
  );
}
