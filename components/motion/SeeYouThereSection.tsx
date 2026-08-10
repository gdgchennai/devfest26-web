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

/**
 * "See you there!" — the final beat before the footer. Closes out the page
 * on a settled note: a one-time scramble-text reveal on the heading, and
 * two plain rolling-text links underneath, both unwired placeholders for
 * now.
 *
 * --page-bg is left completely alone — no handoff to run here. MoodSection
 * settles it on black (VenueReveal's own pinned overlay lands it there,
 * see MoodSection's doc comment) and black is the page's SETTLED colour
 * from there all the way through the footer now, not a waypoint on the way
 * to something else.
 *
 * No opaque cover of its own — same rule MoodSection documents (see there):
 * BracketsField's 3D brackets are a fixed layer behind every section, and
 * this one deliberately leaves --brackets-opacity untouched (it's already 1
 * by the time MoodSection/ShowMoodSection hand off here), so they stay
 * visible straight through to the footer rather than being hidden for this
 * one stretch. --theme is left alone too, for the matching reason: it's
 * already 0 by the time this section is reached (MoodSection's own pin
 * flips it — see there), which is what keeps this section's own
 * `text-paper` heading/links near-white against the black backdrop.
 *
 * Under reduced-motion / lite: heading renders its final text directly (no
 * scramble). --page-bg/--theme are untouched here too — VenueReveal's own
 * reduced-motion path settles on pastel blue with --theme:1, and nothing
 * downstream (MoodSection included) changes either for that path, so
 * whatever it left standing is what this section inherits.
 */
export function SeeYouThereSection() {
  const wrapRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);

  useGSAP(
    () => {
      if (staticBaseline) return;
      if (!wrapRef.current || !headingRef.current) return;

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
