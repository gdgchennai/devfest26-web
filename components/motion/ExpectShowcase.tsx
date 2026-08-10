"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { siteConfig } from "@/site.config";
import { archivePhotos } from "@/lib/content";
import { FALLBACK_BG } from "@/components/Frame";
import { fallbackColorFor, type FallbackColor } from "@/lib/fallback-color";
import { shouldSkipHeavyAssets, shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { setHorizontalCue } from "@/components/motion/scrollCueRegistry";
import { GlowButton } from "@/components/GlowButton";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/*
 * Resolved once at module scope, not per render: every input is static config,
 * and the running `previousColor` is a reassignment the React Compiler
 * (correctly) rejects inside a render body.
 *
 * Colour is picked the same way <Frame> picks it — deterministic from the
 * title, never repeating the previous card's — so lite's panels come out as
 * four different brand colours in a fixed order rather than a run of one.
 */
const EXPECT_CARDS = (() => {
  let previousColor: FallbackColor | undefined;
  return siteConfig.whatYoullGet.map((item, i) => {
    previousColor = fallbackColorFor(item.title, previousColor);
    return {
      item,
      // Placeholder imagery for now — cycles the local archive photos.
      photo: archivePhotos[i % archivePhotos.length],
      panelColor: previousColor,
    };
  });
})();

/** A single chevron, reused left/right by flipping it — same mark either way. */
function ArrowGlyph({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      style={{ transform: direction === "left" ? "rotate(90deg)" : "rotate(-90deg)" }}
    >
      <path
        d="M5 9l7 7 7-7"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Lite's version of this section: no GSAP, no scroll pin — a click-to-slide
 * carousel of straight-edged cards, one in frame at a time. Photos are kept
 * here (unlike the fallback-colour panels lite uses elsewhere): this is only
 * four `next/image` requests, sized to the card rather than the raw
 * originals, so the section reads as designed rather than flat colour.
 */
function ExpectCarousel() {
  const [index, setIndex] = useState(0);

  const canPrev = index > 0;
  const canNext = index < EXPECT_CARDS.length - 1;

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 sm:px-10">
      <h2 className="text-left text-[clamp(1.75rem,8vw,5rem)] font-bold leading-none tracking-tight">
        About DevFest
      </h2>

      <div className="relative mt-12">
        <div className="overflow-hidden rounded-2xl border border-paper/15">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {EXPECT_CARDS.map(({ item, photo }) => (
              <article key={item.title} className="relative h-[60vh] w-full shrink-0 overflow-hidden md:h-[70vh]">
                <div className="absolute inset-0">
                  {photo && (
                    <Image
                      src={photo.src}
                      alt=""
                      aria-hidden
                      fill
                      sizes="(min-width: 1024px) 65vw, (min-width: 768px) 80vw, 100vw"
                      className="object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
                </div>
                <div className="relative flex h-full flex-col justify-end p-8 sm:p-12">
                  <h3 className="text-4xl font-semibold tracking-tight sm:text-5xl">{item.title}</h3>
                  <p className="mt-3 max-w-md text-lg text-paper/85 sm:text-xl">{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <GlowButton
            shape="circle"
            size="md"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            textClassName={canPrev ? "text-paper" : "text-paper/30"}
            className={canPrev ? "" : "pointer-events-none"}
          >
            <span className="sr-only">Previous card</span>
            <ArrowGlyph direction="left" />
          </GlowButton>

          <div className="flex items-center gap-2" role="tablist" aria-label="About DevFest cards">
            {EXPECT_CARDS.map(({ item }, i) => (
              <button
                key={item.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={item.title}
                onClick={() => setIndex(i)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === index ? "bg-paper" : "bg-paper/30 hover:bg-paper/50"
                }`}
              />
            ))}
          </div>

          <GlowButton
            shape="circle"
            size="md"
            onClick={() => setIndex((i) => Math.min(EXPECT_CARDS.length - 1, i + 1))}
            textClassName={canNext ? "text-paper" : "text-paper/30"}
            className={canNext ? "" : "pointer-events-none"}
          >
            <span className="sr-only">Next card</span>
            <ArrowGlyph direction="right" />
          </GlowButton>
        </div>
      </div>
    </div>
  );
}

/**
 * The dark "What to expect" section that follows the hero: a pinned panel whose
 * leaning card row scrolls horizontally as the visitor scrolls down. This runs
 * on ALL screen sizes (mobile included) so the horizontal scroll is driven the
 * same way everywhere — by the page scroll (wheel / trackpad / touch) — rather
 * than a native swipe on mobile and a pin on desktop. The brand-shape backdrop
 * shows behind it.
 *
 * Carries the load-bearing `id="after-hero"` (skip link + hero escape target).
 * Under reduced-motion / lite / save-data it degrades to a static row — lite
 * specifically swaps in `<ExpectCarousel>` (see above) instead of just
 * freezing this section's own animated markup.
 */
export function ExpectShowcase() {
  const wrapRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Match SSR / no-JS with the static baseline, then upgrade on the client.
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);
  // Separate gate: reduced-motion keeps the photography (it is a vestibular
  // preference, not a bandwidth one) and only loses the horizontal scrub above.
  const liteAssets = useClientValue(shouldSkipHeavyAssets, true);


  useGSAP(
    () => {
      if (staticBaseline) return;

      // "About DevFest" rises into place, character by character, once as the
      // stage scrolls into view close beneath the hero. `mask: "chars"` wraps
      // each character in its own overflow-clip span so the rise reads as a
      // reveal rather than characters sliding in from behind neighbouring text.
      let split: SplitText | undefined;
      if (headingRef.current) {
        split = SplitText.create(headingRef.current, { type: "chars", mask: "chars" });
        gsap.set(split.chars, { yPercent: 130, opacity: 0 });
        ScrollTrigger.create({
          // The heading itself, not the whole (full-screen-tall) section —
          // it sits vertically centred inside `stage`, so triggering off the
          // SECTION's top fired while the heading was still well below the
          // viewport, and the reveal was long done by the time anyone
          // actually scrolled to where the heading was visible.
          trigger: headingRef.current,
          start: "top 80%",
          once: true,
          onEnter: () =>
            gsap.to(split!.chars, {
              yPercent: 0,
              opacity: 1,
              duration: 0.7,
              stagger: 0.02,
              ease: "power3.out",
            }),
        });
      }

      if (!stageRef.current || !trackRef.current) return () => split?.revert();
      const stage = stageRef.current;
      const track = trackRef.current;
      const heading = headingRef.current;
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const totalDistance = () => distance() + window.innerWidth;

      // Before the pin, the heading (centred inside this full-height stage)
      // rides the ordinary page scroll up from the bottom of the screen — the
      // hero is genuinely still leaving above it — arriving at the vertical
      // centre exactly as the stage's top reaches the top of the viewport.
      // That is the instant this pins: the heading holds at centre while the
      // card track, parked a full viewport off-screen right the whole time,
      // slides in over it and continues into the normal scrub.
      //
      // Pinning `stage` itself (rather than manually fixing the card layer)
      // is what makes GSAP release it cleanly back into normal flow the
      // moment the scroll range ends — so the whole stage scrolls away with
      // the rest of the page afterward instead of staying glued to the
      // viewport, and stays inert, ordinary in-flow content (not a permanent
      // full-screen overlay) at every point before its own turn arrives.
      const tween = gsap.fromTo(
        track,
        { x: () => window.innerWidth },
        {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: stage,
            start: "top top",
            end: () => `+=${totalDistance()}`,
            scrub: 1,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            refreshPriority: 1,
          },
        },
      );

      // The heading holds still while the first card is still approaching —
      // then, the instant that card's leading edge actually reaches it, gets
      // shoved out to the left instead of just sitting there getting covered.
      // `overlapProgress` is exactly the scrub progress at which the card's
      // left edge reaches the heading's right edge (both are pure functions of
      // trackX, which moves in lockstep with progress since the card tween
      // above is linear), so the two stay in sync without hard-coded numbers.
      let headingExit: gsap.core.Tween | undefined;
      if (heading) {
        const overlapProgress = () => {
          const total = totalDistance();
          if (total <= 0) return 0;
          return Math.min(1, Math.max(0, (window.innerWidth - heading.offsetWidth) / 2 / total));
        };
        headingExit = gsap.fromTo(
          heading,
          { x: 0 },
          {
            x: () => -(window.innerWidth / 2 + heading.offsetWidth / 2),
            ease: (p: number) => {
              const start = overlapProgress();
              return p < start ? 0 : (p - start) / (1 - start);
            },
            scrollTrigger: {
              trigger: stage,
              start: "top top",
              end: () => `+=${totalDistance()}`,
              scrub: 1,
              invalidateOnRefresh: true,
            },
          },
        );
      }

      // Publish this section's pin geometry for the floating scroll-cue button
      // (see ScrollCueController): it shows a right-arrow instead of a
      // down-arrow while this section is pinned, and needs to know how many
      // cards there are and which absolute scrollY centres each one.
      const trigger = tween.scrollTrigger!;
      const cardCount = EXPECT_CARDS.length;
      setHorizontalCue({
        el: stage,
        cardCount,
        activeIndex: () => {
          if (cardCount <= 1) return 0;
          return Math.round(trigger.progress * (cardCount - 1));
        },
        scrollYForCard: (index) => {
          if (cardCount <= 1) return trigger.start;
          const clamped = Math.min(cardCount - 1, Math.max(0, index));
          return trigger.start + (clamped / (cardCount - 1)) * (trigger.end - trigger.start);
        },
      });

      return () => {
        tween.kill();
        headingExit?.kill();
        split?.revert();
        setHorizontalCue(null);
      };
    },
    { scope: wrapRef, dependencies: [staticBaseline] },
  );

  if (staticBaseline) {
    return (
      <section id="after-hero" className="relative overflow-hidden text-paper">
        <ExpectCarousel />
      </section>
    );
  }

  return (
    <section id="after-hero" ref={wrapRef} className="relative overflow-hidden text-paper">
      <div className="relative z-10">
        <div ref={stageRef} className="relative h-screen">
          {/* The title: centred inside the stage, alone until the card track
              (below) slides in from off-screen right and, once in frame,
              paints over it — so the heading only shows before/between
              cards, never fighting them for attention. */}
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center sm:px-10">
            <h2
              ref={headingRef}
              // Fluid, viewport-scaled size (not fixed breakpoint steps) so it
              // reads at the same scale as the hero's WebGL "DevFest Chennai"
              // title, which is sized off the 3D scene rather than a CSS class.
              // font-bold, not the semibold every other heading uses: the hero's
              // WebGL title is set in Google Sans Bold specifically, and this is
              // the one heading meant to read at the same weight as it.
              //
              // whitespace-nowrap + a low clamp() floor (not the 3.5rem it used
              // to be): on narrow phones the OLD floor was taller than the
              // string could fit on one line at, so it wrapped to two —
              // shrinking further via vw instead reads as one confident line
              // running edge to edge, matching what this heading is going for,
              // rather than an awkward two-line stack. 11vw (not 12) leaves a
              // hair of breathing room against the section's own px-6/px-10
              // padding so the text doesn't visually kiss the edge.
              className="whitespace-nowrap text-[clamp(1.75rem,11vw,10rem)] font-bold leading-none tracking-tight"
            >
              About DevFest
            </h2>
          </div>

          <div className="absolute inset-0 flex items-center overflow-hidden [scrollbar-width:none]">
            <div ref={trackRef} className="flex will-change-transform">
              {EXPECT_CARDS.map(({ item, photo, panelColor }) => {
                return (
                  <article
                    key={item.title}
                    // Leaning parallelogram, sized so only ~1 (mobile) to ~1.5
                    // (desktop) cards fit at once, making the horizontal scroll
                    // read clearly. The slant is applied here and undone on the
                    // inner layers so photo and text stay upright. No gap and no
                    // corner radius between cards — they sit flush, edge to edge.
                    className="relative h-[60vh] w-[84vw] shrink-0 skew-x-[-9deg] overflow-hidden border border-paper/15 md:h-[70vh] md:w-[58vw] lg:w-[48vw]"
                  >
                    {/* Counter-skew keeps the photo upright (not sheared), and
                        the zoom (scale) enlarges it enough to cover the slanted
                        corners of the parallelogram with no gaps at any size. */}
                    <div className="absolute inset-0 skew-x-[9deg] scale-[1.35]">
                      {liteAssets ? (
                        /*
                         * Lite gets the brand halftone panel instead of the
                         * photo — the same answer <Frame> gives any frame
                         * without an image, so a lite card still reads as a
                         * designed object rather than an empty one.
                         *
                         * These four were the single heaviest thing lite still
                         * downloaded: raw archive originals, 366–505 KB each,
                         * 1.76 MB in total, for imagery that is `aria-hidden`
                         * and decorative.
                         */
                        <div aria-hidden className={`absolute inset-0 ${FALLBACK_BG[panelColor]}`} />
                      ) : (
                        photo && (
                          // next/image, not <img>: the raw tag served the full
                          // original at every viewport. Same `object-cover`
                          // crop, a fraction of the bytes.
                          <Image
                            src={photo.src}
                            alt=""
                            aria-hidden
                            fill
                            sizes="(min-width: 1024px) 65vw, (min-width: 768px) 80vw, 115vw"
                            className="object-cover"
                          />
                        )
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
                    </div>
                    <div className="relative flex h-full skew-x-[9deg] flex-col justify-end p-8 sm:p-12">
                      <h3 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                        {item.title}
                      </h3>
                      <p className="mt-3 max-w-md text-lg text-paper/85 sm:text-xl">
                        {item.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
