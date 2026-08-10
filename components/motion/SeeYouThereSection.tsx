"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { RollingText } from "@/components/motion/RollingText";
import { GlowButton } from "@/components/GlowButton";

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrambleTextPlugin);

const HEADING = "See you there!";

const LINKS = [
  { label: "Join the conversation →" },
  { label: "Become a Partner →" },
];

/** Resolves a `var(...)` (or any CSS colour expression) to the concrete
 *  colour the browser would paint it as, via a throwaway probe element —
 *  same technique MoodSection/VenueReveal use for their own handoffs. */
function resolveColor(expr: string): string {
  const probe = document.createElement("span");
  probe.style.color = expr;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return resolved;
}

/**
 * "See you there!" — the final beat before the footer. Closes out the page
 * on a settled note: the last --page-bg handoff (white → pastel yellow, the
 * colour that then holds all the way through the footer) plus a one-time
 * scramble-text reveal on the heading and two plain rolling-text links
 * underneath, both unwired placeholders for now.
 *
 * No opaque cover of its own — same rule MoodSection documents (see there):
 * BracketsField's 3D brackets are a fixed layer behind every section, and
 * this one deliberately leaves --brackets-opacity untouched (it's already 1
 * by the time MoodSection/ShowMoodSection hand off here), so they stay
 * visible straight through to the footer rather than being hidden for this
 * one stretch.
 *
 * The --page-bg tween uses a FIXED "#ffffff" start (the literal value
 * MoodSection's own tween ends at), never a live/lazy one — same reasoning
 * as MoodSection's own black -> white handoff (see there). A plain `.to()`
 * was tried here first and was the wrong call for this property: `.to()`
 * lazily captures its start value from whatever --page-bg happens to BE the
 * first time ScrollTrigger renders it, which is during the page's very
 * first refresh, before any real scroll — i.e. still black. That stale
 * black then got cached for the tween's whole lifetime and reasserted every
 * time scroll returned to this trigger's own progress-0 boundary, stomping
 * over whatever MoodSection had actually left --page-bg at (a visible
 * white -> black flash entering this section, and the backdrop staying
 * stuck black on scrolling back up past it). `immediateRender: false` is
 * what actually solves the mount-time-stomp problem `.to()` was reached for
 * in the first place — it keeps the fixed "from" from applying the instant
 * this component mounts, without needing a lazy/live capture at all.
 *
 * Under reduced-motion / lite: heading renders its final text directly (no
 * scramble), and --page-bg jumps straight to pastel yellow on mount —
 * mirroring MoodSection's own static-baseline mount effect, and relying on
 * the same sibling-mount-order guarantee (this section mounts after
 * MoodSection, so its jump to yellow always wins).
 */
export function SeeYouThereSection() {
  const wrapRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);

  useGSAP(
    () => {
      if (staticBaseline) {
        document.documentElement.style.setProperty("--page-bg", "var(--yellow-pastel)");
        return;
      }
      if (!wrapRef.current || !headingRef.current) return;

      const yellowResolved = resolveColor("var(--yellow-pastel)");

      // Fixed white -> pastel yellow, same technique MoodSection's own
      // black -> white handoff uses (see there) and for the same reason:
      // a `.to()` here would lazily capture its "from" from whatever
      // --page-bg happens to BE the first time ScrollTrigger renders this
      // tween — which is during the page's very first refresh, before any
      // real scroll has happened, while it's still black. That stale black
      // gets cached for the tween's whole lifetime and reasserted every
      // time scroll returns to this trigger's own progress-0 boundary,
      // stomping over whatever MoodSection actually left --page-bg at (a
      // visible white -> black flash entering this section, and the
      // backdrop staying stuck black on scrolling back up). "#ffffff" is
      // the literal value MoodSection's own tween ends at — not a
      // resolveColor() call, since it's already the same plain literal, not
      // a var() expression. `immediateRender: false` keeps this from
      // stamping that fixed white onto the shared property the instant
      // this component mounts (i.e. at the top of the page on first load),
      // before any scroll has carried the visitor anywhere near here.
      gsap.fromTo(
        document.documentElement,
        { "--page-bg": "#ffffff" },
        {
          "--page-bg": yellowResolved,
          ease: "none",
          immediateRender: false,
          scrollTrigger: { trigger: wrapRef.current, start: "top bottom", end: "top 40%", scrub: true },
        },
      );

      // One-shot scramble reveal, plays exactly once the first time the
      // heading nears the middle of the viewport. Starting text already
      // equals the target text (see the JSX) so there's no layout shift —
      // the plugin just glitches through random characters and converges
      // back to the same string that was always there.
      gsap.to(headingRef.current, {
        duration: 1.4,
        scrambleText: { text: HEADING, chars: "upperAndLowerCase", revealDelay: 0.3, speed: 0.35 },
        scrollTrigger: { trigger: wrapRef.current, start: "top 70%", once: true },
      });
    },
    { scope: wrapRef, dependencies: [staticBaseline] },
  );

  return (
    <section
      ref={wrapRef}
      className="relative flex min-h-[55vh] flex-col items-center justify-center gap-10 px-6 pb-16 pt-32 text-center sm:min-h-[70vh] sm:px-10 sm:pt-48"
    >
      <h2
        ref={headingRef}
        className="text-[clamp(2.75rem,10vw,7rem)] font-bold leading-none tracking-tight text-paper"
      >
        {HEADING}
      </h2>

      <div className="flex flex-col items-center gap-4 text-[clamp(1rem,2vw,1.375rem)] text-paper sm:flex-row sm:gap-10">
        {LINKS.map((link) => (
          // Unwired placeholders — a real <button> with a no-op onClick
          // rather than an `<a href="#">`, since there's genuinely nowhere
          // for these to go yet (see the module doc comment).
          <GlowButton key={link.label} onClick={() => {}}>
            <RollingText>{link.label}</RollingText>
          </GlowButton>
        ))}
      </div>
    </section>
  );
}
