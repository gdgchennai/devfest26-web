"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { SplitText } from "gsap/SplitText";
import { siteConfig } from "@/site.config";
import { EVENT_TIME_ZONE } from "@/lib/format";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { ParticleCover } from "@/components/motion/ParticleCover";
import { useMotion } from "@/components/motion/MotionProvider";
import { RollingText } from "@/components/motion/RollingText";
import { GlowButton } from "@/components/GlowButton";

gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin, SplitText);

/** The line-art's own viewBox ratio (see public/venue-lines.svg) — the photo
 *  is cropped to the same ratio so the two stay pixel-aligned, and the stage
 *  itself is sized close to it (see the JSX) rather than a full viewport. */
const ART_RATIO = 1773 / 1167;
/** Vertical crop bias when the stage is wider/shorter than ART_RATIO: only
 *  this fraction of the overflow comes off the top, protecting the roofline
 *  (the rest comes off the bottom — plain roadway). */
const TOP_CROP_BIAS = 0.15;

/** The pin's three held phases, in %-of-viewport scroll distance each
 *  consumes — HOLD (dead zone), SWAP ("Location" ⇄ "Save the Date"), then
 *  OVERLAY (the black panel's rise). Module-level (not effect-local)
 *  because the brackets-fade ScrollTrigger needs TOTAL_VH too, and it's
 *  created before the pin itself — see its own `end` for why. */
const HOLD_VH = 20;
const SWAP_VH = 35;
const OVERLAY_VH = 70;
const TOTAL_VH = HOLD_VH + SWAP_VH + OVERLAY_VH;

/** The neon-glow wash, off and at full brightness — a plain colour (not a
 *  filter) blended over the PHOTO now, not the sketch. It used to be a
 *  drop-shadow filter on the sketch itself, which meant re-rasterizing and
 *  blurring 2203 path segments across 49 <path>s every animated frame —
 *  profiled at 100–167ms/frame (should be ~16ms). A photo is one bitmap
 *  layer; blending a flat colour over it via mix-blend-mode is a
 *  compositor-only operation regardless of how "glowy" it looks, so this
 *  reads the same to the eye at a fraction of the cost. Whitish-blue to
 *  match --blue-pastel, the page's own settled colour. */
const GLOW_COLOR = "rgba(200,235,255,1)";

const dateShort = siteConfig.date
  ? new Date(siteConfig.date).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: EVENT_TIME_ZONE,
    })
  : null;

/** Resolves a `var(...)` (or any CSS colour expression) to the concrete
 *  colour the browser would paint it as, via a throwaway probe element —
 *  GSAP can only tween between concrete colours, not raw custom-property
 *  references. */
function resolveColor(expr: string): string {
  const probe = document.createElement("span");
  probe.style.color = expr;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return resolved;
}

/** Tracks the text each element is currently showing or animating toward, so
 *  a duplicate call (e.g. a ScrollTrigger onEnter firing twice in quick
 *  succession — observed in practice, root cause not pinned down, but two
 *  concurrent SplitText instances fighting over the same element's children
 *  is exactly the kind of thing that leaves a swap stuck mid-transition)
 *  is a safe no-op instead of corrupting the in-flight animation. */
const swapTargets = new WeakMap<HTMLElement, string>();

/** Swaps `el`'s text with a rise-out/rise-in SplitText cut, matching the
 *  reveal beat "About DevFest" uses elsewhere on the homepage. `direction`
 *  is which way the roll reads: 1 (the default — forward, i.e. scrolling
 *  down into "Save the Date") exits upward and enters from below, same as
 *  before; -1 (reverse, i.e. scrolling back up into "Location") mirrors
 *  that — exits downward, enters from above — so the text visibly rolls
 *  the OPPOSITE way when you reverse, instead of replaying the same upward
 *  roll regardless of which way the scroll that triggered it went. */
function swapText(el: HTMLElement, newText: string, direction: 1 | -1 = 1) {
  if (swapTargets.get(el) === newText) return;
  swapTargets.set(el, newText);
  // Belt-and-braces: kill any tweens still running on this element's current
  // children before splitting it again, so a genuinely-overlapping call
  // (different target text arriving mid-swap) can't leave two SplitText
  // instances animating the same DOM nodes at once.
  gsap.killTweensOf(el.querySelectorAll("*"));

  const outSplit = SplitText.create(el, { type: "chars", mask: "chars" });
  gsap.to(outSplit.chars, {
    yPercent: -130 * direction,
    opacity: 0,
    duration: 0.4,
    stagger: 0.015,
    ease: "power2.in",
    onComplete: () => {
      outSplit.revert();
      el.textContent = newText;
      const inSplit = SplitText.create(el, { type: "chars", mask: "chars" });
      gsap.set(inSplit.chars, { yPercent: 130 * direction, opacity: 0 });
      gsap.to(inSplit.chars, { yPercent: 0, opacity: 1, duration: 0.5, stagger: 0.02, ease: "power3.out" });
    },
  });
}

/**
 * "Location" — a full-bleed reveal adapted from public/venue-prototype.html.
 *
 * The full choreography, in scroll order:
 *  1. Colour handoff — as the section approaches (its top rising from the
 *     bottom of the viewport up to the top), --theme and --page-bg (the
 *     fixed BracketsField backdrop) scrub from black to pastel blue — never
 *     white. Done by the time the section's top reaches the top of the
 *     viewport, i.e. by the time the visitor has "reached Location."
 *  2. That arrival is also what starts the autoplay reveal (NOT scroll-
 *     scrubbed: the sketch is 49 pre-split <path> elements, and
 *     re-computing their stroke-dasharray on every scroll pixel was the
 *     actual source of choppiness, not the tween mechanism): the hand-drawn
 *     outline draws in, then the real photo wipes in bottom-up over it (a
 *     clip-path reveal, not a cross-fade) at -20% exposure. The "Location"
 *     heading itself is NOT part of this reveal — it's visible from the
 *     moment the section is reached, not something that fades in with or
 *     after it.
 *  3. The section pins right at that same arrival point — scrolling stops
 *     moving it — for a fixed run of extra scroll input, which is spent on:
 *     a settle beat (room for the autoplay above to finish before anything
 *     else reacts to scroll), then the reversible "Location" ⇄
 *     "Save the Date" swap (scroll past it, see the date; scroll back, see
 *     "Location" again), then a BLACK overlay panel that rises up from the
 *     bottom and covers the still-pinned (still pastel-blue) photo
 *     entirely — a visible black-over-blue cover, not a blend. --page-bg
 *     (the heading strip has no background of its own, so this is visible
 *     the whole time, not just at the edges) stays pastel blue for as long
 *     as the overlay hasn't COMPLETELY covered the frame yet, and flips to
 *     match, black, the instant it has — reversible on every scroll tick,
 *     forward or back.
 *  4. Only once that overlay has completely covered the frame (and
 *     --page-bg has flipped to match) does the pin release — ordinary
 *     scrolling resumes with MoodSection next already over a matching
 *     black backdrop, so the handoff reads as continuous, not a jump cut.
 *     MoodSection picks the baton up from there for the black → white
 *     handoff that closes it out.
 *
 * It also fades BracketsField's 3D brackets out for as long as this section
 * (including its whole pinned/overlay run) is anywhere near the viewport,
 * so they don't float behind the photo or show through the blue heading
 * strip while the section is active.
 *
 * Under reduced-motion / lite it degrades to the settled state: heading up
 * top, photo visible, venue caption visible, --theme/--page-bg jumped
 * straight to their light/pastel values — no sketch, no pin, no overlay, no
 * swap. Those are motion embellishments, not information.
 */
export function VenueReveal({ brandShapes }: { brandShapes: string[] }) {
  const { lenisRef } = useMotion();
  const wrapRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const captionTitleRef = useRef<HTMLHeadingElement>(null);
  const directionsRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const particleTlRef = useRef<gsap.core.Timeline | null>(null);
  const particleActiveRef = useRef(false);
  const alignReadoutRef = useRef<HTMLDivElement>(null);

  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);
  const [svgReady, setSvgReady] = useState(false);
  // See the ?align=1 debug branch in the effect below — read once at mount,
  // not on every render, since it only ever changes via a full page load.
  const [alignDebug] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("align") === "1",
  );

  // Fetched once, client-side, and injected as real DOM <path> elements —
  // DrawSVGPlugin needs to own their stroke-dasharray/-offset directly, which
  // an <img> or next/image can't offer. ~600KB, so this is deliberately not
  // bundled into the page's JS; the browser caches it like any other asset.
  useEffect(() => {
    if (staticBaseline) return;
    let cancelled = false;
    fetch("/venue-lines.svg")
      .then((res) => res.text())
      .then((markup) => {
        if (cancelled || !svgHostRef.current) return;
        svgHostRef.current.innerHTML = markup;
        svgHostRef.current.querySelector("svg")?.setAttribute("shape-rendering", "optimizeSpeed");
        setSvgReady(true);
      })
      .catch(() => {
        // No sketch if it fails to load — the photo/caption sequence below
        // still plays fine without it.
      });
    return () => {
      cancelled = true;
    };
  }, [staticBaseline]);

  // Cover-fit sizing: .venue-visual is sized to "cover" the stage at the
  // line-art's own ART_RATIO, so wide stages crop top/bottom and narrow ones
  // crop left/right — same technique as venue-prototype.html's sizeStage(),
  // applied to the wrapper that holds BOTH the sketch and the photo so they
  // always land in the exact same place.
  useEffect(() => {
    const stage = stageRef.current;
    const visual = visualRef.current;
    if (!stage || !visual) return;
    function size() {
      const w = stage!.clientWidth;
      const h = stage!.clientHeight;
      if (!w || !h) return;
      let coverW: number;
      let coverH: number;
      if (w / h > ART_RATIO) {
        coverW = w;
        coverH = w / ART_RATIO;
      } else {
        coverH = h;
        coverW = h * ART_RATIO;
      }
      visual!.style.width = `${coverW}px`;
      visual!.style.height = `${coverH}px`;
      visual!.style.left = `${-((coverW - w) / 2)}px`;
      visual!.style.top = `${-((coverH - h) * TOP_CROP_BIAS)}px`;
    }
    size();
    const ro = new ResizeObserver(size);
    ro.observe(stage);
    return () => ro.disconnect();
    // `visual` only exists once staticBaseline resolves to false (see the
    // conditional render below) — on the very first client render it's still
    // the SSR-safe `true` default, so `visual` is null and this effect must
    // re-run once that flips, or the cover-fit box never gets sized at all.
  }, [staticBaseline]);

  // Reduced-motion / lite: no reveal will ever play to hang the handoff off
  // of, so jump --theme and --page-bg straight to their settled values on
  // mount instead of leaving the page stuck dark for FAQ/the ticket stub
  // below, which need light text over a light backdrop.
  //
  // Reads the preference straight from shouldUseStaticBaseline(), NOT from
  // the `staticBaseline` render value — that value is the SSR-safe `true`
  // default on the very first client render and only settles a render later
  // (see useClientValue / MotionProvider.tsx's own copy of this warning), so
  // gating on it here would flash --theme/--page-bg to their settled values
  // for EVERY visitor on every load, motion-enabled or not, before silently
  // never undoing it (there's nothing to "undo" a style mutation once made).
  useEffect(() => {
    if (!shouldUseStaticBaseline()) return;
    const root = document.documentElement;
    root.style.setProperty("--theme", "1");
    root.style.setProperty("--page-bg", resolveColor("var(--blue-pastel)"));
  }, []);

  useGSAP(
    () => {
      if (staticBaseline) return;

      // Defensive: this callback legitimately re-runs more than once as
      // staticBaseline/svgReady settle (see the dependencies below), and
      // revertOnUpdate's cleanup-before-rerun has a window where a
      // still-pinning previous ScrollTrigger can overlap a newly-created one
      // on the same element — two pins on one element corrupts the page with
      // two competing pin-spacers. Killing anything already attached to this
      // section before creating this run's triggers makes each run
      // start from a clean slate regardless of that timing.
      ScrollTrigger.getAll()
        .filter((trigger) => trigger.trigger === wrapRef.current)
        .forEach((trigger) => trigger.kill());

      // Fade the shared 3D brackets layer out for as long as this stage is
      // anywhere near the viewport, so it never floats behind the photo or
      // the flat backdrop this section otherwise leaves fully exposed (it
      // paints no background of its own — see the component doc comment).
      //
      // end is "bottom+=TOTAL_VH% top", NOT the plain "bottom top" a
      // non-pinned trigger would use: wrapRef's own unpinned height is ONE
      // viewport (h-[100lvh] on the frame inside it), but the pin below
      // holds it on screen for a further TOTAL_VH% of scroll beyond that via
      // a separate pin-spacer — extra distance this trigger's own geometry
      // knows nothing about. A plain "bottom top" end is reached (and
      // brackets restored to opacity 1) the moment wrapRef's un-pinned
      // bottom would have passed the viewport, which happens WHILE the pin
      // is still holding Location on screen (mid swap/overlay) — the
      // brackets-floating-over-the-overlay bug this fixes. Percentage
      // offsets in ScrollTrigger position strings resolve against the
      // TRIGGER element's own height, which happens to equal one viewport
      // height here (h-[100lvh] again), so TOTAL_VH% of wrapRef's height is
      // exactly TOTAL_VH% of the viewport — the same extra distance the pin
      // itself consumes.
      // onLeave hands off at 0, NOT 1: forcing straight to fully visible
      // the instant the pin releases is exactly the "brackets suddenly pop
      // in" jump this is meant to avoid. MoodSection's own pin picks up
      // from this same 0 and eases --brackets-opacity up to 1 in lockstep
      // with its black → white fade (see there) — so from the visitor's
      // side the brackets fade into existence as the backdrop brightens,
      // one continuous reveal, rather than snapping in ahead of it.
      // onLeaveBack still restores 1 immediately: scrolling back UP past
      // Location into the dark About section, brackets belong there at
      // full visibility right away, no fade to wait for.
      const setBracketsOpacity = gsap.quickSetter(document.documentElement, "--brackets-opacity");
      ScrollTrigger.create({
        trigger: wrapRef.current,
        start: "top bottom",
        end: `bottom+=${TOTAL_VH}% top`,
        invalidateOnRefresh: true,
        onUpdate: (self) => setBracketsOpacity(self.isActive ? 0 : 1),
        onLeave: () => setBracketsOpacity(0),
        onLeaveBack: () => setBracketsOpacity(1),
      });

      // The page's one shared dark → light handoff — plain reversible scrub,
      // NOT part of the pin below. Done resolving to pastel blue by the
      // moment the section's top reaches the top of the viewport — "by the
      // time we reach Location, the page is already fully blue" — which is
      // also the exact instant the pin (and the reveal autoplay) below
      // takes over.
      const setTheme = gsap.quickSetter(document.documentElement, "--theme");
      const setPageBg = gsap.quickSetter(document.documentElement, "--page-bg");
      const blueResolved = resolveColor("var(--blue-pastel)");
      const inkResolved = resolveColor("var(--ink)");
      // The second handoff: --page-bg hard-flips to this the instant the
      // pastel-blue overlay below has COMPLETELY covered the frame, and
      // back to blueResolved for as long as it hasn't — see overlayProgress
      // in the pin's onUpdate (and onLeave/onLeaveBack, which cover the
      // two instants outside onUpdate's own [0,1] range). MoodSection.tsx
      // picks up from exactly this value for its own black → white
      // handoff.
      const blackResolved = resolveColor("var(--black)");
      ScrollTrigger.create({
        trigger: wrapRef.current,
        start: "top bottom",
        end: "top top",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          setTheme(self.progress);
          setPageBg(gsap.utils.interpolate(inkResolved, blueResolved, self.progress));
        },
      });

      if (!headingRef.current || !stageRef.current || !overlayRef.current) return;
      const stage = stageRef.current;
      const heading = headingRef.current;

      // Primes swapText()'s own dedupe (see its definition above) with the
      // text that's ALREADY on screen, so the pin's very first onUpdate call
      // — which always runs its "below SWAP_AT" branch on arrival, since
      // scroll starts under the threshold — recognises "Location" as
      // nothing new and skips the rise-out/rise-in animation, instead of
      // needlessly replaying it on text that never actually changed.
      swapTargets.set(heading, "Location");
      if (captionTitleRef.current) swapTargets.set(captionTitleRef.current, siteConfig.venue.name);

      gsap.set(overlayRef.current, { yPercent: 100 });

      // Everything below only exists once the sketch has actually loaded —
      // rebuilds automatically (dependencies below) the moment it does.
      const paths = svgHostRef.current?.querySelectorAll("path") ?? [];
      if (!svgReady || paths.length === 0) return;

      // Debug aid — visit the page with ?align=1 (e.g.
      // http://localhost:3000/?align=1#venue): forces a static, un-pinned,
      // full-brightness overlay of the sketch (drawn in red, full opacity)
      // and the photo (50% opacity) on top of each other, with nothing
      // animated and no ScrollTrigger/pin created at all. Scroll to the
      // section normally in your own browser and the mismatch — if any —
      // is directly visible without fighting the reveal animation or the
      // pinned hold to catch it mid-transition.
      //
      // Arrow keys nudge the sketch itself (translateX/Y in CSS px against
      // the rendered, on-screen size — NOT SVG user-units, so the same
      // keypress moves it the same visual distance regardless of how the
      // cover-fit box happens to be scaled right now); +/- zoom both axes
      // together, a/d and w/s stretch the axes independently (in case the
      // mismatch is a slightly different aspect ratio, not just position or
      // uniform scale), q/e rotate. Shift on any of them for a bigger step.
      // The on-screen readout is the point: read the settled values off it
      // and report them back rather than needing devtools at all.
      if (alignDebug) {
        gsap.set(stage, { opacity: 1 });
        gsap.set(svgHostRef.current, { opacity: 1, transformOrigin: "50% 50%" });
        gsap.set(paths, { drawSVG: "100%", attr: { stroke: "#ff2d55" } });
        gsap.set(photoRef.current, { clipPath: "inset(0%)", filter: "brightness(100%)", opacity: 0.5 });

        const svgHost = svgHostRef.current;
        const readout = alignReadoutRef.current;
        let x = 0;
        let y = 0;
        let scaleX = 1;
        let scaleY = 1;
        let rotation = 0;
        const render = () => {
          gsap.set(svgHost, { x, y, scaleX, scaleY, rotation });
          if (readout) {
            readout.textContent =
              `translate(${x}px, ${y}px)  scaleX(${scaleX.toFixed(3)})  scaleY(${scaleY.toFixed(3)})  rotate(${rotation.toFixed(1)}deg)\n` +
              `arrows: move · +/-: zoom both · a/d: scaleX · w/s: scaleY · q/e: rotate · shift: bigger step · 0: reset`;
          }
        };
        render();
        const onKey = (e: KeyboardEvent) => {
          const step = e.shiftKey ? 10 : 1;
          const scaleStep = e.shiftKey ? 0.01 : 0.002;
          const rotateStep = e.shiftKey ? 1 : 0.1;
          if (e.key === "ArrowLeft") x -= step;
          else if (e.key === "ArrowRight") x += step;
          else if (e.key === "ArrowUp") y -= step;
          else if (e.key === "ArrowDown") y += step;
          else if (e.key === "+" || e.key === "=") {
            scaleX += scaleStep;
            scaleY += scaleStep;
          } else if (e.key === "-" || e.key === "_") {
            scaleX -= scaleStep;
            scaleY -= scaleStep;
          } else if (e.key === "d") scaleX += scaleStep;
          else if (e.key === "a") scaleX -= scaleStep;
          else if (e.key === "w") scaleY += scaleStep;
          else if (e.key === "s") scaleY -= scaleStep;
          else if (e.key === "e") rotation += rotateStep;
          else if (e.key === "q") rotation -= rotateStep;
          else if (e.key === "0") {
            x = 0;
            y = 0;
            scaleX = 1;
            scaleY = 1;
            rotation = 0;
          } else return;
          e.preventDefault();
          render();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }

      gsap.set(stage, { opacity: 0 });
      gsap.set(paths, { drawSVG: "0%" });
      gsap.set(photoRef.current, { opacity: 0, scale: 1.015, filter: "blur(16px) brightness(100%)" });
      gsap.set(glowRef.current, { opacity: 0, scale: 0.97, transformOrigin: "50% 50%" });
      // Static correction that lines the hand-drawn sketch up with
      // venue.webp — dialled in by eye via the ?align=1 debug view's manual
      // nudge controls (see the alignDebug branch above), then converted
      // from the px/unitless readout there (translate(8px, 11px) scaleX
      // 1.018 scaleY 0.962 at an 867×570.66 rendered box) into percentages
      // of the sketch's own box so it holds up as the cover-fit box's size
      // changes with viewport, not just at the one size it was tuned at.
      // No wipe/clip-path anymore (see the reveal sequence below), so this
      // transform no longer needs to worry about leaving edges uncovered —
      // the sketch hides via its own opacity now, uniformly, regardless of
      // where its transformed bounds land relative to the photo's.
      gsap.set(svgHostRef.current, {
        opacity: 1,
        xPercent: 0.92,
        yPercent: 1.93,
        scaleX: 1.018,
        scaleY: 0.962,
        transformOrigin: "50% 50%",
      });
      gsap.set(scrimRef.current, { opacity: 0 });
      gsap.set(captionRef.current, { opacity: 0, y: 14 });
      // A single autoplay sequence, matching venue-prototype.html's
      // playReveal() for the draw itself, then diverging for the handoff to
      // the photo. The heading is NOT part of this timeline — it's already
      // visible (see the JSX) the moment the section is reached, rather than
      // fading in with or after the sketch/photo reveal.
      // onComplete releases the scroll lock set below (see the reveal
      // ScrollTrigger's onEnter) — the visitor can't scroll AT ALL from the
      // moment the section is reached until this whole timeline (draw,
      // glow/photo handoff, exposure, caption) has actually finished
      // playing, then scrolling resumes exactly where the pin picks up.
      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: "power2.out" },
        onComplete: () => lenisRef.current?.start(),
      });

      tl.to(stage, { opacity: 1, duration: 0.4 });

      tl.addLabel("draw", "-=0.1");
      tl.to(
        paths,
        { drawSVG: "100%", duration: 0.6, ease: "none", stagger: { amount: 1.0, from: "start" } },
        "draw",
      );
      tl.call(() => svgHostRef.current?.querySelector("svg")?.setAttribute("shape-rendering", "auto"));

      // The handoff, in order — the glow now lives on the PHOTO, not the
      // sketch (it used to be a drop-shadow filter on the sketch itself,
      // which meant re-rasterizing and blurring 2203 path segments across 49
      // <path>s every animated frame — profiled at 100–167ms/frame, should
      // be ~16ms). Everything below only ever touches the photo (one bitmap
      // layer, blur/opacity are compositor-only regardless of radius) and a
      // single flat-colour div (glowRef, blended over it) — no per-frame
      // vector rasterization anywhere in this beat:
      //  1. Sketch fades out — plain opacity, nothing else animated on it.
      //  2. Photo fades in already blurred, and sharpens as it settles.
      //  3. The glow div (a flat whitish-blue rectangle, mix-blend-mode
      //     "screen" so it lightens/blooms rather than just tinting) spikes
      //     in then fades out, in the SAME beat as the photo sharpening —
      //     that's the "neon" read: the image itself blooms into focus.
      //  4. Exposure dip — -20%, i.e. brightness(80%) — applied to the photo
      //     only once the glow/blur has fully settled.
      //  5. THEN the caption fades in.
      tl.addLabel("drawDone", "draw+=1.6");

      tl.addLabel("glowIn", "drawDone");
      // Instant, not animated: profiling showed even a PLAIN opacity fade on
      // this sketch is expensive in isolation (avg 55ms/frame, worst 83ms) —
      // blending 2203 dense, overlapping stroke segments at intermediate
      // alpha values is real per-pixel work, opacity or not, layer-promoted
      // or not. A hard cut costs one repaint instead of ~35 (0.6s of them),
      // and it's masked anyway: the photo fade-in and glow bloom both start
      // in this exact same instant.
      tl.set(svgHostRef.current, { opacity: 0 }, "glowIn");
      tl.to(photoRef.current, { opacity: 1, scale: 1, filter: "blur(0px) brightness(100%)", duration: 0.85 }, "glowIn");
      // The neon beat itself: a quick, punchy charge-up (0.28s, a slight
      // scale-in for a bit of snap) to near-full bloom, THEN a long, gentle
      // dissipation (1.0s, sine easing — the gentlest of GSAP's built-in
      // eases, no acceleration bump in the middle the way power*.inOut has)
      // with a slight scale-UP as it fades, like the glow is expanding and
      // thinning out rather than just switching off. That asymmetry — fast
      // in, slow lingering out — is what reads as "sci-fi energy reveal"
      // rather than a flat pulse; it's also cheap regardless of duration,
      // since it's still just opacity + transform on one flat div.
      tl.fromTo(
        glowRef.current,
        { opacity: 0, scale: 0.97 },
        { opacity: 0.95, scale: 1, duration: 0.28, ease: "power2.out" },
        "glowIn",
      );
      tl.to(glowRef.current, { opacity: 0, scale: 1.05, duration: 1.0, ease: "sine.out" }, "glowIn+=0.28");

      tl.addLabel("photoDone", "glowIn+=1.28");
      tl.to(photoRef.current, { filter: "blur(0px) brightness(80%)", duration: 0.6 }, "photoDone");

      tl.to(scrimRef.current, { opacity: 1, duration: 0.7 }, "photoDone+=0.3");
      tl.to(captionRef.current, { opacity: 1, y: 0, duration: 0.7 }, "<");

      // Arrival at the section is what starts the autoplay above AND pins
      // the section in the same breath — from the visitor's side, scrolling
      // into "Location" and having it lock in place is one continuous beat.
      // lenisRef.stop() here (same mechanism HeroSection's intro uses) is
      // what makes that hold literal: not just visually pinned but actually
      // un-scrollable, so a fast/impatient scroll can't blow past the reveal
      // mid-flight — tl's onComplete above is the only thing that calls
      // start() again.
      ScrollTrigger.create({
        trigger: wrapRef.current,
        start: "top top",
        once: true,
        onEnter: () => {
          lenisRef.current?.stop();
          tl.play();
        },
      });

      // The held pin: "the entire section stays as is, vertical scroll
      // waits." Scroll is impossible at all until tl finishes (see the
      // lenisRef.stop()/start() above), but that alone only guarantees the
      // REVEAL is done before scrolling can resume — it doesn't give the
      // visitor a moment to actually look at the settled result before the
      // very first pixel of scroll flips it to "Save the Date". HOLD_VH
      // (module-level, above) is that moment: scrolling works immediately
      // once the lock lifts, but the swap doesn't fire until past it.
      // Scroll input from here drives self.progress through three phases
      // (as a fraction of HOLD_VH/SWAP_VH/OVERLAY_VH):
      //   1. HOLD — pure dead zone, "Location" stays on screen.
      //   2. SWAP — reversibly swaps "Location" for "Save the Date" (and the
      //      venue name for the date), exactly the same reversible
      //      swapText() mechanism as before, just re-timed to live inside
      //      the pin instead of the open page scroll.
      //   3. OVERLAY — "after this animation the image stays put... a[n]
      //      overlay will scroll" over it instead: a BLACK panel rises from
      //      the bottom of the still-pinned frame and fully covers it (see
      //      the overlay's own JSX for why black, not the page's pastel-
      //      blue). Only once it does does the pin release, so MoodSection
      //      (next in the page) resumes ordinary scrolling over a backdrop
      //      that already matches — no jump cut.
      const SWAP_AT = HOLD_VH / TOTAL_VH;
      const OVERLAY_AT = (HOLD_VH + SWAP_VH) / TOTAL_VH;
      // swapText()'s rise-out/rise-in takes ~0.9s of real time, but scroll
      // distance and real time aren't the same thing — a fast enough scroll
      // can cover the ENTIRE rest of the pin (SWAP_VH + OVERLAY_VH) well
      // under that, in a single update tick. A scroll-distance buffer alone
      // (SWAP_VH) can't stop that: it only slows down a moderate scroll, and
      // once progress blows past 1 in one tick, onLeave used to fire
      // instantly (see its old comment below), snapping the swap AND the
      // overlay to their finished states together — "no matter how hard I
      // scroll" was the actual bug report. Real fix: the moment scroll
      // crosses the swap threshold, in EITHER direction, clamp the scroll
      // position back to exactly that checkpoint and hard-lock it there
      // (lenisRef.stop(), same mechanism the reveal's own lock above uses)
      // for exactly SWAP_ANIM_MS — so "Save the Date" (or "Location",
      // scrolling back) is fully readable before the overlay can start
      // rising over it, independent of how far the gesture that crossed the
      // checkpoint actually wanted to go. Whatever's left of that gesture's
      // momentum is simply lost when locked, same as the reveal lock above —
      // scrolling past this point again afterwards is a fresh, ordinary
      // scroll.
      let swapState: "location" | "date" = "location";
      let swapLocking = false;
      const SWAP_ANIM_MS = 950;
      const setOverlayY = gsap.quickSetter(overlayRef.current, "yPercent");
      // The particle vortex only needs to render while the overlay panel is
      // actually rising into view — pausing its timeline the rest of the
      // time (panel parked off-screen at yPercent 100) avoids burning frames
      // on a canvas nobody can see.
      function setParticlesActive(active: boolean) {
        if (particleActiveRef.current === active) return;
        particleActiveRef.current = active;
        if (active) particleTlRef.current?.play();
        else particleTlRef.current?.pause();
      }
      function applySwapVisuals(toDate: boolean) {
        // Forward (toDate) rolls up, same as always; reverse (back to
        // "Location") rolls down — the opposite direction, matching which
        // way the scroll that triggered it actually went. See swapText()'s
        // own doc comment for the mechanics.
        const direction = toDate ? 1 : -1;
        if (toDate) {
          gsap.to(directionsRef.current, { opacity: 0, duration: 0.4 });
          swapText(heading, "Save the Date", direction);
          if (captionTitleRef.current && dateShort) swapText(captionTitleRef.current, dateShort, direction);
        } else {
          gsap.to(directionsRef.current, { opacity: 1, duration: 0.4 });
          swapText(heading, "Location", direction);
          if (captionTitleRef.current) swapText(captionTitleRef.current, siteConfig.venue.name, direction);
        }
      }
      ScrollTrigger.create({
        trigger: wrapRef.current,
        start: "top top",
        end: `+=${TOTAL_VH}%`,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          const wantsDate = p >= SWAP_AT;
          const nextState = wantsDate ? "date" : "location";

          if (nextState !== swapState && !swapLocking) {
            swapLocking = true;
            swapState = nextState;
            // self, not a captured reference to the trigger created below —
            // it's the exact same instance, but available immediately, no
            // risk of reading it before its own `const` assignment finishes.
            const checkpoint = self.start + (self.end - self.start) * SWAP_AT;
            lenisRef.current?.scrollTo(checkpoint, { immediate: true });
            lenisRef.current?.stop();
            applySwapVisuals(wantsDate);
            window.setTimeout(() => {
              lenisRef.current?.start();
              swapLocking = false;
            }, SWAP_ANIM_MS);
          }

          const overlayProgress = p < OVERLAY_AT ? 0 : (p - OVERLAY_AT) / (1 - OVERLAY_AT);
          const overlayY = gsap.utils.interpolate(100, 0, overlayProgress);
          setOverlayY(overlayY);
          setParticlesActive(overlayY < 99);
          // A hard flip, not a scrub: the heading strip up top has no
          // background of its own (see the JSX) — it shows --page-bg
          // straight through — so this stays visible (and has to stay
          // correct) through the whole HOLD/SWAP run, not just at the two
          // pin boundaries. Pastel blue for as long as the overlay hasn't
          // COMPLETELY covered the frame yet, black the instant it has;
          // reversible for free since this runs on every scroll tick,
          // forward or back.
          setPageBg(overlayProgress >= 1 ? blackResolved : blueResolved);
        },
        // onUpdate only fires while progress is inside [0, 1] — the instant
        // scroll carries it past either end, GSAP stops calling it (that's
        // also the instant the pin itself releases). onLeave/onLeaveBack are
        // the guarantee that the section can never scroll away (or back
        // above the section) with the swap or overlay caught mid-flight —
        // the checkpoint lock above keeps the SWAP itself from ever being
        // outrun, but the overlay's own scroll-linked rise can still be
        // skipped past by a hard scroll (acceptable — only the swap needed
        // to be guaranteed visible), so this is still the backstop for that.
        onLeave: () => {
          setOverlayY(0);
          setParticlesActive(true);
          swapState = "date";
          applySwapVisuals(true);
          setPageBg(blackResolved);
        },
        onLeaveBack: () => {
          setOverlayY(100);
          setParticlesActive(false);
          swapState = "location";
          applySwapVisuals(false);
          setPageBg(blueResolved);
        },
      });
    },
    // revertOnUpdate: without it, useGSAP defers its cleanup until unmount
    // (see @gsap/react's own deferCleanup logic) — every dependency change
    // would then ADD a fresh set of ScrollTriggers on top of the previous
    // set instead of replacing them. That was already happening (harmlessly
    // duplicating idempotent onUpdate calls) before the theme/swap trigger
    // above was pinned; with pin: true, two coexisting instances pinning the
    // same element created two competing pin-spacers and broke the whole
    // page's layout below this section.
    { scope: wrapRef, dependencies: [staticBaseline, svgReady], revertOnUpdate: true },
  );

  return (
    <section id="venue" ref={wrapRef} className="relative overflow-hidden">
      {/* flex column pinned to exactly one viewport tall: the heading is
          shrink-0 (flexbox never squeezes it below its content's natural
          size, so it's ALWAYS fully visible, however little room is left),
          and the stage takes flex-1/min-h-0 — ALL of whatever's left over,
          no width-derived cap on top of that. A cap there used to leave a
          band of bare backdrop below the image on narrow/tall screens
          (mobile portrait) instead of letting the photo run to the bottom
          of the frame; the cover-fit crop in the resize effect below
          already handles however tall/narrow that leftover space ends up
          being; a viewport this tall relative to its width just crops more
          off the sides.

          h-[100lvh], deliberately NOT h-dvh: this section is pinned via
          `position: fixed` for part of its life (see the pin below), and on
          real phones a `dvh`-sized fixed element was observed to render
          shorter than the actual screen once the address bar auto-hid mid-
          scroll — the browser doesn't reliably grow it back — leaving a
          strip of bare --page-bg below the photo. `lvh` is the "large
          viewport height" unit: it's pinned to the address-bar-hidden
          height and, unlike `dvh`, never changes as the bar shows/hides, so
          there's nothing for a fixed-position element to fail to track. The
          trade this makes is accepting that the frame can render slightly
          TALLER than the currently-visible area while the bar IS showing —
          harmless: unpinned it's just a little extra (invisible until you
          scroll to it, same as any 100vh section always has been on
          mobile), and pinned/fixed it means a sliver of the photo's bottom
          edge sits below the visible fold rather than a gap ever showing
          above it. Chasing exact-current-viewport tightness with JS here
          (measuring `visualViewport`, writing an inline pixel height, then
          calling `ScrollTrigger.refresh()` so the pin's own scroll-distance
          math stayed in sync) was tried and reverted: refreshing on every
          address-bar toggle intermittently desynced this section's own
          pinned/scrubbed state (the swap lock, the overlay's rise, the
          particle vortex) from actual scroll position. A stable CSS unit
          that needs no JS and no refresh has no such window. */}
      <div className="relative z-10 flex h-[100lvh] flex-col">
        {/* Heading: lives above the image stage, not overlaid on it — no
            animated move, only a fade-in — so the sketch draw is what draws
            the eye. Sitting in normal flow (not absolutely over the photo)
            is what gives this section its extra height. Deliberately roomy
            (min-h, not just padding) so the title reads as its own beat
            before the image, not a cramped strip above it. text-paper (not
            a fixed colour) so it reads white against the black backdrop
            before the theme handoff and ink afterward, over the light
            backdrop. */}
        <div className="relative z-20 flex shrink-0 items-center justify-center px-6 py-6 text-center min-h-[16%] sm:min-h-[20%] sm:py-8">
          <h2
            ref={headingRef}
            className="text-paper text-[clamp(3rem,10vw,8rem)] font-bold leading-none tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)]"
          >
            Location
          </h2>
        </div>

        <div ref={stageRef} className="relative min-h-0 w-full flex-1 overflow-hidden">
          {/* Cover-fit visual stack: sketch and photo cropped identically so
              they stay pixel-aligned at any stage size. */}
          {!staticBaseline && (
            <div ref={visualRef} className="absolute left-0 top-0">
              {/* Photo BEFORE the sketch in the stack (not after, as it used
                  to be) — during the glow handoff (see the reveal timeline
                  above) the glowing lines sit visually in front of the
                  fading-in photo, not behind it. */}
              <div ref={photoRef} className="absolute inset-0 overflow-hidden">
                {/* venue.webp's native ratio (5425x3781) isn't quite
                    ART_RATIO (1773x1167) — object-cover's crop (even
                    biased) only ever gets the two CLOSE, never pixel-exact,
                    because a crop can't fix a ratio mismatch, only hide it.
                    The line art was traced against this photo at ART_RATIO,
                    so the two are only guaranteed to line up if the photo
                    fills the exact same box with no cropping at all —
                    object-fill stretches it to do that (a ~6% width/height
                    difference, imperceptible on a building facade) instead
                    of cropping it. */}
                <Image src="/venue.webp" alt="" fill className="object-fill" priority={false} />
              </div>
              {/* [&_path]:stroke-[1.5px] would set the SVG `stroke` (paint)
                  property to an invalid colour, not stroke-width — Tailwind's
                  stroke-[...] is a colour utility. The arbitrary-property
                  syntax below is what actually sets stroke-width. */}
              <div ref={svgHostRef} className="absolute inset-0 [&_path]:fill-none [&_path]:[stroke-width:1.5px]" />
              {/* Neon bloom: a flat colour, blended over the photo with
                  mix-blend-mode "screen" (lightens rather than tints) — see
                  GLOW_COLOR's own comment for why this replaced a filter on
                  the sketch. Purely decorative, hidden from assistive tech. */}
              <div
                ref={glowRef}
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ backgroundColor: GLOW_COLOR, mixBlendMode: "screen" }}
              />
            </div>
          )}

          {/* Static baseline: the photo alone, no sketch, no motion. */}
          {staticBaseline && (
            <div className="absolute inset-0">
              <Image
                src="/venue.webp"
                alt={`${siteConfig.venue.name}, the DevFest Chennai venue`}
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Darkening scrim + venue caption, overlaid directly on the photo
              — always white/drop-shadowed regardless of theme, since this
              sits over the photo, not the flat backdrop. */}
          <div
            ref={scrimRef}
            className={`pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/75 via-black/25 to-transparent ${staticBaseline ? "" : "opacity-0"}`}
          />
          <div
            ref={captionRef}
            className={`absolute inset-x-0 bottom-[28%] z-20 px-6 text-center sm:bottom-[12%] ${staticBaseline ? "" : "opacity-0"}`}
          >
            <h3
              ref={captionTitleRef}
              className="text-3xl font-semibold text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-5xl"
            >
              {siteConfig.venue.name}
            </h3>
            {!staticBaseline && (
              <GlowButton
                ref={directionsRef}
                href={siteConfig.venue.mapUrl}
                target="_blank"
                rel="noreferrer"
                size="sm"
                className="mt-3"
              >
                <RollingText>Get directions →</RollingText>
              </GlowButton>
            )}
          </div>
        </div>
      </div>

      {/* Overlay panel: rises from the bottom to fully cover the still-
          pinned frame at the end of the held sequence (see the pin's
          OVERLAY phase in the effect above). BLACK — deliberately not
          pastel blue like the rest of Location: this panel rising IS the
          "turn black" cue, visibly covering the still-blue frame beneath
          it (heading strip, photo) rather than blending into it. --page-bg
          itself stays pastel blue for as long as this hasn't finished
          covering (see overlayProgress in the pin's onUpdate) and only
          flips to match, black, once it has. */}
      {!staticBaseline && (
        <div
          ref={overlayRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30"
          style={{ backgroundColor: "var(--black)" }}
        >
          {/* Brand-shape particle vortex, reskinned from GSAP's own "canvas
              particles" demo — streams inward toward the center for as long
              as this panel is up (see setParticlesActive above). */}
          <ParticleCover
            shapes={brandShapes}
            className="absolute inset-0"
            onReady={(tl) => {
              particleTlRef.current = tl;
            }}
          />
        </div>
      )}

      {/* ?align=1 readout — see the debug branch in the effect above. Fixed
          (not absolute) so it stays on screen regardless of where in the
          section you've scrolled to. */}
      {alignDebug && (
        <div
          ref={alignReadoutRef}
          className="fixed left-2 top-2 z-50 whitespace-pre rounded bg-black/80 px-3 py-2 font-mono text-xs text-white"
        />
      )}
    </section>
  );
}
