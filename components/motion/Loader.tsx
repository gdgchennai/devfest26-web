"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useClientValue } from "@/lib/useClientValue";
import { RollingText } from "@/components/motion/RollingText";

/* ------------------------------------------------------------------ *
 * Geometry + timeline, lifted verbatim from loader.html.
 *
 * Start: a row of four circles (diameter 157) on a white field. They bounce
 * in a staggered wave — that wave is the loader loop. Once loading finishes,
 * the wave plays out its current cycle, then the circles spiral inward, orbit,
 * and stretch into the DevFest `> <` mark, at which point the enter CTA fades in.
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
/** smootherstep — flat velocity at both ends, so nothing snaps. */
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

const SY = 516.5;
const START_D = 157;
const END_W = 302.5;
const END_H = 130.6;
const C = { x: 863.55, y: 517.4 }; // centre of the final mark

type DotSpec = {
  key: string;
  colorVar: string;
  sx: number; // start-row x
  ex: number; // final-mark x
  ey: number; // final-mark y
  rot: number; // final tilt (deg)
  slot: number; // extra orbit angle (deg) placing dots on a square grid mid-flight
  stagger: number; // entrance / bounce order, left → right
};

// Paint order = z-order (bottom → top): red behind blue, green above yellow.
const SPEC: DotSpec[] = [
  { key: "red", colorVar: "var(--red)", sx: 714.5, ex: 695.0, ey: 467.3, rot: -35.7, slot: 28.45, stagger: 1 },
  { key: "blue", colorVar: "var(--blue)", sx: 415.5, ex: 695.0, ey: 567.5, rot: 35.7, slot: -28.45, stagger: 0 },
  { key: "yellow", colorVar: "var(--yellow)", sx: 1013.5, ex: 1032.1, ey: 567.5, rot: -35.7, slot: -61.55, stagger: 2 },
  { key: "green", colorVar: "var(--green)", sx: 1312.5, ex: 1032.1, ey: 467.3, rot: 35.7, slot: 61.55, stagger: 3 },
];

// Precomputed polar placement of each dot on the orbit ring around C.
const GEO = SPEC.map((s) => {
  const dx = s.ex - C.x;
  const dy = s.ey - C.y;
  return { baseA: Math.atan2(dy, dx), R: Math.hypot(dx, dy), slotDelta: (s.slot * Math.PI) / 180 };
});

// Morph window (loader.html T0 → END). Driven linearly; the smoother inside
// shapes the actual velocity.
const MORPH_DUR = 2.6;
const TURNS = 2;

// Staggered bounce wave, in wave-time units.
const B_AMP = 32;
const B_START = 0.5;
const B_DUR = 0.78;
const B_STAG = 0.12;
const WAVE_END = 1.64; // point at which every dot is back at rest
const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : (1 - Math.cos(TAU * u)) / 2);
const bounceY = (i: number, t: number) =>
  -B_AMP * bump((t - (B_START + SPEC[i].stagger * B_STAG)) / B_DUR);

// The final mark rectangles (in the SVG's viewBox space), used to punch the
// mark's shape out of the white field on enter — turning the logo into a
// transparent window onto whatever is behind it.
const MARK_RECTS = SPEC.map((s) => ({
  cx: s.ex,
  cy: s.ey,
  w: END_W,
  h: END_H,
  rot: s.rot,
  rx: Math.min(END_W, END_H) / 2,
}));

/**
 * A CSS mask (`url(...)`) that is opaque white everywhere except the mark's
 * shapes, which are cut to transparent — so applying it to the white field
 * leaves mark-shaped holes aligned exactly over the on-screen logo (`rect` is
 * the live bounding box of the mark <svg>; viewBox is "0 250 1728 535").
 */
function buildHoleMask(rect: DOMRect, vw: number, vh: number): string {
  const k = rect.width / 1728;
  const holes = MARK_RECTS.map((r) => {
    const cx = rect.left + (r.cx / 1728) * rect.width;
    const cy = rect.top + ((r.cy - 250) / 535) * rect.height;
    const w = r.w * k;
    const h = r.h * k;
    return `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(r.rx * k).toFixed(1)}" fill="black" transform="rotate(${r.rot} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}"><defs><mask id="h"><rect width="${vw}" height="${vh}" fill="white"/>${holes}</mask></defs><rect width="${vw}" height="${vh}" fill="white" mask="url(#h)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

type LoaderProps = {
  /** True once the hero assets have decoded. The bounce finishes its current loop, then morphs. */
  loadingComplete: boolean;
  /** Fired when the visitor clicks the CTA — mount the flythrough behind the mask holes. */
  onEnter: () => void;
  /** Fired once the white field has fully cleared — the flythrough can start flying now. */
  onReveal: () => void;
};

/**
 * The full-screen intro. A white field (per the brand mark's own artwork),
 * portalled to <body> so it sits above the hallway and outside the hero's
 * stacking context. aria-hidden — the loading announcement and any skip live
 * on the page beneath it.
 */
export function Loader({ loadingComplete, onEnter, onReveal }: LoaderProps) {
  const mounted = useClientValue(() => true, false);
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [ctaReady, setCtaReady] = useState(false);
  const [entered, setEntered] = useState(false);

  // Read the latest loading state from inside the (once-only) GSAP setup
  // without listing it as a dep — flipping it must not tear down the timeline.
  const loadingRef = useRef(loadingComplete);
  useEffect(() => {
    loadingRef.current = loadingComplete;
  }, [loadingComplete]);

  useGSAP(
    () => {
      const svg = svgRef.current;
      if (!svg) return;
      const rects = Array.from(svg.querySelectorAll<SVGRectElement>("rect[data-dot]"));
      if (rects.length !== SPEC.length) return;

      /** Circles at rest in the start row — the state both the bounce and the morph begin from. */
      function layoutRow() {
        rects.forEach((el, i) => {
          const cx = SPEC[i].sx;
          el.setAttribute("x", String(cx - START_D / 2));
          el.setAttribute("y", String(SY - START_D / 2));
          el.setAttribute("width", String(START_D));
          el.setAttribute("height", String(START_D));
          el.setAttribute("rx", String(START_D / 2));
          el.setAttribute("transform", "translate(0 0)");
          el.style.strokeOpacity = "0";
        });
      }

      /** The bounce, at wave-time t. Only the vertical translate changes. */
      function renderBounce(t: number) {
        rects.forEach((el, i) => {
          el.setAttribute("transform", `translate(0 ${bounceY(i, t).toFixed(2)})`);
        });
      }

      /** loader.html's render(), for the spiral → orbit → morph window (t: 0 → 1). */
      function renderMorph(p: number) {
        const spin = -TURNS * TAU * smoother(p);
        const radIn = smoother(clamp(p / 0.28, 0, 1));
        const arr = smoother(clamp((p - 0.6) / 0.4, 0, 1));
        const strk = smoother(clamp((p - 0.66) / 0.34, 0, 1));

        rects.forEach((el, i) => {
          const s = SPEC[i];
          const g = GEO[i];
          const w = lerp(START_D, END_W, arr);
          const h = lerp(START_D, END_H, arr);
          const rot = s.rot * arr;
          const ang = g.baseA + g.slotDelta * (1 - arr) + spin;
          const rx = C.x + g.R * Math.cos(ang);
          const ry = C.y + g.R * Math.sin(ang);
          const cx = lerp(s.sx, rx, radIn);
          const cy = lerp(SY, ry, radIn);
          el.setAttribute("x", String(cx - w / 2));
          el.setAttribute("y", String(cy - h / 2));
          el.setAttribute("width", String(w));
          el.setAttribute("height", String(h));
          el.setAttribute("rx", String(Math.min(w, h) / 2));
          el.setAttribute("transform", `rotate(${rot} ${cx} ${cy})`);
          el.style.strokeOpacity = String(strk);
        });
      }

      layoutRow();

      // Dots fade in, staggered, while the bounce is already running.
      gsap.set(rects, { opacity: 0 });
      gsap.to(rects, { opacity: 1, duration: 0.4, stagger: 0.08, ease: "power2.out" });

      const morph = { p: 0 };
      function startMorph() {
        gsap.to(morph, {
          p: 1,
          duration: MORPH_DUR,
          ease: "none",
          onUpdate: () => renderMorph(morph.p),
          onComplete: () => setCtaReady(true),
        });
      }

      // The bounce loop. onRepeat fires at each cycle boundary, where every
      // dot is at rest — the only clean moment to hand off to the morph. So the
      // wave always plays out its current cycle before the mark forms.
      const wave = { t: B_START };
      const bounce = gsap.to(wave, {
        t: WAVE_END,
        duration: 0.95,
        ease: "none",
        repeat: -1,
        repeatDelay: 0.3,
        onUpdate: () => renderBounce(wave.t),
        onRepeat: () => {
          if (!loadingRef.current) return;
          bounce.kill();
          layoutRow();
          startMorph();
        },
      });
    },
    { scope: rootRef },
  );

  // Reveal the CTA once the mark has settled.
  useGSAP(
    () => {
      if (!ctaReady || !ctaRef.current) return;
      gsap.fromTo(
        ctaRef.current,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" },
      );
      ctaRef.current.focus({ preventScroll: true });
    },
    { scope: rootRef, dependencies: [ctaReady] },
  );

  const handleEnter = () => {
    if (entered) return;
    setEntered(true);
    onEnter();

    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    // 1. The button disappears.
    if (ctaRef.current) gsap.to(ctaRef.current, { autoAlpha: 0, duration: 0.3, ease: "power1.out" });

    // 2. The mark becomes a transparent mask: punch its shape out of the white
    // field so the flythrough (mounted behind on enter) shows through it, and
    // fade the coloured logo away since it *is* the holes now.
    const mask = buildHoleMask(svg.getBoundingClientRect(), window.innerWidth, window.innerHeight);
    root.style.transformOrigin = "50% 50%";
    root.style.maskImage = mask;
    root.style.setProperty("-webkit-mask-image", mask);
    root.style.maskRepeat = "no-repeat";
    root.style.setProperty("-webkit-mask-repeat", "no-repeat");
    root.style.maskSize = "100% 100%";
    root.style.setProperty("-webkit-mask-size", "100% 100%");
    gsap.to(svg, { autoAlpha: 0, duration: 0.4, ease: "power1.out" });

    // 3. Slow pull-zoom into the mark. The white holds through the zoom, then
    // fades once we're deep in — revealing the flythrough section beneath. Only
    // once the white has fully cleared does the flythrough start flying.
    gsap
      .timeline({ onComplete: onReveal })
      .to(root, { scale: 8, duration: 2.2, ease: "power2.in" }, 0)
      .to(root, { autoAlpha: 0, duration: 0.6, ease: "power1.out" }, 1.6);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      ref={rootRef}
      aria-hidden="true"
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-2 bg-white will-change-transform"
    >
      <svg
        ref={svgRef}
        viewBox="0 250 1728 535"
        xmlns="http://www.w3.org/2000/svg"
        className="block h-auto w-[min(82vw,720px)]"
      >
        {SPEC.map((s) => (
          <rect
            key={s.key}
            data-dot={s.key}
            fill={s.colorVar}
            stroke="var(--ink)"
            strokeWidth={5}
            style={{ strokeOpacity: 0 }}
          />
        ))}
      </svg>

      <button
        ref={ctaRef}
        type="button"
        onClick={handleEnter}
        style={{ visibility: "hidden" }}
        className="rounded-full px-3 py-1 text-lg text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:opacity-40 sm:text-xl"
        disabled={entered}
      >
        <RollingText>Enter the DevFest experience →</RollingText>
      </button>
    </div>,
    document.body,
  );
}
