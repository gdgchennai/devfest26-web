"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { siteConfig } from "@/site.config";
import { archivePhotos } from "@/lib/content";
import { HashTitle } from "@/components/motion/HashTitle";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const EXPECT_CARDS = siteConfig.whatYoullGet;

/**
 * The dark "What to expect" section that follows the hero: a pinned panel whose
 * leaning card row scrolls horizontally as the visitor scrolls down. This runs
 * on ALL screen sizes (mobile included) so the horizontal scroll is driven the
 * same way everywhere — by the page scroll (wheel / trackpad / touch) — rather
 * than a native swipe on mobile and a pin on desktop. The brand-shape backdrop
 * shows behind it.
 *
 * Carries the load-bearing `id="after-hero"` (skip link + hero escape target).
 * Under reduced-motion / lite / save-data it degrades to a static row.
 */
export function ExpectShowcase() {
  const wrapRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Match SSR / no-JS with the static baseline, then upgrade on the client.
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);

  useGSAP(
    () => {
      if (staticBaseline || !pinRef.current || !trackRef.current) return;
      const track = trackRef.current;
      const pin = pinRef.current;

      // Pin + scroll-jack the row horizontally at every breakpoint (no mobile
      // native-swipe exception). invalidateOnRefresh recomputes the distance on
      // resize so it stays correct across widths.
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: () => `+=${distance()}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          // Refresh before downstream triggers (e.g. HashTitle, whose spin is
          // bound to the document's full scroll height) so this pin's spacer is
          // in place when they measure their positions.
          refreshPriority: 1,
        },
      });
      return () => tween.kill();
    },
    { scope: wrapRef, dependencies: [staticBaseline] },
  );

  return (
    <section id="after-hero" ref={wrapRef} className="relative overflow-hidden text-paper">
      <div className="relative z-10">
        <div
          ref={pinRef}
          className="flex min-h-[70vh] flex-col justify-center py-20 md:h-screen md:py-0"
        >
          <div className="mb-10 px-6 sm:px-10">
            <HashTitle>What to expect</HashTitle>
          </div>

          <div className="overflow-hidden [scrollbar-width:none]">
            <div ref={trackRef} className="flex gap-10 px-8 will-change-transform sm:px-14">
              {EXPECT_CARDS.map((item, i) => {
                // Placeholder imagery for now — cycles the local archive photos.
                const photo = archivePhotos[i % archivePhotos.length];
                return (
                  <article
                    key={item.title}
                    // Leaning parallelogram, sized so only ~1 (mobile) to ~1.5
                    // (desktop) cards fit at once, making the horizontal scroll
                    // read clearly. The slant is applied here and undone on the
                    // inner layers so photo and text stay upright.
                    className="relative h-[60vh] w-[84vw] shrink-0 skew-x-[-9deg] overflow-hidden rounded-2xl border border-paper/15 md:h-[70vh] md:w-[58vw] lg:w-[48vw]"
                  >
                    {/* Counter-skew keeps the photo upright (not sheared), and
                        the zoom (scale) enlarges it enough to cover the slanted
                        corners of the parallelogram with no gaps at any size. */}
                    <div className="absolute inset-0 skew-x-[9deg] scale-[1.35]">
                      {photo && (
                        <img
                          src={photo.src}
                          alt=""
                          aria-hidden
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
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
