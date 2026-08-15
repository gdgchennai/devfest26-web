"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { hallwayPhotos } from "@/lib/content";
import { Frame } from "@/components/Frame";
import { Loader } from "@/components/motion/Loader";
import { CurvedMarqueeHero, MARQUEE_TEXTURES } from "@/components/motion/CurvedMarqueeHero";
import { StaticHero } from "@/components/motion/StaticHero";
import { useAssetsLoaded } from "@/components/motion/useAssetsLoaded";
import {
  usePhotoHallway,
  cardWidthVw,
  cardSizes,
  HALLWAY_CORRIDOR_CLASS,
  HALLWAY_CARD_CLASS,
  HALLWAY_BACKDROP_CLASS,
} from "@/components/motion/usePhotoHallway";
import { useMotion } from "@/components/motion/MotionProvider";
import { INTRO_SEEN_KEY, shouldSkipHeavyAssets, shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { clamp } from "@/lib/easing";

/** Desktop flies every hallway photo; mobile takes the first few. */
const MOBILE_FLY_COUNT = 6;

/**
 * The autoplay stops here (see usePhotoHallway.autoplayTo): the flying photos
 * have all passed by ~0.72, so there's no point running the empty tail. The
 * hero cross-fades/zooms in over the tail so it fills the space with no gap.
 */
const AUTOPLAY_TO = 0.8;

function hasSeenIntro() {
  return window.sessionStorage.getItem(INTRO_SEEN_KEY) !== null;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function HeroSection() {
  const { lenisRef } = useMotion();

  const flythroughRef = useRef<HTMLElement>(null);
  const heroWrapRef = useRef<HTMLDivElement>(null);

  // Defaults to the static baseline (matches SSR and the no-JS fallback) and
  // upgrades to the motion intro once confirmed on the client.
  const disableHallway = useClientValue(shouldUseStaticBaseline, true);
  // Separate from `disableHallway` on purpose. Reduced-motion still gets the
  // WebGL hero — rendered once instead of animated — because it is a vestibular
  // preference, not a bandwidth one (see shouldSkipHeavyAssets). Only lite (and
  // the server/no-JS render, hence the `true` default) drops to StaticHero.
  const liteAssets = useClientValue(shouldSkipHeavyAssets, true);
  const isDesktop = useClientValue(() => window.matchMedia("(min-width: 1024px)").matches, true);
  const seenIntro = useClientValue(hasSeenIntro, true);
  // The bouncing preloader shows on EVERY non-baseline load/refresh (something
  // is always loading). The dots→brackets morph + enter CTA + flythrough are
  // the one-time "intro", played only on the first visit of a session.
  const showLoader = !disableHallway;
  const playIntro = !disableHallway && !seenIntro;
  const [revealDone, setRevealDone] = useState(false);
  const [entering, setEntering] = useState(false);
  // The scroll lock must happen exactly once, at the start of the intro. It is
  // undone by releaseIntro — and must NOT be re-applied afterwards. releaseIntro
  // writes INTRO_SEEN_KEY, which flips `seenIntro` (and thus `playIntro`) on the
  // next render; without this guard the lock effect would re-run and re-lock the
  // page the moment the intro finished. (Refresh is unaffected: playIntro is
  // already false there, so it never flips.)
  const lockedRef = useRef(false);
  // The flythrough autoplay tween, held so we can ramp it from its slow
  // portal-transition speed up to 1× once the loader's white layer clears.
  const flyTweenRef = useRef<gsap.core.Tween | null>(null);

  const flying = isDesktop ? hallwayPhotos : hallwayPhotos.slice(0, MOBILE_FLY_COUNT);
  const maxScale = isDesktop ? 3.2 : 2.4;

  // Lock scrolling and hide the hero (it eases in later); the white Loader
  // overlay covers everything until the visitor enters. Nothing scrolls during
  // the intro — the flythrough plays on its own clock as an overlay.
  useLayoutEffect(() => {
    // The server-rendered boot preloader has done its job — hide it. For the
    // full intro the GSAP <Loader> mounts in this same commit and takes over the
    // white field (no seam — both are full-screen white with the same dots); for
    // the baseline (reduced-motion / lite) there's no loader and we just reveal
    // the page. Doing this in React is the RELIABLE hide — the pre-paint script
    // is only a best-effort early hide, so without this a lite visitor (whose
    // showLoader is false) could be left stuck on the bouncing dots.
    document.documentElement.classList.add("boot-done");
    if (!showLoader || lockedRef.current) return;
    lockedRef.current = true;
    document.body.style.overflow = "hidden";
    lenisRef.current?.stop();
    document.getElementById("main")?.setAttribute("aria-busy", "true");
    // Only the first-visit intro hides + shrinks the hero (it eases back in as
    // the flythrough lands). On a refresh the preloader just fades to reveal the
    // hero already in place, so leave it untouched.
    if (playIntro && heroWrapRef.current) gsap.set(heroWrapRef.current, { autoAlpha: 0, scale: 0.85 });
    // lenisRef is stable; the gating flags are the only inputs that re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLoader, playIntro]);

  // Hands the page over: hero fully settled at the top, scrolling restored.
  // Shared by the flythrough finishing and by a skip cutting it short.
  const releaseIntro = useCallback(() => {
    lenisRef.current?.start();
    document.body.style.overflow = "";
    document.getElementById("main")?.removeAttribute("aria-busy");
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    setEntering(false);
    setRevealDone(true);
  }, [lenisRef]);

  // "Enter" clicked. Mount the flythrough overlay; it starts drifting slowly
  // (0.25×) behind the loader's mask holes while the white zooms away.
  const enterExperience = useCallback(() => {
    setEntering(true);
  }, []);

  const onFlyReady = useCallback((tween: gsap.core.Tween) => {
    flyTweenRef.current = tween;
  }, []);

  // The loader's white layer has finished clearing — gradually accelerate the
  // flythrough from its slow drift up to full 1× speed (no abrupt jump), so it
  // eases into flying in properly and lands on the hero.
  const startFlythrough = useCallback(() => {
    if (flyTweenRef.current) {
      gsap.to(flyTweenRef.current, { timeScale: 1, duration: 1, ease: "power2.in" });
    }
  }, []);

  // Per-frame during the flythrough: ease the hero in behind it and fade the
  // flythrough out at the very end, so the images clear as the hero lands.
  const onFlyProgress = useCallback((p: number) => {
    const hero = heroWrapRef.current;
    if (hero) {
      // Ease the hero in and up to full scale across the tail, finishing right
      // at AUTOPLAY_TO so it has fully arrived the instant the flythrough ends.
      const z = smoothstep(clamp((p - 0.46) / (AUTOPLAY_TO - 0.46)));
      hero.style.visibility = "visible";
      hero.style.opacity = clamp((p - 0.46) / 0.24).toFixed(3);
      hero.style.transform = `scale(${(0.86 + 0.14 * z).toFixed(4)})`;
    }
    // Fade the whole flythrough overlay (its dark backdrop included) out as the
    // photos clear, so it cross-fades into the hero rather than leaving a dark
    // empty frame behind.
    const fly = flythroughRef.current;
    if (fly) fly.style.opacity = (1 - clamp((p - 0.58) / 0.2)).toFixed(3);
  }, []);

  // The preloader waits on the whole initial experience — fonts, the title
  // typeface, every archive image, and the 3D brackets backdrop — so the 4-dot
  // bounce keeps looping until it's all ready and nothing pops in unloaded.
  //
  // Two lists, because the two groups are fetched by different mechanisms and
  // warming the wrong URL is the same as not warming at all:
  //  • single-URL — the curved marquee's textures. NOT rebuilt here: the
  //    component exports the exact array it hands to TextureLoader, and we pass
  //    that. Deriving it a second time is how the two drift apart, and this list
  //    was `archivePhotos.map(p => p.src)` — all 15 raw originals, ~5 MB — to
  //    serve a marquee that uses 8 of them at a fraction of the size.
  //  • sized — the flythrough's <Frame>s, which go through the optimizer, so
  //    they must be warmed at the exact widths `cardSizes` will ask for.
  const flyAssets = flying.map((p, i) => ({ src: p.src, sizes: cardSizes(i, maxScale) }));
  const { ready: loadingComplete, degraded } = useAssetsLoaded(
    MARQUEE_TEXTURES,
    !showLoader,
    flyAssets,
  );

  usePhotoHallway({
    containerRef: flythroughRef,
    flyCount: flying.length,
    stackCount: 0,
    maxScale,
    perItemVh: isDesktop ? 0.3 : 0.34,
    disabled: !entering,
    autoplay: true,
    autoplayDuration: Math.min(6, Math.max(3, flying.length * 0.4 + 1.5)),
    autoplayTo: AUTOPLAY_TO,
    autoplayInitialTimeScale: 0.5,
    onAutoplayReady: onFlyReady,
    onAutoplayProgress: onFlyProgress,
    onAutoplayComplete: releaseIntro,
  });

  // Reveal the hero for good once the intro is done. This runs AFTER
  // usePhotoHallway's revert (which, when the flythrough tears down, snaps the
  // hero back to its hidden start frame via onFlyProgress) — declared after it,
  // so this layout effect wins and the hero doesn't stay invisible.
  useLayoutEffect(() => {
    if (!revealDone || !heroWrapRef.current) return;
    gsap.set(heroWrapRef.current, { clearProps: "transform,opacity,visibility" });
  }, [revealDone]);

  // The hero is ALWAYS rendered here, in this exact tree position, whether or
  // not the intro plays — so it never unmounts/remounts when the intro ends
  // (releaseIntro writes intro-seen, which would otherwise flip `seenIntro` and
  // swap render branches, tearing down its WebGL). Only the intro overlays
  // below are conditional.
  //
  // Which hero is safe to branch on, because `liteAssets` is read once on mount
  // and cannot change without a reload (the toggle reloads the page) — unlike
  // `seenIntro`, which flips mid-session and is what that rule is about.
  return (
    <>
      {/* Present the whole time. During the intro it starts hidden and zoomed
          out, then eases in as the flythrough ends (see onFlyProgress). */}
      <div ref={heroWrapRef} style={{ transformOrigin: "50% 50%", willChange: "transform, opacity" }}>
        {/*
         * `degraded` is the second reason to show the static hero, and a very
         * different one from lite: the visitor asked for the full experience and
         * a load-bearing asset definitively failed (see useAssetsLoaded). Showing
         * StaticHero gives them the title, date, venue and CTAs instead of an
         * empty WebGL canvas.
         *
         * No `offerFullExperience` link in that case — it is not a preference
         * they chose, and offering to "switch to the full experience" when the
         * full experience is what just failed would send them in a circle. A
         * reload is the real retry.
         *
         * <SectionBoundary> covers the case where a motion component throws;
         * this covers the other one — nothing threw, the assets never arrived.
         */}
        {liteAssets ? (
          <StaticHero offerFullExperience />
        ) : degraded ? (
          <StaticHero />
        ) : (
          <CurvedMarqueeHero />
        )}
      </div>

      {/*
       * The flythrough: a fixed overlay of photos flying past on black,
       * auto-played (no scroll), fading out as the hero lands beneath it.
       *
       * Portalled to document.body rather than rendered in place: this whole
       * tree sits inside page.tsx's `<div className="relative z-10">`
       * wrapper, which is itself a stacking context. A z-[500] on a normal
       * descendant only wins locally inside that z-10 context — against
       * anything outside it (the hamburger button, fixed at z-50 on body)
       * the whole wrapper only counts as z-10 and loses. Portalling escapes
       * that containment so z-[500] is compared where it's written: at the
       * root, above the button, same as it already was for BootPreloader/
       * <Loader> (z-995/z-1000).
       */}
      {playIntro &&
        entering &&
        !revealDone &&
        createPortal(
          <section ref={flythroughRef} aria-hidden className="fixed inset-0 z-[500] overflow-hidden">
          <div className="absolute inset-0">
            <div className={HALLWAY_BACKDROP_CLASS} />
            <div className={HALLWAY_CORRIDOR_CLASS}>
              {flying.map((photo, i) => (
                <div
                  key={photo.src}
                  className={HALLWAY_CARD_CLASS}
                  style={{
                    ["--card-w" as string]: `${cardWidthVw(i)}vw`,
                    ["--card-ar" as string]: `${photo.width} / ${photo.height}`,
                  }}
                >
                  <Frame
                    src={photo.src}
                    alt={photo.description}
                    title={photo.title}
                    aspectRatio="auto"
                    sizes={cardSizes(i, maxScale)}
                    /*
                     * Deliberately NOT `unoptimized`. That was added to make
                     * these hit the same URLs the preloader warms, but it made
                     * every card fetch the full 402 KB / 1920px original with
                     * AVIF+WebP skipped — 3.34 MB across the ten cards. Frame's
                     * <Image> is lazy, so none of it arrived before the cards
                     * had flown past and every one showed its fallback panel
                     * for the whole intro. Through the optimizer the same photo
                     * is ~31 KB, and `sizes` above already accounts for the
                     * peak zoom, so nothing is served too small.
                     *
                     * `preload` because Frame's <Image> is lazy by default
                     * (next/image: isLazy = !priority && !preload && ...), and
                     * lazy is simply wrong here — this section only mounts at
                     * the moment these ten cards start flying at the camera, so
                     * every one of them is about to be seen. Waiting for an
                     * intersection callback is how they ended up still blank.
                     */
                    preload
                    className="h-full w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>,
        document.body,
      )}

      {showLoader && !revealDone && (
        <Loader
          loadingComplete={loadingComplete}
          playIntro={playIntro}
          onEnter={enterExperience}
          onReveal={startFlythrough}
          onDismiss={releaseIntro}
        />
      )}

    </>
  );
}
