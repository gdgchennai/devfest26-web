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
 * How far into its life the nearest photo already is at progress 0 — in effect,
 * how far inside the corridor the camera already stands when the curtain lifts.
 *
 * Without it the camera sits exactly where the first card begins to exist, so
 * the tunnel opens on an empty frame. At 0.35 it opened on two small photos
 * floating near the middle, which read as *looking at* a corridor rather than
 * *being in* one. At 0.55 the nearest is ~29vw wide and 25vw off-centre with
 * two more receding behind it. Higher again (0.65) opens on a 40vw card already
 * half out of frame, which is too close to establish the space.
 */
const PRIMED = 0.55;

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
const STACK_VISIBLE_BY = 0.22;
const STACK_MIN_OPACITY = 0.55;

/**
 * Atmospheric haze over the destination, lifting as the camera closes on it.
 *
 * This is NOT a second darkener — a group at opacity α over the ink backdrop
 * already composites to exactly what an ink veil at 1−α would give. It exists
 * to *separate* the two things opacity was conflating: how solid the stack is,
 * and how far back it reads. The group now firms up early (see the constants
 * above) so it is a real object rather than a see-through smear, and the haze
 * carries the recession instead — which also lets it be tinted. Distance in
 * air shifts things cooler, not merely fainter, and opacity cannot do that.
 */
export const HALLWAY_HAZE_CLASS = "hallway-haze";
const HAZE_MAX = 0.84;
/**
 * Haze the destination keeps even at the mouth of the tunnel. It should not
 * arrive at full brightness while it is still the far end of a corridor — a
 * distant thing that becomes perfectly clear stops reading as distant. Cleared
 * only across the spread, once it stops being a destination and becomes the
 * hero's picture row.
 */
const HAZE_MIN = 0.12;
/**
 * Exponent on (1 − approach). **Below 1 holds the haze longer; above 1 clears
 * it faster** — the opposite of what reads intuitively, because (1−a) is itself
 * less than 1, so raising the power shrinks it.
 *
 * Tuned against how busy the corridor is, not by feel: it stays at four photos
 * until roughly 0.5 and only drains over 0.55→0.72. At 1.5 the haze was down to
 * 0.10 by 0.55 — the destination back to 90% brightness while three photos were
 * still competing for attention. At 0.5 it is 0.41 there and clears as the
 * corridor empties.
 */
const HAZE_FALLOFF = 0.5;

/** Fraction of the container the spread row spans, and the gap between cards. */
const ROW_SPAN = 0.92;
const ROW_GAP = 1.06;
/** How far up the row travels, as a fraction of viewport height. */
const ROW_RISE = -0.3;

/**
 * Where the photos hang. Both layouts are the same construction — a direction
 * on a ring around the tunnel axis — differing only in how the angles are
 * distributed, so switching is this one constant and nothing else.
 *
 * `walls` clusters them left and right; `tube` spreads them evenly all round.
 * A tube needs roughly twice as many photos alive at once to read as *lined*
 * rather than *scattered* (~18 hallway photos vs the 10 that populate two
 * walls comfortably), so it wants the archive to grow first.
 */
type CorridorLayout = "walls" | "tube";
const CORRIDOR_LAYOUT: CorridorLayout = "walls";

/**
 * Clear channel down the middle, as a fraction of the half-viewport, before
 * any outward drift. Without this every card is born at the vanishing point —
 * which is exactly where the destination sits, so the newest photo covered it
 * at every single moment of the tunnel. Elliptical because the stack is 3:2.
 */
const CORRIDOR_X = 0.14;
const CORRIDOR_Y = 0.1;

/**
 * Aspect of `.hallway-stack` — kept in step with the `aspect-ratio` on that
 * class in globals.css, so the birth radius below can clear the destination
 * vertically as well as horizontally.
 */
const STACK_ASPECT = 1.5;
/** Scales the outward drift, since placements are now unit vectors. */
const SPREAD = 0.6;

/**
 * How much nearer than the destination a photo must appear when it is born.
 *
 * The stack is the far end of the tunnel, so nothing may enter from beyond it —
 * but its size came from `bloom`, a curve with no depth in it, while the cards
 * come from a real depth model. Two coordinate systems, so nothing enforced the
 * ordering: measured, cards #7, #8 and #9 were each born *smaller* than the
 * stack, i.e. behind the thing at the end of the corridor.
 *
 * Rather than rebuild the depth model, floor a card's size at the destination's
 * current size. That is also the honest physical story — as the camera closes on
 * the end wall there is less runway ahead, so later photos have no choice but to
 * appear nearer.
 */
const SPAWN_CLEARANCE = 1;

/**
 * Fraction of a photo's life spent resolving as it emerges, and the shorter
 * fraction spent fading as it passes.
 *
 * A photo is born at the far end, which is the hazed end — so it should come
 * out of that atmosphere at the same rate the destination clears, not snap in.
 * Its own fade-in *is* its dehazing, which is why lengthening this reads as
 * emerging from the haze rather than appearing in front of it. The exit stays
 * short: it is rushing past a camera, not receding.
 */
const EMERGE = 0.34;
const DEPART = 0.16;

/**
 * Tilt toward the corridor axis, in degrees, so photos read as hung on walls
 * being passed rather than as flat cards flying at the lens. Sharpens across a
 * card's life as the viewing angle grows more oblique.
 *
 * Signs are not symmetric, and the derivation is worth keeping: rotateY(θ)
 * takes a front normal (0,0,1) to (sinθ,0,cosθ), so θ>0 faces *right* — a card
 * on the right wall has to face left, hence the negation on Y. rotateX(θ)
 * takes it to (0,−sinθ,cosθ), so θ>0 faces *up*, which is already what a card
 * below the axis wants. Only Y is negated.
 */
const TILT_Y = 34;
const TILT_X = 22;

/** Card widths in vw, cycled. Varied sizes are what read as depth — see note in the hook. */
const WIDTHS = [30, 38, 26, 44, 32, 24, 36, 28, 42, 27, 34, 23];

/**
 * Unit direction from the tunnel axis for card `index`, plus a per-card radius
 * wobble so the wall does not read as a ruled line.
 */
function corridorPlacement(index: number, layout: CorridorLayout) {
  const radius = 0.86 + 0.28 * ((index * 0.382) % 1);
  if (layout === "tube") {
    // Golden angle: spreads points evenly round the ring without clumping.
    const angle = index * 137.508 * (Math.PI / 180);
    return { ux: Math.cos(angle) * radius, uy: Math.sin(angle) * radius };
  }
  // Alternate walls, and scatter up and down each one so the two sides do not
  // read as two neat rows of pictures.
  const side = index % 2 === 0 ? -1 : 1;
  const jitter = ((index * 0.618) % 1) * 2 - 1;
  return { ux: side * radius, uy: jitter * 0.55 * radius };
}

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

/**
 * Last point in a card's life where it is still meaningfully visible — beyond
 * this the fade-out has it under half opacity. Lower it to trade sharpness at
 * the very peak for bytes; see cardSizes().
 */
const PEAK_VISIBLE_P = 0.92;

/**
 * The `sizes` attribute for a flying photo.
 *
 * A card's CSS width is only its width at scale 1; the transform blows it up to
 * ~2.7x while it is still fully opaque, so a 44vw card covers ~118vw of screen.
 * Declaring the base width made the browser fetch a copy 2.6x too small and
 * upscale it — softest exactly when the photo is biggest and most looked at.
 * Viewport-relative, so this costs desktop bandwidth and barely touches mobile.
 */
export function cardSizes(index: number, maxScale: number): string {
  const peak = 0.15 + (maxScale - 0.15) * easeInAccelerating(PEAK_VISIBLE_P);
  return `${Math.min(100, Math.round(cardWidthVw(index) * peak))}vw`;
}

/**
 * Wrapper holding only the flying photos. Carries the `perspective` that makes
 * their tilt read as 3D — kept off the backdrop, beacon and stack, which must
 * stay square to the viewer.
 */
export const HALLWAY_CORRIDOR_CLASS = "hallway-corridor";
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
  /**
   * Play the fly-through on its own clock instead of scrubbing it with scroll —
   * no pin, no ScrollTrigger. Used by the homepage intro, which auto-plays the
   * flythrough as a fixed overlay (no scrolling), then hands off to the hero.
   */
  autoplay?: boolean;
  /** Seconds the autoplay run takes (ignored unless `autoplay`). */
  autoplayDuration?: number;
  /**
   * Progress value the autoplay run stops at (default 1). The homepage stops
   * early (~0.8): the flying photos have all passed by ~0.72, so the remaining
   * scroll budget is an empty tail — ending there lets the hero fill the space
   * with no dead gap.
   */
  autoplayTo?: number;
  /** Per-frame progress (0→1) during autoplay, for syncing an external element. */
  onAutoplayProgress?: (p: number) => void;
  /** Fires once the autoplay run reaches the end. */
  onAutoplayComplete?: () => void;
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
  autoplay = false,
  autoplayDuration = 4,
  autoplayTo = 1,
  onAutoplayProgress,
  onAutoplayComplete,
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
    const haze = container.querySelector<HTMLElement>(`.${HALLWAY_HAZE_CLASS}`);
    const rising = container.querySelector<HTMLElement>(`.${HALLWAY_RISE_CLASS}`);
    if (flyCards.length === 0 && stackCards.length === 0) return;

    const flyPlacements = Array.from({ length: flyCount }, (_, i) =>
      corridorPlacement(i, CORRIDOR_LAYOUT),
    );
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
    /** Cached at refresh — reading offsetWidth per frame would thrash layout. */
    let groupWidthPx = 0;

    function measure() {
      vw = window.innerWidth;
      vh = window.innerHeight;
      const n = stackCards.length;
      groupWidthPx = stackGroup?.offsetWidth ?? 0;
      const containerWidth = container.offsetWidth || vw;
      rowScale = n > 0 && groupWidthPx > 0
        ? Math.min(1, (ROW_SPAN * containerWidth) / (n * ROW_GAP * groupWidthPx))
        : 1;
    }

    /** On-screen width of the destination right now, in px. */
    function stackWidthNow(progress: number) {
      if (!stackGroup) return 0;
      const approach = clamp(mapRange(0, TUNNEL_END, 0, 1, progress));
      const bloom = Math.pow(approach, STACK_APPROACH);
      const spread = easeOutSettle(clamp(mapRange(TUNNEL_END, HANDOFF_END, 0, 1, progress)));
      return (
        groupWidthPx *
        gsap.utils.interpolate(STACK_FAR_SCALE, 1, bloom) *
        gsap.utils.interpolate(1, rowScale, spread)
      );
    }

    function renderFlyCards(progress: number) {
      const travelled = clamp(mapRange(0, TUNNEL_END, 0, 1, progress));
      const cam = gsap.utils.interpolate(camStart, camEnd, travelled);
      /*
       * The destination is the corridor's vanishing point, so photos are born
       * *at its edge, at its size* — same size reading as same depth, sitting
       * on the far wall beside it rather than materialising somewhere in front.
       *
       * Both the birth radius and the birth size therefore track the stack: it
       * is a speck early, so photos emerge from close to the centre point; it
       * is large later, so they peel off its edges. A fixed corridor width and
       * a fixed birth size were two constants that merely happened not to
       * collide, which is why a photo still read as coming from behind it.
       *
       * They are born *beside* rather than *behind* deliberately. Emerging from
       * behind would be the truer image, but it needs per-card depth sorting
       * across the stack, and `.hallway-corridor` is one stacking context above
       * it — splitting that would mean re-parenting cards mid-flight.
       */
      const stackPx = stackWidthNow(progress);
      const minPx = stackPx * SPAWN_CLEARANCE;
      // Centre-to-centre clearance is half the stack plus half the card, and at
      // birth the card matches the stack — so one full stack dimension.
      const birthRx = Math.max(CORRIDOR_X, stackPx / (vw * 0.5));
      const birthRy = Math.max(CORRIDOR_Y, stackPx / STACK_ASPECT / (vh * 0.5));

      for (let i = 0; i < flyCards.length; i += 1) {
        const el = flyCards[i];
        const { ux, uy } = flyPlacements[i];
        // p runs 0 -> 1 across this card's whole life, from fade-in to gone.
        const p = (cam - depths[i] + APPROACH) / (APPROACH + PASS);

        if (p <= 0 || p >= 1) {
          // Off camera: write opacity once and skip the rest of the work.
          if (el.style.opacity !== "0") el.style.opacity = "0";
          continue;
        }

        // Floored so this photo can never appear farther away than the
        // destination. The floor rises with the stack, so late arrivals enter
        // nearer — which is what a shortening runway actually looks like.
        const cardWidthPx = (cardWidthVw(i) / 100) * vw;
        const floor = cardWidthPx > 0 ? minPx / cardWidthPx : 0;
        const scale = Math.max(floor, 0.15 + (maxScale - 0.15) * easeInAccelerating(p));
        // Hug the wall, then accelerate outward — a linear drift makes cards
        // look like they are sliding rather than passing the camera. The
        // corridor term is the floor that keeps the middle clear.
        const drift = Math.pow(p, 1.4) * scale * SPREAD;
        const dx = ux * (birthRx + drift) * vw * 0.5;
        const dy = uy * (birthRy + drift) * vh * 0.5;
        // Turn to face the axis, more sharply as the angle grows oblique.
        const tilt = 0.6 + 0.4 * p;
        const ry = -ux * TILT_Y * tilt;
        const rx = uy * TILT_X * tilt;

        // Direct style writes rather than gsap.set(): this runs for every card
        // every frame, and gsap.set re-parses unit strings and walks its
        // property pipeline each time.
        el.style.opacity = clamp(Math.min(p / EMERGE, (1 - p) / DEPART)).toFixed(3);
        el.style.transform =
          `translate(-50%, -50%) translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) ` +
          `rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        // Nearer cards paint over farther ones, by depth rather than by index.
        // Only orders cards against each other — ranking the corridor as a
        // whole against the stack is `.hallway-corridor`'s z-index, since
        // perspective seals these values inside that wrapper.
        el.style.zIndex = String(Math.round(p * 1000));
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

      if (haze) {
        // Driven off the same `approach` as everything else here, so it cannot
        // drift out of step with the stack it sits on. Never reaches zero
        // during the tunnel — only the spread clears the residue, at the point
        // the stack stops being a destination and becomes the picture row.
        const atmospheric =
          HAZE_MIN + (HAZE_MAX - HAZE_MIN) * Math.pow(1 - approach, HAZE_FALLOFF);
        haze.style.opacity = (atmospheric * (1 - spread)).toFixed(3);
      }

      if (beacon) {
        // Kept, and the haze is *why*. With the haze holding the destination at
        // 0.09–0.29 brightness through the first fifth, an unlit speck at 7%
        // scale would be invisible against the ink — losing the whole point of
        // being able to see how far is left. Strengthening the haze made this
        // more necessary, not less. Their windows barely overlap: the glow has
        // done its work by ~0.3, which is where the stack is finally big enough
        // to read on its own.
        //
        // It has to be brightest while the stack is *smallest*. Driving it off
        // `bloom` did the exact opposite — it peaked around the halfway mark,
        // by which point the stack needed no help, and sat at 1% when it did.
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

    const proxy = { p: 0 };

    // Autoplay: run the fly-through on its own clock as an overlay. No pin, no
    // ScrollTrigger — nothing scrolls. The homepage intro uses this and syncs a
    // hero zoom-in off onAutoplayProgress.
    if (autoplay) {
      measure();
      render(0);
      gsap.to(proxy, {
        p: autoplayTo,
        duration: autoplayDuration,
        ease: "none",
        onUpdate: () => {
          render(proxy.p);
          onAutoplayProgress?.(proxy.p);
        },
        onComplete: () => onAutoplayComplete?.(),
      });
      return;
    }

    // Scroll-scrubbed (the /memories path). A scrubbed ScrollTrigger only
    // interpolates smoothly when it drives an ANIMATION — rendering straight
    // from onUpdate(self.progress) steps with each wheel notch. So scrub a
    // one-unit proxy tween and render from its smoothed playhead instead.
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
    dependencies: [flyCount, stackCount, maxScale, perItemVh, riseToTop, disabled, autoplay, autoplayDuration, autoplayTo],
    revertOnUpdate: true,
  });
}
