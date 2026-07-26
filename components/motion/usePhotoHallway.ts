import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { clamp, mapRange, easeInAccelerating, easeOutSettle } from "@/lib/easing";

gsap.registerPlugin(ScrollTrigger);

type PhotoOffset = { ox: number; oy: number; rotate: number };

/**
 * Progress map for the pinned section.
 *
 *   0 ─────────────── TUNNEL_END ─────── HANDOFF_END ──── 1
 *   fly-through,                  stack rises and         settled
 *   stack approaching             spreads into a row,     hero
 *   in the distance               copy rises beneath it
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
 * How far into its life the nearest photo already is at progress 0. Without it
 * the camera starts exactly where the first card begins to exist, so the tunnel
 * opens on an empty frame and only populates once you scroll — you would arrive
 * to nothing. At 0.35 two photos are already in flight when the curtain lifts,
 * so there is something to be moving *through* from the first moment.
 */
const PRIMED = 0.35;

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
 * it just grows steadily and gives away the ending.
 */
const STACK_APPROACH = 2.4;

/**
 * Where the destination reaches full opacity, as a fraction of the tunnel, and
 * how visible it is on the very first frame.
 *
 * Opacity is deliberately NOT driven off the same exponential as scale. Scale
 * is perspective and genuinely nonlinear; visibility is not — a distant object
 * is small, not transparent. Driving both off `bloom` left the stack at 0.4%
 * opacity a twentieth of the way in and under 3% a tenth of the way in, so the
 * thing whose whole job is to show you how far you have left was invisible for
 * the first third of the journey. It also let flying photos show through it.
 */
const STACK_VISIBLE_BY = 0.45;
const STACK_MIN_OPACITY = 0.18;

/** Fraction of the container the spread row spans, and the gap between cards. */
const ROW_SPAN = 0.92;
const ROW_GAP = 1.06;
/** How far up the row travels, as a fraction of viewport height. */
const ROW_RISE = -0.3;

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
/** A photo inside that wrapper. Always fully opaque — see note in renderStack(). */
export const STACK_CARD_CLASS = "stack-card";
/** Darkened space the photos travel through. */
export const HALLWAY_BACKDROP_CLASS = "hallway-backdrop";
/** Faint halo behind the distant stack, so a speck still reads as *something out there*. */
export const HALLWAY_BEACON_CLASS = "hallway-beacon";
/**
 * Content that rises into place as the row lands — the hero copy block, moved
 * as one sheet rather than line by line. Driven from here rather than by a
 * timeline so it is scrubbed: the visitor pulls the page up under the row with
 * their own scroll, instead of the text playing on its own clock while the row
 * moves on theirs.
 */
export const HALLWAY_RISE_CLASS = "hallway-rise";

/** How far the rising content travels, as a fraction of viewport height. */
const RISE_FROM = 0.45;

/** Fraction of the section spent fading the backdrop in at the start / out at the end. */
const BACKDROP_FADE = 0.08;

export type HallwayPhase = "tunnel" | "hero";

export type HallwayOptions = {
  containerRef: React.RefObject<HTMLElement | null>;
  /** Number of photos that fly past. Section length scales with this. */
  flyCount: number;
  /** Number of photos in the destination row. */
  stackCount: number;
  maxScale?: number;
  /** Viewport heights of scroll per flying photo. */
  perItemVh?: number;
  /**
   * Also lift the row to the top of the section, so hero copy can rise beneath
   * it. The homepage does; /memories has no copy to make room for, so its row
   * spreads where it is.
   */
  riseToTop?: boolean;
  /** Fires when the row finishes landing, and again if scrolling back up undoes it. */
  onPhaseChange?: (phase: HallwayPhase) => void;
  disabled?: boolean;
};

export function usePhotoHallway({
  containerRef,
  flyCount,
  stackCount,
  maxScale = 3.2,
  perItemVh = DEFAULT_PER_ITEM_VH,
  riseToTop = false,
  onPhaseChange,
  disabled = false,
}: HallwayOptions) {
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
    const rising = container.querySelector<HTMLElement>(`.${HALLWAY_RISE_CLASS}`);
    if (flyCards.length === 0 && stackCards.length === 0) return;

    const flyOffsets = Array.from({ length: flyCount }, (_, i) => deterministicOffset(i));
    const stackOffsets = Array.from({ length: stackCount }, (_, i) => deterministicOffset(i + 7));

    let phase: HallwayPhase = "tunnel";

    const depths = Array.from({ length: flyCount }, (_, i) => i * SPACING);
    const camStart = depths.length ? depths[0] - APPROACH + PRIMED * (APPROACH + PASS) : 0;
    const camEnd = depths.length ? depths[flyCount - 1] + PASS : 0;

    let vw = window.innerWidth;
    let vh = window.innerHeight;
    /**
     * Shrink applied to the group so `stackCount` cards laid side by side span
     * ROW_SPAN of the container. Measured rather than derived from the CSS
     * width, so changing `.hallway-stack` in globals.css cannot silently break
     * the arithmetic here.
     */
    let rowScale = 1;

    function measure() {
      vw = window.innerWidth;
      vh = window.innerHeight;
      const n = stackCards.length;
      const groupWidth = stackGroup?.offsetWidth ?? 0;
      const containerWidth = container.offsetWidth || vw;
      rowScale = n > 0 && groupWidth > 0
        ? Math.min(1, (ROW_SPAN * containerWidth) / (n * ROW_GAP * groupWidth))
        : 1;
    }

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
        // Offset past the destination layer (z-index 2) and the beacon (1):
        // every flying photo is nearer than the far end of the tunnel, so a
        // just-appearing card at p≈0 must still sit in front of them.
        el.style.zIndex = String(10 + Math.round(p * 1000));
      }
    }

    function renderStack(progress: number) {
      if (!stackGroup) return;
      const n = stackCards.length;

      const approach = clamp(mapRange(0, TUNNEL_END, 0, 1, progress));
      const bloom = Math.pow(approach, STACK_APPROACH);
      const spread = easeOutSettle(clamp(mapRange(TUNNEL_END, HANDOFF_END, 0, 1, progress)));

      const groupScale =
        gsap.utils.interpolate(STACK_FAR_SCALE, 1, bloom) *
        gsap.utils.interpolate(1, rowScale, spread);
      const groupY = riseToTop ? ROW_RISE * spread * vh : 0;

      // ONE opacity, on the group. Fading the cards individually would stack
      // semi-transparent photos on top of each other, which reads as mud; the
      // cards themselves are opaque, so overlapping them reads as depth.
      // Ramped on `approach`, not `bloom` — see STACK_VISIBLE_BY.
      stackGroup.style.opacity = clamp(
        mapRange(0, STACK_VISIBLE_BY, STACK_MIN_OPACITY, 1, approach),
      ).toFixed(3);
      stackGroup.style.transform =
        `translate(-50%, -50%) translate3d(0px, ${groupY.toFixed(1)}px, 0) scale(${groupScale.toFixed(4)})`;

      for (let i = 0; i < n; i += 1) {
        const el = stackCards[i];
        const offset = stackOffsets[i];
        const isFront = i === 0;

        // Deck: the front card square-on, the rest peeking out behind it as
        // edges and slivers. Percentages, not px, so they track the card as the
        // group scales.
        const deckX = isFront ? 0 : offset.ox * 10 + i * 4.5;
        const deckY = isFront ? 0 : offset.oy * 10 + i * 4.5;
        const deckRotate = isFront ? 0 : offset.rotate;
        const deckScale = 1 - i * 0.04;

        // Row: evenly spaced about the centre, all square-on and equal size.
        const rowX = (i - (n - 1) / 2) * 100 * ROW_GAP;

        const x = gsap.utils.interpolate(deckX, rowX, spread);
        const y = gsap.utils.interpolate(deckY, 0, spread);
        const rotate = gsap.utils.interpolate(deckRotate, 0, spread);
        const scale = gsap.utils.interpolate(deckScale, 1, spread);

        el.style.transform =
          `translate(-50%, -50%) translate(${x.toFixed(2)}%, ${y.toFixed(2)}%) ` +
          `rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        el.style.zIndex = String(100 + n - i);
      }

      if (beacon) {
        // Atmosphere: it exists so a 7%-scale speck reads as something out
        // there, so it has to be brightest while the stack is *smallest*.
        // Driving it off `bloom` did the exact opposite — it peaked around the
        // halfway mark, by which point the stack was half-size and fully solid
        // and needed no help, and was at 1% opacity when the stack was a speck.
        beacon.style.opacity = (
          clamp(approach / 0.06) * Math.pow(1 - approach, 2) * 0.55
        ).toFixed(3);
        beacon.style.transform = `translate(-50%, -50%) scale(${(0.18 + bloom * 1.4).toFixed(3)})`;
      }
    }

    function render(progress: number) {
      renderFlyCards(progress);
      renderStack(progress);

      if (rising) {
        // One sheet, on the same scroll leg as the row's rise, so the page
        // arrives *because* the visitor pulled it up — not five lines each
        // emerging from their own clip on a timer.
        const t = easeOutSettle(clamp(mapRange(TUNNEL_END, HANDOFF_END, 0, 1, progress)));
        rising.style.opacity = clamp(t * 1.6).toFixed(3);
        rising.style.transform = `translate3d(0px, ${((1 - t) * RISE_FROM * vh).toFixed(1)}px, 0)`;
      }

      if (backdrop) {
        backdrop.style.opacity = clamp(
          Math.min(progress / BACKDROP_FADE, (1 - progress) / BACKDROP_FADE),
        ).toFixed(3);
      }

      const nextPhase: HallwayPhase = progress >= HANDOFF_END ? "hero" : "tunnel";
      if (nextPhase !== phase) {
        phase = nextPhase;
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
      onRefresh: measure,
    });

    measure();
    render(0);
  }, {
    scope: containerRef,
    dependencies: [flyCount, stackCount, maxScale, perItemVh, riseToTop, disabled],
    revertOnUpdate: true,
  });
}
