"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { setHorizontalCue } from "@/components/motion/scrollCueRegistry";
import { uiCopy } from "@/site.config";

gsap.registerPlugin(useGSAP, ScrollTrigger);

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
 * would hide them. --page-bg is left completely alone here: VenueReveal's
 * own pinned overlay already lands it on black the instant its pin
 * releases, and black is the SETTLED colour for the rest of the page now
 * (MoodSection, ShowMoodSection, SeeYouThereSection, the footer) — there is
 * no further --page-bg handoff to run.
 *
 * What this section DOES still own is --theme, and only for the reason
 * --page-bg no longer needs owning: this section's own heading reads
 * `text-paper`, and --theme is what --paper is mixed from (see
 * globals.css) — at the --theme:1 VenueReveal's own light-backdrop scrub
 * left it at (correct THERE: --paper is near-black, read over Location's
 * pastel-blue photo), that same near-black would be unreadable against the
 * black backdrop here. Flipping --theme back to 0 the instant this pin's
 * scroll range is entered — reversible via onLeaveBack, exactly the same
 * shape as VenueReveal's own --brackets-opacity onLeave/onLeaveBack pair —
 * makes --paper near-white again for this section onward, and restores
 * VenueReveal's own --theme:1 the moment the visitor scrolls back up past
 * this point, so "Location"/"Save the Date" (also `text-paper`) stays
 * correct if revisited. --brackets-opacity still fades in gently across
 * the WHOLE pass (unrelated to either of these — see its own comment
 * below), so the brackets still ease into view rather than snapping
 * straight to visible the instant this pin begins.
 *
 * Sized/weighted to match "About DevFest" (see ExpectShowcase) exactly —
 * same clamp() and font-bold — so the two read as the same voice restated
 * later in the page.
 *
 * Under reduced-motion / lite: settled immediately, line centred and
 * static. No --theme flip here either — VenueReveal's own reduced-motion
 * path settles on pastel blue (not black), where --theme:1 is already the
 * correct/readable state, so this is left untouched for that path.
 */
export function MoodSection() {
  const wrapRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);

  useGSAP(
    () => {
      if (staticBaseline) return;
      if (!wrapRef.current || !stageRef.current || !textRef.current) return;
      const stage = stageRef.current;
      const text = textRef.current;

      // See the component doc comment above for why --theme, not --page-bg,
      // is what this section owns now: flips to 0 (near-white --paper) the
      // instant this pin's scroll range is entered, back to 1 (VenueReveal's
      // own correct value) if scrolled back above it.
      const setTheme = gsap.quickSetter(document.documentElement, "--theme");

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
          onEnter: () => setTheme(0),
          onLeaveBack: () => setTheme(1),
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
      // BracketsField's 3D brackets fade in over the SAME span, 0 → 1 —
      // VenueReveal's own trigger hands off at exactly 0 when its pin
      // releases (see there), so this picks up from a clean, matching
      // baseline.
      //
      // `.to()`, deliberately NOT `.fromTo()`: a `fromTo` here would default
      // to `immediateRender: true` on its "from" (0) — applied the instant
      // this component mounts, i.e. on page load, before the visitor has
      // scrolled anywhere near VenueReveal. Since --brackets-opacity is a
      // single global custom property shared by the whole page, that forced
      // it to 0 site-wide from the very top of the page — the brackets
      // backdrop was invisible everywhere above this section on a fresh
      // load, only "fixed" once VenueReveal's own onLeaveBack happened to
      // fire from scrolling back up past it. `.to()` instead picks up
      // whatever the property's CURRENT value already is once this tween
      // actually starts playing — which, in the normal top-to-bottom scroll
      // order, is exactly the 0 VenueReveal's onLeave already set — without
      // ever asserting 0 as a blanket default for scroll positions before
      // that (the page's actual top, where it should stay the CSS
      // default's 1).
      tl.to(document.documentElement, { "--brackets-opacity": 1, ease: "none", duration: 5 }, 0);

      // Publish this section's pin geometry for the floating scroll-cue
      // button (see ScrollCueController): it shows a right-arrow instead of
      // a down-arrow while this section is pinned, same as ExpectShowcase's
      // own horizontal cards — except there's only one destination here (the
      // marquee's fully-arrived end), not a row of cards, so this is a
      // 2-position cue rather than a per-card one: index 0 is "just
      // entered" (trigger.start), index 1 is "line fully arrived"
      // (trigger.end). ScrollCueController's existing "next card" logic
      // (index 0 → 1) is exactly "scroll to the end of this pin", so nothing
      // about ITS code has to know MoodSection isn't card-based.
      const trigger = tl.scrollTrigger!;
      setHorizontalCue({
        el: stage,
        cardCount: 2,
        activeIndex: () => (trigger.progress >= 0.99 ? 1 : 0),
        scrollYForCard: (index) => (index <= 0 ? trigger.start : trigger.end),
      });

      return () => setHorizontalCue(null);
    },
    { scope: wrapRef, dependencies: [staticBaseline] },
  );

  // Reduced-motion/lite: this beat IS the scroll-scrubbed marquee — a static
  // render is just the same six words sitting alone on an otherwise empty
  // screen, so skip the section entirely instead.
  if (staticBaseline) return null;

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
          {uiCopy.moodSection.heading}
        </h2>
      </div>
    </section>
  );
}
