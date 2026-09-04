"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useClientValue } from "@/lib/useClientValue";
import { useLiteModeToggle } from "@/lib/useLiteModeToggle";
import { shouldSuggestLiteMode, litePromptOverride } from "@/lib/motion-prefs";
import { RollingText } from "@/components/motion/RollingText";
import { siteConfig, uiCopy } from "@/site.config";
import { hasHardwareGpu } from "@/lib/gpu";

/* ------------------------------------------------------------------ *
 * Geometry + timeline, lifted verbatim from loader.html.
 *
 * Start: a row of four circles (diameter 157) on a white field. They bounce
 * in a staggered wave — that wave is the loader loop, driven as compositor
 * transforms on HTML discs (not SVG attributes). Once loading finishes,
 * the wave plays out its current cycle, then the circles spiral inward, orbit,
 * and stretch into the DevFest `> <` mark, at which point the enter CTA fades in.
 * ------------------------------------------------------------------ */

/** Set when the lite-mode prompt is dismissed (here or in the pre-hydration
 *  boot preloader in app/layout.tsx), so it doesn't re-nag within the session. */
const PROMPT_DISMISSED_KEY = "devfest-lite-prompt-dismissed";

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
  /** True once everything is ready. The bounce finishes its current loop, then hands off. */
  loadingComplete: boolean;
  /**
   * First visit of the session: play the full dots→brackets morph and the enter
   * CTA. On a refresh (already seen this session) this is false — the bounce
   * just fades out to reveal the page, no morph and no CTA.
   */
  playIntro: boolean;
  /**
   * The asset load has passed the slow threshold (see SLOW_AFTER in
   * useAssetsLoaded). Surfaces the lite-mode prompt while the visitor waits —
   * this is the measured signal; `shouldSuggestLiteMode()` is the instant one.
   */
  slowLoad: boolean;
  /** Fired when the visitor clicks the CTA — mount the flythrough behind the mask holes. */
  onEnter: () => void;
  /** Fired once the white field has fully cleared — the flythrough can start flying now. */
  onReveal: () => void;
  /** Fired on the refresh path once the bounce has faded out — release the page. */
  onDismiss: () => void;
};

/**
 * The full-screen intro. A white field (per the brand mark's own artwork),
 * portalled to <body> so it sits above the hallway and outside the hero's
 * stacking context.
 *
 * Exposed to assistive tech as a dialog rather than hidden: it holds the enter
 * CTA (which is also focused once it appears), and it locks body scroll while
 * it is up. Marking the container aria-hidden while focusing a button inside it
 * is the `aria-hidden-focus` violation — the AT is told the subtree does not
 * exist, then focus lands in it, leaving a screen-reader user with no announced
 * way forward.
 *
 * It carries no aria-modal: modality would hide sibling content from assistive
 * tech while this overlay is up.
 */
export function Loader({ loadingComplete, playIntro, slowLoad, onEnter, onReveal, onDismiss }: LoaderProps) {
  const mounted = useClientValue(() => true, false);
  const rootRef = useRef<HTMLDivElement>(null);
  const bounceRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const liteLinkRef = useRef<HTMLButtonElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const [ctaReady, setCtaReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const { setLite } = useLiteModeToggle();

  // The pre-hydration boot preloader (app/layout.tsx) shows the same prompt, and
  // if it was dismissed there this one must stay down too — otherwise the same
  // question comes straight back the moment React takes over.
  const bootPromptDismissed = useClientValue(() => {
    try {
      return sessionStorage.getItem(PROMPT_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  }, false);

  function dismissPrompt() {
    setPromptDismissed(true);
    try {
      sessionStorage.setItem(PROMPT_DISMISSED_KEY, "1");
    } catch {
      /* private mode / storage disabled — the in-memory state still holds */
    }
  }

  // A one-tap way out *before* sitting through the whole intro, when the load
  // is going to be a slog. Two signals: `slowLoad` — measured, the load has
  // actually been dragging (the reliable one) — and `shouldSuggestLiteMode()` —
  // instant, from `navigator.connection` / device specs / the ?lite-prompt
  // override. Only while the dots are still loading (first visit only); replaced
  // by the Enter CTA the moment the mark settles, never on the refresh fade.
  const suggestLite = useClientValue(shouldSuggestLiteMode, false);
  // ?lite-prompt=1/0 (dev) wins outright; otherwise either signal shows it.
  const promptOverride = useClientValue(litePromptOverride, null);
  const showLitePrompt =
    playIntro &&
    !ctaReady &&
    !promptDismissed &&
    !bootPromptDismissed &&
    (promptOverride ?? (slowLoad || suggestLite));

  // Read the latest loading state from inside the (once-only) GSAP setup
  // without listing it as a dep — flipping it must not tear down the timeline.
  const loadingRef = useRef(loadingComplete);
  useEffect(() => {
    loadingRef.current = loadingComplete;
  }, [loadingComplete]);

  // Likewise for the hand-off branch and the refresh dismiss callback, so the
  // once-only bounce loop always reads the current values.
  const playIntroRef = useRef(playIntro);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    playIntroRef.current = playIntro;
    onDismissRef.current = onDismiss;
  }, [playIntro, onDismiss]);

  useGSAP(
    () => {
      const svg = svgRef.current;
      const bounceLayer = bounceRef.current;
      if (!svg || !bounceLayer) return;
      const rects = Array.from(svg.querySelectorAll<SVGRectElement>("rect[data-dot]"));
      const balls = Array.from(bounceLayer.querySelectorAll<HTMLElement>("[data-bounce-dot]"));
      if (rects.length !== SPEC.length || balls.length !== SPEC.length) return;

      // Compositor-only bounce: yPercent on HTML discs, never SVG attributes.
      // Amplitude matches the old SVG bump (B_AMP / START_D ≈ 20% of the disc).
      // force3D (translate3d) only when a hardware GPU is compositing — on
      // software GL the extra layers cost more than they save.
      gsap.set(balls, { force3D: hasHardwareGpu(), yPercent: 0 });
      const setBounceY = balls.map((el) => gsap.quickSetter(el, "yPercent"));

      /** Circles at rest in the start row — the state the morph begins from. */
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

      /** The bounce, at wave-time t. Only the inner disc's translateY changes. */
      function renderBounce(t: number) {
        for (let i = 0; i < SPEC.length; i += 1) {
          setBounceY[i]((bounceY(i, t) / START_D) * 100);
        }
      }

      function showMarkSvg() {
        if (!bounceLayer) return;
        bounceLayer.style.visibility = "hidden";
        gsap.set(balls, { yPercent: 0, force3D: false });
        gsap.set(svg, { autoAlpha: 1 });
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
      gsap.set(svg, { autoAlpha: 0 });

      const morph = { p: 0 };
      function startMorph() {
        showMarkSvg();
        gsap.to(morph, {
          p: 1,
          duration: MORPH_DUR,
          ease: "none",
          onUpdate: () => renderMorph(morph.p),
          onComplete: () => setCtaReady(true),
        });
      }

      // Refresh path: no morph, no CTA — the dots have done their job as the
      // preloader, so the whole white field simply fades out to reveal the page.
      function dismiss() {
        const root = rootRef.current;
        if (!root) {
          onDismissRef.current();
          return;
        }
        gsap.to(root, {
          autoAlpha: 0,
          duration: 0.7,
          ease: "power2.out",
          onComplete: () => onDismissRef.current(),
        });
      }

      // The bounce loop. onRepeat fires at each cycle boundary, where every dot
      // is at rest — the only clean moment to hand off. So the wave always plays
      // out its current cycle before it either morphs (first visit) or fades.
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
          if (playIntroRef.current) startMorph();
          else dismiss();
        },
      });
    },
    { scope: rootRef },
  );

  // Reveal the CTA (and the lite-mode link beside it) once the mark has
  // settled — same fade, same moment, so the secondary link never appears
  // before the primary action does.
  useGSAP(
    () => {
      if (!ctaReady || !ctaRef.current) return;
      const targets = [ctaRef.current, liteLinkRef.current].filter((el): el is HTMLButtonElement => el !== null);
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" },
      );
      ctaRef.current.focus({ preventScroll: true });
    },
    { scope: rootRef, dependencies: [ctaReady] },
  );

  // Ease the lite prompt in when it appears. It has no fade-out — when
  // `showLitePrompt` flips false the node unmounts and the Enter CTA fading in
  // over the same spot covers the swap.
  useGSAP(
    () => {
      if (!showLitePrompt || !promptRef.current) return;
      gsap.fromTo(
        promptRef.current,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" },
      );
    },
    { scope: rootRef, dependencies: [showLitePrompt] },
  );

  /*
   * Skips the intro entirely rather than playing `handleEnter`'s zoom/portal
   * reveal — the whole point of choosing lite here is to not sit through the
   * full-mode entrance. `onDismiss()` (== HeroSection's `releaseIntro`) is
   * reused for its cleanup, not its "refresh, no morph" meaning: it undoes
   * exactly the two things the layout-effect lock in HeroSection sets and
   * never cleans up on its own (`document.body.style.overflow`, `#main`'s
   * `aria-busy`) — without it the page would stay scroll-locked underneath
   * the fresh static-baseline mount `setLite(true)` triggers.
   */
  function handleSwitchToLite() {
    onDismiss();
    setLite(true);
  }

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
      role="dialog"
      aria-label={`${siteConfig.name}${uiCopy.loader.introAriaSuffix}`}
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-2 bg-white"
      style={{ contain: "paint" }}
    >
      {/*
       * The only announced loading state. The dots are a decorative rendering
       * of the same thing, so they stay hidden from AT; this line is what a
       * screen reader actually hears, and it changes once the CTA is focusable.
       */}
      <p role="status" aria-live="polite" className="sr-only">
        {ctaReady
          ? uiCopy.loader.readyStatus
          : `${uiCopy.loader.loadingStatusPrefix}${siteConfig.name}${uiCopy.loader.loadingStatusSuffix}`}
      </p>

      <div className="relative w-[min(82vw,720px)]" style={{ aspectRatio: "1728 / 535" }}>
        {/*
         * Bounce lives on HTML discs so GSAP only writes compositor transforms
         * (yPercent). The SVG stays hidden until the morph, which still needs
         * rounded-rect geometry the discs cannot do.
         */}
        <div ref={bounceRef} aria-hidden="true" className="absolute inset-0">
          {SPEC.map((s) => (
            <div
              key={s.key}
              className="absolute aspect-square"
              style={{
                left: `${(s.sx / 1728) * 100}%`,
                top: `${((SY - 250) / 535) * 100}%`,
                width: `${(START_D / 1728) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div
                data-bounce-dot
                className="h-full w-full rounded-full"
                style={{ background: s.colorVar, willChange: "transform" }}
              />
            </div>
          ))}
        </div>
        <svg
          ref={svgRef}
          aria-hidden="true"
          viewBox="0 250 1728 535"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0 block h-full w-full"
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
      </div>

      {/* Bottom-anchored stack, absolutely positioned so nothing here shifts the
          dots/mark off centre:
           • the viewport hint — pinned to `bottom:1.5rem` to match the
             first-paint #boot-preloader's own hint (app/layout.tsx), so it
             doesn't jump position on hand-off from that to this;
           • above it, while still loading, the slow-connection / low-power
             lite-mode prompt. Stacked so toggling the prompt never moves the
             hint. */}
      <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4">
        {showLitePrompt && (
          <div
            ref={promptRef}
            role="group"
            aria-label={uiCopy.loader.litePromptBody}
            style={{ visibility: "hidden" }}
            className="flex w-fit max-w-[min(88vw,340px)] flex-col items-center gap-2 rounded-2xl border border-ink/20 bg-white px-4 py-3 text-center"
          >
            <p className="text-sm text-ink/80">{uiCopy.loader.litePromptBody}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={handleSwitchToLite}
                className="font-sans text-xs font-semibold uppercase tracking-wider text-ink underline-offset-4 hover:underline"
              >
                {uiCopy.loader.litePromptAcceptLabel}
              </button>
              <button
                type="button"
                onClick={dismissPrompt}
                className="font-sans text-xs font-medium uppercase tracking-wider text-ink/60 underline-offset-4 hover:underline"
              >
                {uiCopy.loader.litePromptDismissLabel}
              </button>
            </div>
          </div>
        )}
        <p className="font-mono text-xs uppercase tracking-wider text-ink/50 lg:hidden">
          {uiCopy.loader.desktopHint}
        </p>
      </div>

      <button
        ref={ctaRef}
        type="button"
        onClick={handleEnter}
        style={{ visibility: "hidden" }}
        /*
         * No `outline-none` here: this is the intro's only control, and the
         * ring it used to substitute (ink at 40%) measures 2.85:1 on the white
         * field — under the 3:1 WCAG 1.4.11 needs for a focus indicator. The
         * global `:focus-visible` outline it was overriding is --blue, which is
         * 3.56:1 on white and passes, so the fix is to stop overriding it.
         */
        className="rounded-full px-3 py-1 text-2xl text-ink disabled:opacity-40 sm:text-3xl"
        disabled={entered}
      >
        <RollingText>{uiCopy.loader.enterCtaLabel}</RollingText>
      </button>

      {/* A little below the Enter CTA — its own escape hatch out of the full
          intro, for a visitor who'd rather not sit through it. Styled as a
          plain link (not a GlowButton or Button), since ink-on-white here is
          the enter CTA's own high-contrast idiom, not the site's glass/neon
          one that only reads on the dark backdrops everywhere else. */}
      <button
        ref={liteLinkRef}
        type="button"
        onClick={handleSwitchToLite}
        style={{ visibility: "hidden" }}
        className="mt-2 font-sans text-xs font-semibold uppercase tracking-wider text-ink underline-offset-4 hover:underline"
        disabled={entered}
      >
        {uiCopy.loader.switchToLiteLabel}
      </button>
    </div>,
    document.body,
  );
}
