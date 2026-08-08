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

gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin, SplitText);

/** The line-art's own viewBox ratio (see public/venue-lines.svg) — the photo
 *  is cropped to the same ratio so the two stay pixel-aligned, and the stage
 *  itself is sized close to it (see the JSX) rather than a full viewport. */
const ART_RATIO = 1773 / 1167;
/** Vertical crop bias when the stage is wider/shorter than ART_RATIO: only
 *  this fraction of the overflow comes off the top, protecting the roofline
 *  (the rest comes off the bottom — plain roadway). */
const TOP_CROP_BIAS = 0.15;

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
 *  reveal beat "About DevFest" uses elsewhere on the homepage. */
function swapText(el: HTMLElement, newText: string) {
  if (swapTargets.get(el) === newText) return;
  swapTargets.set(el, newText);
  // Belt-and-braces: kill any tweens still running on this element's current
  // children before splitting it again, so a genuinely-overlapping call
  // (different target text arriving mid-swap) can't leave two SplitText
  // instances animating the same DOM nodes at once.
  gsap.killTweensOf(el.querySelectorAll("*"));

  const outSplit = SplitText.create(el, { type: "chars", mask: "chars" });
  gsap.to(outSplit.chars, {
    yPercent: -130,
    opacity: 0,
    duration: 0.4,
    stagger: 0.015,
    ease: "power2.in",
    onComplete: () => {
      outSplit.revert();
      el.textContent = newText;
      const inSplit = SplitText.create(el, { type: "chars", mask: "chars" });
      gsap.set(inSplit.chars, { yPercent: 130, opacity: 0 });
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
 *     outline draws in and dissolves into the real photo. The "Location"
 *     heading itself is NOT part of this reveal — it's visible from the
 *     moment the section is reached, not something that fades in with or
 *     after it.
 *  3. The section pins right at that same arrival point — scrolling stops
 *     moving it — for a fixed run of extra scroll input, which is spent on:
 *     a settle beat (room for the autoplay above to finish before anything
 *     else reacts to scroll), then the reversible "Location" ⇄
 *     "Save the Date" swap (scroll past it, see the date; scroll back, see
 *     "Location" again), then a pastel-blue overlay panel that rises up
 *     from the bottom and covers the still-pinned photo entirely.
 *  4. Only once that overlay fully covers the frame does the pin release —
 *     ordinary scrolling resumes with FAQ next, already over a matching
 *     pastel-blue backdrop, so the handoff reads as continuous rather than
 *     a jump cut.
 *
 * It also fades BracketsField's 3D brackets out for as long as this section
 * (including its whole pinned/overlay run) is anywhere near the viewport,
 * so they don't float behind the photo.
 *
 * Under reduced-motion / lite it degrades to the settled state: heading up
 * top, photo visible, venue caption visible, --theme/--page-bg jumped
 * straight to their light/pastel values — no sketch, no pin, no overlay, no
 * swap. Those are motion embellishments, not information.
 */
export function VenueReveal({ brandShapes }: { brandShapes: string[] }) {
  const wrapRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const captionTitleRef = useRef<HTMLHeadingElement>(null);
  const directionsRef = useRef<HTMLAnchorElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const particleTlRef = useRef<gsap.core.Timeline | null>(null);
  const particleActiveRef = useRef(false);

  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);
  const [svgReady, setSvgReady] = useState(false);

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
      const setBracketsOpacity = gsap.quickSetter(document.documentElement, "--brackets-opacity");
      ScrollTrigger.create({
        trigger: wrapRef.current,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => setBracketsOpacity(self.isActive ? 0 : 1),
        onLeave: () => setBracketsOpacity(1),
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

      gsap.set(stage, { opacity: 0 });
      gsap.set(paths, { drawSVG: "0%" });
      gsap.set(photoRef.current, { opacity: 0, scale: 1.015, filter: "blur(22px)" });
      gsap.set(svgHostRef.current, { opacity: 1 });
      gsap.set(scrimRef.current, { opacity: 0 });
      gsap.set(captionRef.current, { opacity: 0, y: 14 });

      // A single autoplay sequence, matching venue-prototype.html's
      // playReveal() as closely as this project allows. The heading is NOT
      // part of this timeline — it's already
      // visible (see the JSX) the moment the section is reached, rather than
      // fading in with or after the sketch/photo reveal. Numbers for the
      // parts shared with the prototype are its own, not reinvented: 0.6s per path
      // staggered across a 1.0s spread for the draw, 0.7s for the photo
      // settle, 0.7s for the scrim + caption. The draw uses the SAME 49
      // pre-split paths the prototype does (public/venue-lines.svg was
      // replaced with that exact pre-split copy — the version here before
      // was an unsplit, 1-path export of the same artwork, which is why the
      // draw was heavy regardless of scrub vs autoplay: one massive path's
      // dasharray forces a full re-rasterize of all 2203 merged strokes
      // every frame instead of 49 small ones).
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });

      tl.to(stage, { opacity: 1, duration: 0.4 });

      tl.addLabel("draw", "-=0.1");
      tl.to(
        paths,
        { drawSVG: "100%", duration: 0.6, ease: "none", stagger: { amount: 1.0, from: "start" } },
        "draw",
      );
      tl.call(() => svgHostRef.current?.querySelector("svg")?.setAttribute("shape-rendering", "auto"));

      tl.addLabel("drawDone", "draw+=1.6");
      tl.to(photoRef.current, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.7 }, "drawDone");
      tl.to(svgHostRef.current, { opacity: 0, duration: 0.5, ease: "power2.inOut" }, "drawDone+=0.7");

      tl.addLabel("photoDone", "drawDone+=0.7");
      tl.to(scrimRef.current, { opacity: 1, duration: 0.7 }, "photoDone+=0.1");
      tl.to(captionRef.current, { opacity: 1, y: 0, duration: 0.7 }, "<");

      // Arrival at the section is what starts the autoplay above AND pins
      // the section in the same breath — from the visitor's side, scrolling
      // into "Location" and having it lock in place is one continuous beat.
      ScrollTrigger.create({
        trigger: wrapRef.current,
        start: "top top",
        once: true,
        onEnter: () => tl.play(),
      });

      // The held pin: "the entire section stays as is, vertical scroll
      // waits." Scroll input while pinned doesn't move the page — it drives
      // self.progress through three phases instead, spent (as a fraction of
      // SETTLE_VH/SWAP_VH/OVERLAY_VH below) on:
      //   1. SETTLE — a dead zone with room for the autoplay reveal above to
      //      actually finish playing before anything reacts to further
      //      scroll (autoplay is time-based, scrubbing is scroll-based —
      //      this reconciles the two without literally locking the scroll).
      //   2. SWAP — the instant this zone is entered, reversibly swaps
      //      "Location" for "Save the Date" (and the venue name for the
      //      date), exactly the same reversible swapText() mechanism as
      //      before, just re-timed to live inside the pin instead of the
      //      open page scroll. Firing at the START of the zone (not its
      //      midpoint) is deliberate: swapText()'s rise-out/rise-in take
      //      ~0.9s of real time, and this whole zone is the buffer that
      //      covers it — firing midway only left half that room, so a
      //      normal scroll speed could reach the OVERLAY zone before the
      //      swap animation had actually finished, showing both mid-flight
      //      at once.
      //   3. OVERLAY — "after this animation the image stays put... a[n]
      //      overlay will scroll" over it instead: a pastel-blue panel
      //      (matching the page's own settled backdrop — see body's
      //      `background: var(--page-bg)` in globals.css) rises from the
      //      bottom of the still-pinned frame and fully covers it. Only
      //      once it does does the pin release, so FAQ (next in the page)
      //      resumes ordinary scrolling over a backdrop that already
      //      matches — no jump cut.
      const SETTLE_VH = 20;
      const SWAP_VH = 35;
      const OVERLAY_VH = 70;
      const TOTAL_VH = SETTLE_VH + SWAP_VH + OVERLAY_VH;
      const SWAP_AT = SETTLE_VH / TOTAL_VH;
      const OVERLAY_AT = (SETTLE_VH + SWAP_VH) / TOTAL_VH;
      // The SWAP_VH scroll buffer above is what covers swapText()'s ~0.9s
      // rise-out/rise-in under NORMAL scroll speeds, but scroll distance and
      // real time aren't the same thing — a fast enough flick can cover that
      // whole buffer in well under 0.9s. swapChangedAt/swapState track the
      // real time of the last swap direction change so the overlay is ALSO
      // gated on elapsed time, not just scroll progress: whichever of the
      // two (scroll-based or time-based) is further behind wins, so the
      // overlay can never start rising while the swap animation it would be
      // covering is still mid-flight, regardless of how fast someone scrolls.
      let swapState: "location" | "date" = "location";
      let swapChangedAt = performance.now();
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
          if (nextState !== swapState) {
            swapState = nextState;
            swapChangedAt = performance.now();
          }

          if (wantsDate) {
            gsap.to(directionsRef.current, { opacity: 0, duration: 0.4 });
            swapText(heading, "Save the Date");
            if (captionTitleRef.current && dateShort) swapText(captionTitleRef.current, dateShort);
          } else {
            gsap.to(directionsRef.current, { opacity: 1, duration: 0.4 });
            swapText(heading, "Location");
            if (captionTitleRef.current) swapText(captionTitleRef.current, siteConfig.venue.name);
          }

          const scrollOverlayProgress = p < OVERLAY_AT ? 0 : (p - OVERLAY_AT) / (1 - OVERLAY_AT);
          const timeGate = Math.min((performance.now() - swapChangedAt) / SWAP_ANIM_MS, 1);
          const overlayY = gsap.utils.interpolate(100, 0, Math.min(scrollOverlayProgress, timeGate));
          setOverlayY(overlayY);
          setParticlesActive(overlayY < 99);
        },
        // onUpdate only fires while progress is inside [0, 1] — the instant
        // scroll carries it past either end, GSAP stops calling it (that's
        // also the instant the pin itself releases). If the time gate above
        // hadn't finished catching up to scroll yet at that exact moment,
        // the overlay would be abandoned mid-rise forever: nothing left ever
        // fires again to finish it, since the section is no longer pinned to
        // scroll through. onLeave/onLeaveBack are the guarantee that doesn't
        // depend on scroll speed — they force the fully-settled state for
        // whichever side we just exited on, so the section can never scroll
        // away (or back above the section) with the swap or overlay caught
        // mid-flight, no matter how fast the scroll that got it there.
        onLeave: () => {
          setOverlayY(0);
          setParticlesActive(true);
          swapState = "date";
          swapText(heading, "Save the Date");
          if (captionTitleRef.current && dateShort) swapText(captionTitleRef.current, dateShort);
          gsap.set(directionsRef.current, { opacity: 0 });
        },
        onLeaveBack: () => {
          setOverlayY(100);
          setParticlesActive(false);
          swapState = "location";
          swapText(heading, "Location");
          if (captionTitleRef.current) swapText(captionTitleRef.current, siteConfig.venue.name);
          gsap.set(directionsRef.current, { opacity: 1 });
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
          off the sides. h-dvh (not vh) so mobile browser chrome showing/
          hiding doesn't change the pinned budget mid-pin, and — since the
          heading is shrink-0 — never leaves the stage negative space either,
          just less of it, on wide-but-short screens (landscape laptops,
          16:9 or shorter). */}
      <div className="relative z-10 flex h-dvh flex-col">
        {/* Heading: lives above the image stage, not overlaid on it — no
            animated move, only a fade-in — so the sketch draw is what draws
            the eye. Sitting in normal flow (not absolutely over the photo)
            is what gives this section its extra height. Deliberately roomy
            (min-h, not just padding) so the title reads as its own beat
            before the image, not a cramped strip above it. text-paper (not
            a fixed colour) so it reads white against the black backdrop
            before the theme handoff and ink afterward, over the light
            backdrop. */}
        <div className="relative z-20 flex shrink-0 items-center justify-center px-6 py-6 text-center min-h-[16vh] sm:min-h-[20vh] sm:py-8">
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
              {/* [&_path]:stroke-[1.5px] would set the SVG `stroke` (paint)
                  property to an invalid colour, not stroke-width — Tailwind's
                  stroke-[...] is a colour utility. The arbitrary-property
                  syntax below is what actually sets stroke-width. */}
              <div ref={svgHostRef} className="absolute inset-0 [&_path]:fill-none [&_path]:[stroke-width:1.5px]" />
              <div ref={photoRef} className="absolute inset-0">
                {/* venue.webp's native ratio (5425x3781) isn't quite ART_RATIO
                    (1773x1167) — object-cover's default centred crop trims
                    top/bottom evenly, which lands a few % off from the crop
                    the line art was traced against. Biasing the crop toward
                    the bottom (keeping more of the top) is what lines the
                    two up; found empirically by overlaying them. */}
                <Image
                  src="/venue.webp"
                  alt=""
                  fill
                  className="object-cover"
                  style={{ objectPosition: "50% 85%" }}
                  priority={false}
                />
              </div>
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
            className={`absolute inset-x-0 bottom-[12%] z-20 px-6 text-center ${staticBaseline ? "" : "opacity-0"}`}
          >
            <h3
              ref={captionTitleRef}
              className="text-3xl font-semibold text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-5xl"
            >
              {siteConfig.venue.name}
            </h3>
            {!staticBaseline && (
              <a
                ref={directionsRef}
                href={siteConfig.venue.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 border-b border-white/40 pb-0.5 text-sm text-white/85 no-underline transition-colors hover:border-white/80 hover:text-white sm:text-base"
              >
                Get directions →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Overlay panel: rises from the bottom to fully cover the still-
          pinned frame at the end of the held sequence (see the pin's
          OVERLAY phase in the effect above). Coloured to match the page's
          own settled backdrop (body's `background: var(--page-bg)`) so
          releasing the pin into ordinary FAQ scrolling reads as continuous,
          not a jump cut. Purely a transition device — nothing here is
          informational, so it's hidden from assistive tech. */}
      {!staticBaseline && (
        <div
          ref={overlayRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30"
          style={{ backgroundColor: "var(--blue-pastel)" }}
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
    </section>
  );
}
