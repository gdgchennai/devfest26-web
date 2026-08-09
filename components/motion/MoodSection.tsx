"use client";

import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Resolves a `var(...)` (or any CSS colour expression) to the concrete
 *  colour the browser would paint it as, via a throwaway probe element —
 *  GSAP can only tween between concrete colours, not raw custom-property
 *  references. Same technique VenueReveal uses for its own ink → pastel-
 *  blue handoff. */
function resolveColor(expr: string): string {
  const probe = document.createElement("span");
  probe.style.color = expr;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return resolved;
}

/** How much further the line keeps travelling left, past the point its
 *  trailing edge first touches the right side of the frame — a fraction of
 *  viewport width, so the extra distance scales with screen size same as
 *  everything else here. Gives the line room to keep drifting left for a
 *  beat once it's fully arrived, instead of the pin releasing the instant
 *  it does. */
const EXTRA_TRAVEL_VW = 0.3;

/**
 * "What's your DevFest mood?" — the beat right after Location. A single
 * unbroken line of text that scrolls across the screen right-to-left as the
 * visitor scrolls down (a scroll-scrubbed marquee, not a timed animation).
 * Pinned for the line's own width plus EXTRA_TRAVEL_VW more — i.e. until
 * just past the point its last word reaches the screen — NOT until it
 * fully exits to the left; the pin releases while "mood?" is still
 * comfortably on screen, and ordinary scrolling carries straight on to
 * whatever comes next.
 *
 * No opaque backdrop of its own — deliberately. BracketsField's 3D brackets
 * are a fixed layer behind every section (see there); a section-local cover
 * would hide them. Instead this picks up TWO custom properties exactly
 * where VenueReveal's own pinned overlay leaves them the instant its pin
 * releases — --page-bg at black (it scrubs pastel blue → black in lockstep
 * with covering the Location frame) and --brackets-opacity at 0 (kept
 * there for its whole pinned run so nothing floats behind the photo/
 * overlay) — and fades BOTH up across the WHOLE pass here: --page-bg to
 * white, --brackets-opacity to 1, same duration, same start. That shared
 * timing is what makes it read as one continuous reveal (backdrop
 * brightening, brackets fading in together) instead of two separate cues,
 * and specifically avoids brackets snapping straight to visible the instant
 * this pin begins — opacity's CSS fallback for an unset custom property is
 * 1, so without this fade that's exactly what would happen.
 *
 * The black start value is a FIXED colour (resolved from --black), never a
 * snapshot of --page-bg's live value — reading the live value here was an
 * earlier bug: ScrollTrigger re-renders a scrubbed tween's start state
 * every time scroll crosses back over it, so a one-time snapshot went
 * stale the moment the visitor scrolled back up, permanently stamping
 * whatever it had captured over Location's blue.
 *
 * Sized/weighted to match "About DevFest" (see ExpectShowcase) exactly —
 * same clamp() and font-bold — so the two read as the same voice restated
 * later in the page.
 *
 * Under reduced-motion / lite: settled immediately, line centred and
 * static, --page-bg already white — motion embellishment only, nothing
 * informational.
 */
export function MoodSection() {
  const wrapRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);

  // Reduced-motion / lite: no scroll-driven pass will ever run to hang the
  // --page-bg handoff off of, so jump it straight to white on mount instead
  // of leaving the shared backdrop stuck at Location's pastel blue for
  // every section from here on. Runs after VenueReveal's own mount-time
  // jump to blue (VenueReveal is the earlier sibling, so its effect commits
  // first), so white is what actually sticks.
  useEffect(() => {
    if (!shouldUseStaticBaseline()) return;
    document.documentElement.style.setProperty("--page-bg", "#ffffff");
  }, []);

  useGSAP(
    () => {
      if (staticBaseline) return;
      if (!wrapRef.current || !stageRef.current || !textRef.current) return;
      const stage = stageRef.current;
      const text = textRef.current;

      // VenueReveal's own pinned overlay has already scrubbed --page-bg to
      // this exact value by the time its pin releases (see there) — this is
      // just where that scrub ends, not a fresh read of "whatever it
      // currently is" (see the doc comment above for why that distinction
      // is the whole fix).
      const blackResolved = resolveColor("var(--black)");

      // The line starts fully off-screen right and travels its own
      // rendered width, plus a bit more (EXTRA_TRAVEL_VW) so it keeps
      // drifting left for a beat after its trailing edge arrives instead of
      // stopping dead the instant it does.
      const travel = () => text.offsetWidth + window.innerWidth * EXTRA_TRAVEL_VW;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: () => `+=${travel()}`,
          scrub: true,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // travel() depends on text.offsetWidth, measured the instant this
      // effect runs — which can be BEFORE the web font (Google Sans) has
      // actually swapped in, especially on a first/cold load. The preloader
      // awaits document.fonts.ready before the visitor can even reach this
      // section, but that promise resolves once, elsewhere, well before
      // this component mounts — it does not re-fire here, and nothing else
      // was forcing GSAP to re-measure once the real font (wider than the
      // fallback it swapped in for) actually landed. The pin's own `end` is
      // a function (`invalidateOnRefresh: true` above), so it WOULD
      // recompute correctly on any refresh — the bug was that no refresh
      // ever happened after the font swap, so a too-small `end` (measured
      // against the narrower fallback face) stuck around permanently: the
      // pin let go long before "mood?" actually arrived, and the visitor
      // was left scrolling through the spacer's unused remainder with
      // nothing visibly happening — indistinguishable from "stuck". This
      // forces exactly the missing refresh once the real font is confirmed
      // loaded (a no-op extra refresh if it already was).
      if (document.fonts?.ready) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
      }

      tl.fromTo(
        text,
        { x: () => window.innerWidth },
        {
          x: () => window.innerWidth - text.offsetWidth - window.innerWidth * EXTRA_TRAVEL_VW,
          ease: "none",
          duration: 5,
        },
        0,
      );
      // Black → white. Starts from the SAME fixed blackResolved constant
      // VenueReveal's own overlay scrub ends at (never a live/current
      // reading — see the doc comment above for why that went stale) so
      // the two hand off exactly, regardless of scroll direction or how
      // many times the visitor has crossed back and forth over either. Same
      // duration as the text tween (5) — NOT a quick early fade — so it
      // reads as one continuous, gradual brightening across the whole pass
      // rather than a flash: still fully black when the line starts
      // arriving, still visibly mid-fade while it crosses, settled white
      // only right as the pin itself releases.
      tl.fromTo(
        document.documentElement,
        { "--page-bg": blackResolved },
        { "--page-bg": "#ffffff", ease: "none", duration: 5 },
        0,
      );
      // BracketsField's 3D brackets fade in over the SAME span, 0 → 1 —
      // VenueReveal's own trigger hands off at exactly 0 when its pin
      // releases (see there), so this picks up from a clean, matching
      // baseline. Without this they'd otherwise snap straight to fully
      // visible the instant this pin begins (the CSS custom property's
      // unset/guaranteed-invalid fallback is 1) — a hard pop right as the
      // still-black backdrop appears. Fading them in alongside the black →
      // white brightening instead reads as one continuous reveal.
      tl.fromTo(
        document.documentElement,
        { "--brackets-opacity": 0 },
        { "--brackets-opacity": 1, ease: "none", duration: 5 },
        0,
      );
    },
    { scope: wrapRef, dependencies: [staticBaseline] },
  );

  return (
    <section ref={wrapRef} className="relative overflow-hidden">
      {/* h-dvh, NOT h-screen (100vh): on mobile, the browser chrome
          (address bar) collapsing as the visitor scrolls changes 100vh
          mid-scroll, which can desync this pin's spacer height from the
          stage's actual rendered height — GSAP ends up holding the pin for
          a scroll distance that no longer matches what the page actually
          has room for, leaving it stuck mid-pass with no further scroll
          possible (the exact bug VenueReveal's own h-dvh usage documents
          and avoids — see there). 100dvh stays fixed to the smallest
          browser-chrome state instead of live-tracking it. */}
      <div ref={stageRef} className="relative flex h-dvh items-center overflow-hidden">
        <h2
          ref={textRef}
          className={`whitespace-nowrap text-paper text-[clamp(3.5rem,12vw,10rem)] font-bold leading-none tracking-tight ${
            staticBaseline ? "mx-auto" : ""
          }`}
        >
          What&rsquo;s your DevFest mood?
        </h2>
      </div>
    </section>
  );
}
