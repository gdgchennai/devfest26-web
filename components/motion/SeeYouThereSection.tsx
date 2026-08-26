"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { RollingText } from "@/components/motion/RollingText";
import { GlowButton } from "@/components/GlowButton";
import { uiCopy } from "@/site.config";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const HEADING = uiCopy.seeYouThereSection.heading;

const LINKS: readonly { label: string }[] = uiCopy.seeYouThereSection.links;

/**
 * "See you there!" — the final beat before the footer. Closes out the page
 * on a settled note: a one-time box-wipe reveal on the heading (the exact
 * technique ReadySection uses — a `SplitText` line-masked cover that wipes
 * in from the left, then back out to the right, uncovering the text — see
 * its own doc comment for the full mechanics), and two plain rolling-text
 * links underneath, both unwired placeholders for now.
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
 * wipe). --page-bg/--theme are untouched here too — VenueReveal's own
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

      // Same box-wipe reveal as ReadySection (see there for the full
      // walkthrough): SplitText detects this heading's own rendered line(s)
      // and masks each one; a cover wipes in from the left over the
      // (invisible) text, then wipes back out to the right, so the text
      // reads as uncovered rather than faded/typed/scrambled in.
      const split = SplitText.create(headingRef.current, { type: "lines", mask: "lines" });
      const rows = split.lines as HTMLElement[];
      if (rows.length === 0) return () => split.revert();

      const covers = rows.map((row) => {
        const mask = row.parentElement as HTMLElement;
        gsap.set(mask, { position: "relative", paddingBottom: "0.2em" });
        const cover = document.createElement("span");
        cover.setAttribute("aria-hidden", "true");
        cover.className = "pointer-events-none absolute inset-0 bg-yellow";
        mask.appendChild(cover);
        return cover;
      });

      gsap.set(rows, { autoAlpha: 0 });
      gsap.set(covers, { scaleX: 0, transformOrigin: "left center" });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: wrapRef.current, start: "top 70%", once: true },
      });

      tl.to(covers, { scaleX: 1, duration: 0.45, ease: "power3.inOut", stagger: 0.12 });
      tl.set(rows, { autoAlpha: 1 });
      tl.set(covers, { transformOrigin: "right center" });
      tl.to(covers, { scaleX: 0, duration: 0.6, ease: "power4.inOut", stagger: 0.12 });

      return () => {
        covers.forEach((c) => c.remove());
        split.revert();
      };
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
