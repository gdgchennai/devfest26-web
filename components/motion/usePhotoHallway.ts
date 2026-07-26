import { useCallback, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { clamp, mapRange, easeInAccelerating, easeOutSettle } from "@/lib/easing";

gsap.registerPlugin(ScrollTrigger);

function noop() {}

type PhotoOffset = { ox: number; oy: number; rotate: number };

/**
 * Progress map for the pinned section.
 *
 *   0 ─────────────── TUNNEL_END ─────── HANDOFF_END ──── 1
 *   fly-through,                  stack slides to its    browse
 *   stack approaching             hero position,         window
 *   in the distance               copy reveals
 */
const TUNNEL_END = 0.72;
const HANDOFF_END = 0.9;

/**
 * Depth model for the fly-through. Cards sit SPACING apart along a virtual
 * z-axis and the camera travels through them, so each card's lifespan derives
 * from the item count rather than a hardcoded per-index window — add or remove
 * photos in content/archive.json and the pacing stays even.
 */
const SPACING = 0.5;
const APPROACH = 1.2; // depth travelled while a card fades and scales in
const PASS = 0.9; // depth travelled past the camera plane before it is gone

/**
 * Scroll budget per photo, in viewport heights. Deliberately well below the
 * reference implementation's 1.15: that gallery is a standalone section, while
 * this is a page hero with a whole site underneath it — at 1.15 the hero would
 * eat ~14 screens of scroll before a visitor reached any content.
 */
const DEFAULT_PER_ITEM_VH = 0.3;

/** How small the destination is at the far end of the tunnel. */
const STACK_FAR_SCALE = 0.07;
/**
 * Exponent on the stack's approach. Above 1 it stays a distant speck for most
 * of the tunnel and arrives late, which is what reads as *getting closer*; at 1
 * it just sits there growing steadily and gives away the ending.
 */
const STACK_APPROACH = 2.4;

/** Where the stack parks once it hands off to the hero, as a fraction of half-viewport. */
const HERO_X = 0.46;
const HERO_SCALE = 0.74;

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

/** A photo that flies past the camera. */
export const HALLWAY_CARD_CLASS = "hallway-card";
/** Wrapper for the destination photos; carries the group transform and opacity. */
export const HALLWAY_STACK_CLASS = "hallway-stack";
/** A photo inside that wrapper. Always fully opaque — see note in render(). */
export const STACK_CARD_CLASS = "stack-card";
/** Darkened space the photos travel through. */
export const HALLWAY_BACKDROP_CLASS = "hallway-backdrop";
/** Faint halo behind the distant stack, so a speck still reads as *something there*. */
export const HALLWAY_BEACON_CLASS = "hallway-beacon";

/** Fraction of the section spent fading the backdrop in at the start / out at the end. */
const BACKDROP_FADE = 0.08;

/** Added to the stack cards once browsing is live; carries the cycle transition. */
const SETTLED_CLASS = "is-settled";

export type HallwayPhase = "tunnel" | "hero";

export type HallwayOptions = {
  containerRef: React.RefObject<HTMLElement | null>;
  /** Number of photos that fly past. Section length scales with this. */
  flyCount: number;
  /** Number of photos in the destination stack. */
  stackCount: number;
  maxScale?: number;
  /** Viewport heights of scroll per flying photo. */
  perItemVh?: number;
  /**
   * Slide the stack aside at the end to make room for hero copy. The homepage
   * does; /memories has no copy to make room for, so its stack stays centred.
   */
  heroHandoff?: boolean;
  /** Fires when the stack finishes arriving, and again if scrolling back up undoes it. */
  onPhaseChange?: (phase: HallwayPhase) => void;
  disabled?: boolean;
};

export function usePhotoHallway({
  containerRef,
  flyCount,
  stackCount,
  maxScale = 3.2,
  perItemVh = DEFAULT_PER_ITEM_VH,
  heroHandoff = false,
  onPhaseChange,
  disabled = false,
}: HallwayOptions) {
  // Populated by the effect below; lets the caller cycle the stack without the
  // hook re-running, which would tear down and rebuild the pinned trigger.
  const cycleRef = useRef<(delta: number) => void>(noop);

  useGSAP(() => {
    if (disabled || !containerRef.current) return;
    const container = containerRef.current;

    // Elements are queried from the scoped container rather than threaded in as
    // ref arrays: two hallways on one page cannot collide, callers stay
    // simpler, and the render loop owns everything it mutates.
    const flyCards = Array.from(
      container.querySelectorAll<HTMLElement>(`.${HALLWAY_CARD_CLASS}`),
    ).slice(0, flyCount);
    const stackGroup = container.querySelector<HTMLElement>(`.${HALLWAY_STACK_CLASS}`);
    const stackCards = Array.from(
      container.querySelectorAll<HTMLElement>(`.${STACK_CARD_CLASS}`),
    ).slice(0, stackCount);
    const backdrop = container.querySelector<HTMLElement>(`.${HALLWAY_BACKDROP_CLASS}`);
    const beacon = container.querySelector<HTMLElement>(`.${HALLWAY_BEACON_CLASS}`);
    if (flyCards.length === 0 && stackCards.length === 0) return;

    const flyOffsets = Array.from({ length: flyCount }, (_, i) => deterministicOffset(i));
    const stackOffsets = Array.from({ length: stackCount }, (_, i) => deterministicOffset(i + 7));

    // stackPos[cardIndex] = depth in the deck; 0 is the top card. Cycling
    // rewrites this and never the DOM order, so each card keeps its identity.
    const stackPos = stackCards.map((_, i) => i);
    let phase: HallwayPhase = "tunnel";

    const depths = Array.from({ length: flyCount }, (_, i) => i * SPACING);
    const camStart = depths.length ? depths[0] - APPROACH : 0;
    const camEnd = depths.length ? depths[flyCount - 1] + PASS : 0;

    let vw = window.innerWidth;
    let vh = window.innerHeight;

    function renderFlyCards(progress: number) {
      const travelled = clamp(mapRange(0, TUNNEL_END, 0, 1, progress));
      const cam = gsap.utils.interpolate(camStart, camEnd, travelled);

      for (let i = 0; i < flyCards.length; i += 1) {
        const el = flyCards[i];
        const offset = flyOffsets[i];
        // p runs 0 -> 1 across this card's whole life, from fade-in to gone.
        const p = (cam - depths[i] + APPROACH) / (APPROACH + PASS);

        if (p <= 0 || p >= 1) {
          // Off camera: write opacity once and skip the rest of the work.
          if (el.style.opacity !== "0") el.style.opacity = "0";
          continue;
        }

        const scale = 0.15 + (maxScale - 0.15) * easeInAccelerating(p);
        // Hug the centre, then accelerate outward — a linear drift makes cards
        // look like they are sliding rather than passing the camera.
        const drift = Math.pow(p, 1.4);
        const dx = offset.ox * drift * scale * vw * 0.5;
        const dy = offset.oy * drift * scale * vh * 0.5;

        // Direct style writes rather than gsap.set(): this runs for every card
        // every frame, and gsap.set re-parses unit strings and walks its
        // property pipeline each time.
        el.style.opacity = clamp(Math.min(p / 0.14, (1 - p) / 0.16)).toFixed(3);
        el.style.transform =
          `translate(-50%, -50%) translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) ` +
          `scale(${scale.toFixed(3)})`;
        // Nearer cards paint over farther ones, by depth rather than by index.
        el.style.zIndex = String(Math.round(p * 1000));
      }
    }

    function renderStack(progress: number) {
      if (!stackGroup) return;

      const approach = clamp(mapRange(0, TUNNEL_END, 0, 1, progress));
      const bloom = Math.pow(approach, STACK_APPROACH);
      const handoff = heroHandoff
        ? easeOutSettle(clamp(mapRange(TUNNEL_END, HANDOFF_END, 0, 1, progress)))
        : 0;

      const groupScale = gsap.utils.interpolate(STACK_FAR_SCALE, 1, bloom) *
        gsap.utils.interpolate(1, HERO_SCALE, handoff);
      const groupX = HERO_X * handoff * vw * 0.5;

      // ONE opacity, on the group. Fading the cards individually would stack a
      // dozen semi-transparent photos on top of each other, which reads as mud;
      // the cards themselves stay fully opaque so overlapping them reads as
      // depth instead.
      stackGroup.style.opacity = bloom.toFixed(3);
      stackGroup.style.transform =
        `translate(-50%, -50%) translate3d(${groupX.toFixed(1)}px, 0, 0) scale(${groupScale.toFixed(4)})`;

      for (let i = 0; i < stackCards.length; i += 1) {
        const el = stackCards[i];
        const offset = stackOffsets[i];
        const pos = stackPos[i];
        const isTop = pos === 0;
        // Depth comes from geometry, not alpha: the front card carries the
        // photo and the rest peek out behind it as edges and slivers.
        const recede = pos * 0.045;
        const tx = isTop ? 0 : offset.ox * 0.1 + recede;
        const ty = isTop ? 0 : offset.oy * 0.1 + recede;
        el.style.transform =
          `translate(-50%, -50%) translate3d(${(tx * 100).toFixed(1)}px, ${(ty * 100).toFixed(1)}px, 0) ` +
          `rotate(${(isTop ? 0 : offset.rotate).toFixed(2)}deg) scale(${(1 - pos * 0.04).toFixed(3)})`;
        el.style.zIndex = String(100 + stackCards.length - pos);
      }

      if (beacon) {
        // Atmosphere only: it exists so a 2%-of-viewport speck reads as
        // something out there, and gets out of the way once the stack is real.
        beacon.style.opacity = (bloom * (1 - bloom) * 1.6).toFixed(3);
        beacon.style.transform =
          `translate(-50%, -50%) scale(${(0.18 + bloom * 1.4).toFixed(3)})`;
      }
    }

    function render(progress: number) {
      renderFlyCards(progress);
      renderStack(progress);

      if (backdrop) {
        backdrop.style.opacity = clamp(
          Math.min(progress / BACKDROP_FADE, (1 - progress) / BACKDROP_FADE),
        ).toFixed(3);
      }

      const nextPhase: HallwayPhase = progress >= HANDOFF_END ? "hero" : "tunnel";
      if (nextPhase !== phase) {
        phase = nextPhase;
        // Only transition while parked. Positions do not change past
        // HANDOFF_END, so switching this on animates nothing by itself; it
        // exists purely so cycling the deck glides. Removing it on the way back
        // up keeps the scroll-driven writes instant instead of smeared.
        for (const el of stackCards) el.classList.toggle(SETTLED_CLASS, nextPhase === "hero");
        onPhaseChange?.(nextPhase);
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
      end: () => `+=${flyCount * perItemVh * window.innerHeight + window.innerHeight}`,
      pin: true,
      scrub: 1,
      animation: tl,
      invalidateOnRefresh: true,
      onRefresh: () => {
        vw = window.innerWidth;
        vh = window.innerHeight;
      },
    });

    // Rotating the deck: every card moves one place and whichever falls off the
    // near end wraps to the back. Only stackPos changes, then we re-render from
    // the current playhead — the scroll position is untouched, so browsing the
    // stack never fights the scroll.
    cycleRef.current = (delta: number) => {
      if (stackCards.length < 2 || phase !== "hero") return;
      const n = stackCards.length;
      const step = ((delta % n) + n) % n;
      if (step === 0) return;
      for (let i = 0; i < n; i += 1) stackPos[i] = (stackPos[i] - step + n * 2) % n;
      // Animated by the CSS transition on .stack-card.is-settled, not GSAP:
      // render() owns these inline transforms outright, so a tween on them
      // would simply be overwritten.
      render(proxy.p);
    };

    render(0);
  }, {
    scope: containerRef,
    dependencies: [flyCount, stackCount, maxScale, perItemVh, heroHandoff, disabled],
    revertOnUpdate: true,
  });

  /** Advance the stack by `delta` cards (negative goes back). Inert until it has landed. */
  const cycle = useCallback((delta: number) => cycleRef.current(delta), []);

  return { cycle };
}
