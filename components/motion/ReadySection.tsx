"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { prefersReducedMotion } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const LINES = ["Get ready to join the", "biggest tech festival.", "Hosted by GDG Chennai."];

/**
 * A full-height beat between the hero and "About DevFest": a short question,
 * centred on its own stage, revealed in two phases the first (and only) time
 * the section is scrolled ~55% up the viewport:
 *
 *  1. A solid box wipes IN from the left (scaleX 0→1, origin left) over each
 *     row, top row first — covering text that was invisible the whole time
 *     anyway, so this phase just paints the boxes into place.
 *  2. The origin flips to the right and the same boxes wipe back OUT
 *     (scaleX 1→0, origin right), uncovering each row left-edge first.
 *
 * "Row" here means every visually rendered line, not every entry in LINES —
 * SplitText's own `type: "lines"` detection is what finds those, so an entry
 * that wraps onto a second line on a narrow screen (e.g. "Home community of
 * Chennai" on mobile) gets its own cover and its own wipe too, exactly like
 * a deliberate line break would.
 *
 * The covering boxes only ever get created once the client confirms motion
 * is allowed (`skipMotion` below) — under reduced motion, or before
 * hydration, a visitor gets plain static text and no box at all, never a
 * stuck cover.
 */
export function ReadySection() {
  const wrapRef = useRef<HTMLElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const skipMotion = useClientValue(prefersReducedMotion, true);

  useGSAP(
    () => {
      if (skipMotion) return;
      const lineEls = lineRefs.current.filter((el): el is HTMLDivElement => el !== null);
      if (lineEls.length === 0) return;

      const split = SplitText.create(lineEls, { type: "lines", mask: "lines" });
      const rows = split.lines as HTMLElement[];
      if (rows.length === 0) return () => split.revert();

      // One cover per detected visual row, injected into that row's own
      // mask wrapper (the element SplitText's `mask: "lines"` already made
      // `overflow: clip` for us) so it clips to exactly that row's box.
      const covers = rows.map((row) => {
        const mask = row.parentElement as HTMLElement;
        // The mask's own box is what `overflow: clip` clips against, sized
        // tightly to the line — tight enough that descenders (g, y, j, ...)
        // in this heading's line-height got sliced off at the bottom.
        // Padding pushes the clip boundary out past them; the cover below
        // still reads as a clean rectangle since it fills this same padded
        // box (inset-0), not just the text's own tighter bounds.
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
        scrollTrigger: {
          trigger: wrapRef.current,
          start: "top 55%",
          once: true,
        },
      });

      // Phase 1 — boxes wipe in from the left, top row first.
      tl.to(covers, {
        scaleX: 1,
        duration: 0.45,
        ease: "power3.inOut",
        stagger: 0.12,
      });

      // Hand-off: text is now laid out beneath the opaque boxes; flip the
      // wipe direction so the boxes peel off toward the right.
      tl.set(rows, { autoAlpha: 1 });
      tl.set(covers, { transformOrigin: "right center" });

      // Phase 2 — boxes wipe out to the right, revealing the text, top
      // row first.
      tl.to(covers, {
        scaleX: 0,
        duration: 0.6,
        ease: "power4.inOut",
        stagger: 0.12,
      });

      return () => {
        covers.forEach((c) => c.remove());
        split.revert();
      };
    },
    { scope: wrapRef, dependencies: [skipMotion] },
  );

  return (
    <section
      ref={wrapRef}
      className="relative flex min-h-[38vh] items-center justify-center overflow-hidden px-6 py-10 text-center sm:min-h-[60vh] sm:px-10 sm:py-16"
    >
      {/* No flex `gap` between LINES entries, deliberately: a `gap` spaces
          separate entries apart in ADDITION to their line-height, while a
          wrapped entry's own sub-lines only ever get line-height — mixing
          the two reads as uneven spacing (measured: entry-to-entry gaps
          came out visibly bigger than within-entry wrapped-line gaps).
          Line-height alone, uniformly, is what keeps every row — wrapped or
          not — spaced the same as its neighbour. */}
      <h2 className="flex flex-col items-center text-[clamp(2.25rem,8vw,6rem)] font-bold leading-[1.35] tracking-tight text-white">
        {LINES.map((line, i) => (
          <div
            key={line}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
          >
            {line}
          </div>
        ))}
      </h2>
    </section>
  );
}
