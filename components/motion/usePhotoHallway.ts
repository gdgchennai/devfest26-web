import { useCallback, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { clamp, mapRange, easeInAccelerating, easeOutSettle } from "@/lib/easing";

gsap.registerPlugin(ScrollTrigger);

function noop() {}

type PhotoOffset = { ox: number; oy: number; rotate: number };

/**
 * Fraction of the section where the fly-through ends and the photos settle into
 * the stack. Past PILE_END the stack holds — it is the destination of everything
 * that just flew past, not a transition, so it does not dissolve.
 */
const PILE_START = 0.74;
const PILE_END = 0.88;

/** Settled stack geometry. Position 0 is the top card. */
const STACK_SCALE = 0.42;
/** The top card straightens up and sits slightly proud of the rest. */
const TOP_SCALE = 0.52;

/**
 * Depth model for the fly-through phase. Cards sit SPACING apart along a virtual
 * z-axis and the camera travels through the stack, so each card's lifespan is
 * derived from the item count rather than a hardcoded per-index window — add or
 * remove photos in content/archive.json and the pacing stays even.
 */
const SPACING = 0.5;
const APPROACH = 1.2; // depth travelled while a card fades and scales in
const PASS = 0.9; // depth travelled after the camera plane before it is gone

/**
 * Scroll budget per photo, in viewport heights. Deliberately well below the
 * reference implementation's 1.15: that gallery is a standalone section, while
 * this is a page hero with a whole site underneath it — at 1.15 the hero would
 * eat ~14 screens of scroll before a visitor reached any content.
 */
const DEFAULT_PER_ITEM_VH = 0.3;

/** Card widths in vw, cycled. Varied sizes are what read as depth — see note in the hook. */
const WIDTHS = [30, 38, 26, 44, 32, 24, 36, 28, 42, 27, 34, 23];

function deterministicOffset(index: number): PhotoOffset {
  // Golden-angle scatter: spreads points off-centre and off the diagonals
  // deterministically (no Math.random(), so SSR/CSR and re-renders match).
  const angle = index * 137.508 * (Math.PI / 180);
  const radius = 0.25 + 0.35 * ((index * 0.618) % 1);
  return {
    ox: Math.cos(angle) * radius,
    oy: Math.sin(angle) * radius,
    rotate: -8 + ((index * 53) % 17),
  };
}

/** Width in vw for card `index`, so cards arrive at visibly different sizes. */
export function cardWidthVw(index: number): number {
  return WIDTHS[index % WIDTHS.length];
}

/** Every card the hook drives carries this class; it is also the CSS hook in globals.css. */
export const HALLWAY_CARD_CLASS = "hallway-card";

/**
 * Optional backdrop panel inside the section. If present it fades up as the
 * hallway takes over the viewport and back down as it releases, so the photos
 * fly through their own darkened space instead of over whatever precedes them.
 */
export const HALLWAY_BACKDROP_CLASS = "hallway-backdrop";

/** Fraction of the section spent fading the backdrop in at the start / out at the end. */
const BACKDROP_FADE = 0.08;

/**
 * Optional glow marking the far end of the tunnel — the light you steer toward,
 * so how much further to go is legible without any progress chrome. It blooms
 * as the camera closes on the stack, then hands off: it fades out across the
 * forming window as the real cards materialise in the same spot.
 */
export const HALLWAY_BEACON_CLASS = "hallway-beacon";

/** Exponent on the beacon's approach. >1 keeps it a distant pinprick for most
 *  of the tunnel and blooms late, which is what reads as "getting closer". */
const BEACON_APPROACH = 2.4;

/** Added to the cards once the stack has formed; carries the browse transition. */
const SETTLED_CLASS = "is-settled";

export type HallwayOptions = {
  containerRef: React.RefObject<HTMLElement | null>;
  count: number;
  maxScale?: number;
  /** Viewport heights of scroll per photo. Total section length scales with count. */
  perItemVh?: number;
  onProgress?: (progress: number) => void;
  /**
   * Fires when the stack finishes forming, and again if scrolling back up
   * unforms it. The caller uses this to enable the browse controls — the stack
   * is only interactive once it exists.
   */
  onSettledChange?: (settled: boolean) => void;
  disabled?: boolean;
};

export function usePhotoHallway({
  containerRef,
  count,
  maxScale = 3.2,
  perItemVh = DEFAULT_PER_ITEM_VH,
  onProgress,
  onSettledChange,
  disabled = false,
}: HallwayOptions) {
  // Populated by the effect below; lets the caller cycle the stack without the
  // hook re-running (which would tear down and rebuild the pinned trigger).
  const cycleRef = useRef<(delta: number) => void>(noop);

  useGSAP(() => {
    if (disabled || !containerRef.current) return;

    const offsets = Array.from({ length: count }, (_, i) => deterministicOffset(i));
    const container = containerRef.current;

    // Cards are queried from the scoped container rather than threaded in as a
    // ref array: two hallways on one page cannot collide, callers stay simpler,
    // and the render loop owns the elements it mutates.
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>(`.${HALLWAY_CARD_CLASS}`),
    ).slice(0, count);
    if (cards.length === 0) return;

    const backdrop = container.querySelector<HTMLElement>(`.${HALLWAY_BACKDROP_CLASS}`);
    const beacon = container.querySelector<HTMLElement>(`.${HALLWAY_BEACON_CLASS}`);

    // stackPos[cardIndex] = its depth in the settled stack; 0 is the top card.
    // Cycling rewrites this, never the DOM order, so the cards keep their
    // identity (and their scatter offset) as they move through the deck.
    const stackPos = cards.map((_, i) => i);
    let settled = false;

    // Camera sweeps from just before the first card to just past the last.
    const depths = Array.from({ length: count }, (_, i) => i * SPACING);
    const camStart = depths[0] - APPROACH;
    const camEnd = depths[count - 1] + PASS;

    let vw = window.innerWidth;
    let vh = window.innerHeight;

    function render(progress: number) {
      onProgress?.(progress);

      const inPile = progress >= PILE_START;
      const cam = gsap.utils.interpolate(
        camStart,
        camEnd,
        clamp(mapRange(0, PILE_START, 0, 1, progress)),
      );

      for (let i = 0; i < cards.length; i += 1) {
        const el = cards[i];
        const offset = offsets[i];

        let scale: number;
        let opacity: number;
        let tx = offset.ox;
        let ty = offset.oy;
        let rotate = 0;
        let zIndex: number;

        if (!inPile) {
          // p runs 0 -> 1 across this card's whole life, from fade-in to gone.
          const p = (cam - depths[i] + APPROACH) / (APPROACH + PASS);

          if (p <= 0 || p >= 1) {
            // Off camera: write opacity once and skip the rest of the work.
            if (el.style.opacity !== "0") el.style.opacity = "0";
            continue;
          }

          scale = 0.15 + (maxScale - 0.15) * easeInAccelerating(p);
          // Hug the centre, then accelerate outward — a linear drift makes the
          // cards look like they are sliding rather than passing the camera.
          const drift = Math.pow(p, 1.4);
          tx = offset.ox * drift;
          ty = offset.oy * drift;
          opacity = clamp(Math.min(p / 0.14, (1 - p) / 0.16));
          // Nearer cards paint over farther ones, by depth rather than by index.
          zIndex = Math.round(p * 1000);
        } else {
          // Forming, then holding. `raw` saturates at 1 past PILE_END, so the
          // stack simply stays put rather than dissolving — it is the
          // destination for everything that just flew past.
          const raw = clamp(mapRange(PILE_START, PILE_END, 0, 1, progress));
          const pileLocal = easeOutSettle(raw);
          const pos = stackPos[i];
          const isTop = pos === 0;

          // The top card straightens and sits proud so it reads as "this one",
          // and cycling the deck is visible rather than just a z-index swap.
          const targetScale = isTop ? TOP_SCALE : STACK_SCALE;
          const targetX = isTop ? 0 : offset.ox * 0.15;
          const targetY = isTop ? 0 : offset.oy * 0.15;
          const targetRotate = isTop ? 0 : offset.rotate;

          scale = gsap.utils.interpolate(maxScale, targetScale, pileLocal);
          tx = gsap.utils.interpolate(offset.ox, targetX, pileLocal);
          ty = gsap.utils.interpolate(offset.oy, targetY, pileLocal);
          rotate = gsap.utils.interpolate(0, targetRotate, pileLocal);
          // By the time the stack starts forming the camera has passed every
          // card, so all of them are at opacity 0. Crossfade them back in over
          // the first third instead of popping the whole set in on one frame.
          opacity = clamp(raw / 0.33);
          zIndex = 100 + count - pos;
        }

        // Direct style writes rather than gsap.set(): this runs for every card
        // on every frame, and gsap.set re-parses the "vw"/"vh" unit strings and
        // walks its property pipeline each time.
        const dx = tx * scale * vw * 0.5;
        const dy = ty * scale * vh * 0.5;
        el.style.opacity = opacity.toFixed(3);
        el.style.transform =
          `translate(-50%, -50%) translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) ` +
          `rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        el.style.zIndex = String(zIndex);
      }

      if (backdrop) {
        backdrop.style.opacity = clamp(
          Math.min(progress / BACKDROP_FADE, (1 - progress) / BACKDROP_FADE),
        ).toFixed(3);
      }

      if (beacon) {
        // Approach 0 -> 1 across the tunnel, then hand off to the real stack
        // over the forming window so the light resolves into the photos.
        const approach = clamp(mapRange(0, PILE_START, 0, 1, progress));
        const handoff = clamp(mapRange(PILE_START, PILE_END, 1, 0, progress));
        const bloom = Math.pow(approach, BEACON_APPROACH);
        // Only opacity and transform — a re-rasterised gradient every frame is
        // the same trap as a blurred box-shadow on a moving card.
        beacon.style.opacity = (bloom * handoff).toFixed(3);
        beacon.style.transform = `translate(-50%, -50%) scale(${(0.18 + bloom * 1.5).toFixed(3)})`;
      }

      const nowSettled = progress >= PILE_END;
      if (nowSettled !== settled) {
        settled = nowSettled;
        // Only transition while settled. Positions do not change past PILE_END,
        // so adding it here animates nothing; it exists purely so cycling the
        // stack glides. Removing it on the way back up keeps the scroll-driven
        // per-frame writes instant instead of smeared.
        for (const el of cards) el.classList.toggle(SETTLED_CLASS, nowSettled);
        onSettledChange?.(nowSettled);
      }
    }

    // A scrubbed ScrollTrigger only interpolates smoothly when it drives an
    // ANIMATION — rendering straight from onUpdate(self.progress) steps with
    // each wheel notch. So scrub a one-unit proxy tween and render from its
    // smoothed playhead instead.
    const proxy = { p: 0 };
    const tl = gsap.timeline({ paused: true }).to(proxy, { p: 1, duration: 1, ease: "none" });
    tl.eventCallback("onUpdate", () => render(proxy.p));

    ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: () => `+=${count * perItemVh * window.innerHeight + window.innerHeight}`,
      pin: true,
      scrub: 1,
      animation: tl,
      invalidateOnRefresh: true,
      onRefresh: () => {
        vw = window.innerWidth;
        vh = window.innerHeight;
      },
    });

    // Rotating the deck: every card moves one place, and whichever falls off
    // the near end wraps to the back. Only stackPos changes, then we re-render
    // from the current playhead — the scroll position is untouched, so browsing
    // the stack never fights the scroll.
    cycleRef.current = (delta: number) => {
      if (count < 2 || !settled) return;
      const step = ((delta % count) + count) % count;
      if (step === 0) return;
      for (let i = 0; i < count; i += 1) {
        stackPos[i] = (stackPos[i] - step + count * 2) % count;
      }
      // The move is animated by a CSS transition that is only live while
      // settled (see SETTLED_CLASS below) — a GSAP tween cannot drive these
      // cards, because render() owns their inline transform outright.
      render(proxy.p);
    };

    render(0);
  }, {
    scope: containerRef,
    dependencies: [count, maxScale, perItemVh, disabled],
    revertOnUpdate: true,
  });

  /** Advance the stack by `delta` cards (negative goes back). No-op until settled. */
  const cycle = useCallback((delta: number) => cycleRef.current(delta), []);

  return { cycle };
}
