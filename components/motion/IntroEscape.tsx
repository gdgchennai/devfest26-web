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
      /*
       * A full-width bar, not a corner cluster. Everything used to sit stacked
       * in the bottom-right within a 12px gap — on a phone that is one thumb
       * zone and a misclick between "skip this once" and "turn motion off for
       * good". Now: destinations and mode on the LEFT, the skip on the RIGHT,
       * a whole viewport apart.
       *
       * pointer-events-none on the bar so the empty middle never intercepts a
       * click meant for the loader's Enter CTA behind it; each group turns
       * pointer events back on for itself.
       *
       * The resting state is 80%, not the 45% this was written with: it is the
       * only exit from a scroll-locked intro, and at 45% the label sat under
       * the contrast floor on both grounds. Dimming it to "out of the way" is
       * fine; dimming it to "hard to read" defeats the point.
       */
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-[1000] flex items-end justify-between gap-6 p-5 font-mono text-[0.8rem] transition-opacity duration-500 focus-within:opacity-100 sm:p-8 ${
        emphasis ? "opacity-100" : "opacity-80"
      }`}
      style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <span className="sr-only" role="status">
        {phase === "loading" ? "Loading DevFest Chennai" : "Intro playing"}
      </span>

      {/*
       * LEFT — "go somewhere else, or change how the site behaves".
       *
       * The nav links are load-bearing beyond the intro: the site currently has
       * no header, so while this overlay is up they are the only way to reach a
       * route without dismissing it first.
       *
       * "Lite version" is here in the hallway phase rather than beside the skip,
       * because those two are the pair most easily confused — one ends this
       * playthrough, the other turns the motion layer off permanently. During
       * loading the lite option instead sits under the loader's Enter CTA, where
       * the choice is actually being made, so it is never on screen twice.
       *
       * Plain anchors throughout: they work with no JS, and `?lite=1` is the same
       * URL the footer toggle uses, so a full load re-reads the preference.
       */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-2">
        {phase === "loading" && (
          <>
            <a href={heroCopy.agenda.href} className={`py-2 ${linkClass}`}>
              Agenda
            </a>
            {/* Only when there is somewhere to go — see lib/cta.ts. */}
            {heroCopy.ticket.available && (
              <a href={heroCopy.ticket.href} className={`py-2 ${linkClass}`}>
                Tickets
              </a>
            )}
          </>
        )}
        {phase === "hallway" && (
          <a
            href="?lite=1"
            className={`rounded-full border px-4 py-3 uppercase tracking-wide transition-colors sm:py-2 ${pillClass}`}
          >
            Lite version
          </a>
        )}
      </div>

      {/* RIGHT — the one action that only affects this playthrough. */}
      <div className="pointer-events-auto flex items-center gap-3">
        <button
          type="button"
          onClick={onSkip}
          // py-3 on phones: at py-2 this was a ~32px target, under the 44px
          // minimum, in the exact corner a thumb lands.
          className={`rounded-full border px-4 py-3 uppercase tracking-wide transition-colors sm:py-2 ${pillClass}`}
        >
          Skip intro
        </button>
      </div>
    </div>,
    document.body,
  );
}
