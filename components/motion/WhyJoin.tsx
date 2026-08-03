"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { siteConfig } from "@/site.config";
import { HashTitle } from "@/components/motion/HashTitle";
import { prefersReducedMotion } from "@/lib/motion-prefs";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * One image per reason, in the same order as siteConfig.whyJoinUs. Placeholder
 * archive photos for now — swap the `src`/`alt` later without touching the
 * animation. The stack size is driven by this list's length, so adding a fifth
 * reason + photo just deepens the fan automatically.
 */
const REASON_PHOTOS = [
  { src: "/archive/2025-full-house.jpg", alt: "A packed auditorium at DevFest Chennai." },
  { src: "/archive/2024-speaker-on-stage.jpg", alt: "A speaker mid-talk on the main stage." },
  { src: "/archive/2024-group-photo.jpg", alt: "Attendees gathered on stage for the group photo." },
  { src: "/archive/2025-hosts-welcome.jpg", alt: "Two hosts welcoming the room." },
];

/**
 * The scattered slot each card sits in, front (pos 0) to back. Position 0 is the
 * one on top: nearly straight and centred; every card behind it is nudged and
 * tilted so it pokes out from under the one in front — the paper-stack look.
 * Read off a hand-tuned index table for the first few, with a deterministic
 * fallback so any stack depth keeps fanning.
 */
function slotFor(pos: number) {
  const rot = [2, -7, 6, -3, 8, -5][pos] ?? (pos % 2 ? -1 : 1) * (4 + pos);
  const x = [0, -22, 20, -10, 24, -16][pos] ?? (pos % 2 ? -1 : 1) * (12 + pos * 3);
  const y = [0, 12, 22, 32, 42, 52][pos] ?? pos * 10;
  return { x, y, rotate: rot, scale: 1 - pos * 0.02 };
}

/**
 * Lay every card into its slot for `order` (front-to-back). `animate` off is the
 * first paint and the reduced-motion path; on, everything eases to place.
 * `pulled` is the just-clicked card — it gets its own arc (out, up to the top of
 * the z-stack, then straight down onto the pile) instead of the plain tween,
 * which is what sells "pulled from inside and dropped on top".
 */
function place(
  cards: (HTMLDivElement | null)[],
  order: number[],
  { animate, pulled }: { animate: boolean; pulled: number | null },
) {
  const depth = order.length;
  order.forEach((cardIdx, pos) => {
    const el = cards[cardIdx];
    if (!el || cardIdx === pulled) return;
    const slot = slotFor(pos);
    const to = { ...slot, zIndex: depth - pos };
    if (animate) gsap.to(el, { ...to, duration: 0.55, ease: "power3.out" });
    else gsap.set(el, to);
  });

  if (pulled == null) return;
  const el = cards[pulled];
  if (!el) return;
  const front = slotFor(0);
  gsap.killTweensOf(el);
  if (!animate) {
    gsap.set(el, { ...front, zIndex: depth });
    return;
  }
  gsap
    .timeline()
    .set(el, { zIndex: depth + 1 }) // above everything for the whole arc
    .to(el, { x: front.x + 110, y: front.y - 12, rotate: -11, scale: 1.06, duration: 0.33, ease: "power2.out" })
    .to(el, { ...front, duration: 0.5, ease: "power3.inOut" })
    .set(el, { zIndex: depth }); // settle at the top slot's z
}

/**
 * "Why join" — the section where the page hands off from dark to light.
 *
 * The whole site's greyscale resolves from a single --theme value (0 = dark,
 * 1 = light) in globals.css: the fixed backdrop is var(--ink), all text is
 * var(--paper), and the card surfaces are mixed from those. Scrubbing --theme
 * from 0 → 1 as this section reaches the middle of the viewport turns the fixed
 * background white and every font ink at once, eased by the scroll. It clamps
 * at 1, so the page stays light below and returns to dark when scrolled above.
 *
 * The reasons are now interactive: each one owns a photo, and clicking it pulls
 * that photo out of the stack and lays it on top while the rest re-fan behind.
 */
export function WhyJoin() {
  const ref = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);
  const stackRef = useRef<HTMLDivElement>(null);
  // Stack order, front-to-back. order[0] is the card on top.
  const order = useRef<number[]>(siteConfig.whyJoinUs.map((_, i) => i));
  const [active, setActive] = useState(0);
  // The per-active effect fires once on mount too; the scroll entrance owns
  // that first paint, so this lets the effect skip it and only react to clicks.
  const firstRun = useRef(true);

  // Once: the global dark → light theme scrub and the load-bearing refresh.
  useGSAP(
    () => {
      if (!ref.current) return;

      const root = document.documentElement;
      const setTheme = gsap.quickSetter(root, "--theme");

      // Scrub the global theme from dark → light. Begin once this section's top
      // reaches the middle of the viewport, and finish over the next stretch.
      // onUpdate + quickSetter rather than a fromTo tween: some builds were not
      // applying the scrubbed custom property back to :root reliably.
      ScrollTrigger.create({
        trigger: ref.current,
        start: "top 50%",
        end: "top 10%",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => setTheme(self.progress),
      });

      // Scroll entrance: the photos start off to the right and fly in to form
      // the stack when the section scrolls into view. Back-to-front stagger so
      // the top card lands last and the pile assembles front-card-on-top.
      const cards = cardEls.current;
      const depth = order.current.length;

      if (prefersReducedMotion()) {
        // No fly-in — rest the stack in place, fully visible.
        place(cards, order.current, { animate: false, pulled: null });
        gsap.set(cards, { autoAlpha: 1 });
      } else {
        order.current.forEach((cardIdx, pos) => {
          const slot = slotFor(pos);
          gsap.set(cards[cardIdx], {
            x: 480 + pos * 52,
            y: slot.y - 28,
            rotate: 10 + pos * 3,
            scale: slot.scale,
            autoAlpha: 0,
            zIndex: depth - pos,
          });
        });

        const entrance = gsap.timeline({ paused: true });
        [...order.current].reverse().forEach((cardIdx, k) => {
          const pos = order.current.indexOf(cardIdx);
          const slot = slotFor(pos);
          entrance.to(
            cards[cardIdx],
            { x: slot.x, y: slot.y, rotate: slot.rotate, scale: slot.scale, autoAlpha: 1, duration: 0.7, ease: "power3.out" },
            k * 0.14,
          );
        });

        ScrollTrigger.create({
          trigger: stackRef.current,
          start: "top 78%",
          once: true,
          onEnter: () => entrance.play(),
        });
      }

      if (!prefersReducedMotion()) {
        /*
         * The only global ScrollTrigger.refresh() on first load, and load-bearing.
         *
         * Why it is needed: the pinned "What to expect" panel above inserts a pin
         * spacer, which changes document height. HashTitle's spin is bound to
         * absolute scroll bounds (0 → scrollHeight − innerHeight) with
         * invalidateOnRefresh, so it measures short unless something recomputes
         * after the spacer exists. MotionProvider does refresh, but only on route
         * CHANGE — `previousPathname` starts equal to `pathname`, so its effect
         * early-returns on the first render and never fires here.
         *
         * Why it belongs in this component: effects run children-before-parents
         * and siblings in mount order, so by the time this runs, every trigger on
         * the page has been created (ExpectShowcase and its HashTitle above, this
         * section's own HashTitle below it in the tree). Nothing further down the
         * page creates one. This is the last moment where a single refresh fixes
         * everything at once.
         *
         * Why the reduced-motion guard stays: under reduced motion ExpectShowcase
         * does not pin and HashTitle does not animate, so there is no spacer and
         * no trigger — the refresh would have nothing to correct.
         */
        ScrollTrigger.refresh();
      }
    },
    { scope: ref },
  );

  // Per active change: re-fan the stack. Driven by state (not a ref'd handler)
  // so the tweens always live in a fresh, live useGSAP context — clicks just
  // call setActive. The first run is the static initial paint (no arc); a real
  // selection moves the chosen card to the front of `order` and animates.
  useGSAP(
    () => {
      // Skip the mount run — the scroll entrance places the stack. Also skip
      // when the chosen card is already on top (re-click, or a Strict-Mode
      // remount landing back on the same `active`).
      if (firstRun.current) {
        firstRun.current = false;
        return;
      }
      if (order.current[0] === active) return;
      order.current = [active, ...order.current.filter((n) => n !== active)];
      place(cardEls.current, order.current, { animate: !prefersReducedMotion(), pulled: active });
    },
    { dependencies: [active], scope: ref },
  );

  return (
    <div
      ref={ref}
      data-bg-cycle
      // overflow-x-clip: the entrance parks the cards off the right edge before
      // flying them in, and hidden-but-transformed nodes would otherwise widen
      // the page. Clip is horizontal-only, so it creates no scroll container and
      // leaves the theme-scrub / HashTitle behaviour untouched.
      className="flex min-h-[70vh] flex-col justify-center overflow-x-clip px-6 py-12 sm:px-10 sm:py-20"
    >
      <div className="mb-6 w-full max-w-7xl sm:mb-12">
        <HashTitle>Why join</HashTitle>
      </div>

      <div className="grid w-full max-w-7xl items-center gap-6 sm:gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-24">
        {/* Left: one clickable reason per row. */}
        <ul className="flex flex-col gap-3 sm:gap-5">
          {siteConfig.whyJoinUs.map((reason, i) => {
            const isActive = active === i;
            return (
              <li key={reason}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={isActive}
                  className={`group flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3.5 text-left text-base leading-snug transition-colors sm:gap-6 sm:px-7 sm:py-6 sm:text-xl lg:text-2xl ${
                    isActive
                      ? "border-paper/25 bg-surface-raised text-paper"
                      : "border-paper/10 bg-surface text-paper/70 hover:text-paper"
                  }`}
                >
                  <span>{reason}</span>
                  <span
                    aria-hidden
                    className={`shrink-0 text-lg transition-transform sm:text-2xl ${isActive ? "translate-x-1" : "group-hover:translate-x-1"}`}
                  >
                    →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Right: the photo stack. Cards are absolutely stacked and driven by GSAP. */}
        <div
          ref={stackRef}
          className="relative mx-auto aspect-square w-full max-w-[15rem] sm:max-w-sm lg:ml-auto lg:mr-0 lg:max-w-[36rem]"
        >
          {siteConfig.whyJoinUs.map((_, i) => {
            const photo = REASON_PHOTOS[i % REASON_PHOTOS.length];
            return (
              <div
                key={i}
                ref={(el) => {
                  cardEls.current[i] = el;
                }}
                className="absolute inset-0 overflow-hidden rounded-2xl bg-surface-raised shadow-2xl shadow-black/20 ring-1 ring-black/5 will-change-transform"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 1024px) 36rem, 80vw"
                  className="object-cover"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
