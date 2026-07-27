"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { hallwayPhotos } from "@/lib/content";
import { Frame } from "@/components/Frame";
import { Loader } from "@/components/motion/Loader";
import { IntroEscape } from "@/components/motion/IntroEscape";
import { CurvedMarqueeHero } from "@/components/motion/CurvedMarqueeHero";
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
import { INTRO_SEEN_KEY, shouldUseStaticBaseline } from "@/lib/motion-prefs";
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
  const isDesktop = useClientValue(() => window.matchMedia("(min-width: 1024px)").matches, true);
  const seenIntro = useClientValue(hasSeenIntro, true);
  const shouldPlay = !disableHallway && !seenIntro;
  const [revealDone, setRevealDone] = useState(false);
  const [entering, setEntering] = useState(false);

  const flying = isDesktop ? hallwayPhotos : hallwayPhotos.slice(0, MOBILE_FLY_COUNT);
  const maxScale = isDesktop ? 3.2 : 2.4;

  // Lock scrolling and hide the hero (it eases in later); the white Loader
  // overlay covers everything until the visitor enters. Nothing scrolls during
  // the intro — the flythrough plays on its own clock as an overlay.
  useLayoutEffect(() => {
    document.documentElement.classList.remove("intro-pending");
    if (!shouldPlay) return;
    document.body.style.overflow = "hidden";
    lenisRef.current?.stop();
    document.getElementById("main")?.setAttribute("aria-busy", "true");
    if (heroWrapRef.current) gsap.set(heroWrapRef.current, { autoAlpha: 0, scale: 0.85 });
    // lenisRef is stable; shouldPlay is the only input that should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPlay]);

  // Hands the page over: hero fully settled at the top, scrolling restored.
  // Shared by the flythrough finishing and by a skip cutting it short.
  const releaseIntro = useCallback(() => {
    lenisRef.current?.start();
    document.body.style.overflow = "";
    document.getElementById("main")?.removeAttribute("aria-busy");
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    if (heroWrapRef.current) {
      gsap.set(heroWrapRef.current, { clearProps: "transform,opacity,visibility" });
    }
    setEntering(false);
    setRevealDone(true);
  }, [lenisRef]);

  // "Enter" clicked. Mount the flythrough overlay (it autoplays on mount) and
  // let the Loader zoom its white field away over it. No scrolling involved.
  const enterExperience = useCallback(() => {
    setEntering(true);
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

  const heroAssets = hallwayPhotos.slice(0, 3).map((p) => p.src);
  const loadingComplete = useAssetsLoaded(heroAssets, !shouldPlay);

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
    onAutoplayProgress: onFlyProgress,
    onAutoplayComplete: releaseIntro,
  });

  // Reduced-motion / Save-Data / lite, and every reload after the first visit:
  // straight to the hero, no intro.
  if (disableHallway || seenIntro) {
    return <CurvedMarqueeHero />;
  }

  return (
    <>
      {/* The hero is present the whole time — it just starts hidden and zoomed
          out, then eases in as the flythrough ends (see onFlyProgress). */}
      <div ref={heroWrapRef} style={{ transformOrigin: "50% 50%", willChange: "transform, opacity" }}>
        <CurvedMarqueeHero />
      </div>

      {/* The flythrough: a fixed overlay of photos flying past on black,
          auto-played (no scroll), fading out as the hero lands beneath it. */}
      {entering && !revealDone && (
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
                    className="h-full w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {entering && !revealDone && <IntroEscape phase="hallway" emphasis onSkip={releaseIntro} />}

      {!revealDone && <Loader loadingComplete={loadingComplete} onEnter={enterExperience} />}
    </>
  );
}
