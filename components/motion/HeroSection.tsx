"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { archivePhotos, hallwayPhotos, stackPhotos } from "@/lib/content";
import { Frame } from "@/components/Frame";
import { HeroCopy } from "@/components/motion/HeroCopy";
import { Loader } from "@/components/motion/Loader";
import { IntroEscape, type IntroPhase } from "@/components/motion/IntroEscape";
import { useIntroProgress } from "@/components/motion/useIntroProgress";
import {
  usePhotoHallway,
  cardWidthVw,
  HALLWAY_CORRIDOR_CLASS,
  HALLWAY_CARD_CLASS,
  HALLWAY_BEACON_CLASS,
  HALLWAY_BACKDROP_CLASS,
  HALLWAY_STACK_CLASS,
  HALLWAY_RISE_CLASS,
  STACK_CARD_CLASS,
} from "@/components/motion/usePhotoHallway";
import { useMotion } from "@/components/motion/MotionProvider";
import { EASE_SETTLE, EASE_CURTAIN } from "@/components/motion/eases";
import { INTRO_SEEN_KEY, shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

/** Desktop flies and lands every photo of each role; mobile takes the first few. */
const MOBILE_FLY_COUNT = 6;
const MOBILE_ROW_COUNT = 3;

function hasSeenIntro() {
  return window.sessionStorage.getItem(INTRO_SEEN_KEY) !== null;
}

export function HeroSection() {
  const { lenisRef, curtainRef, curtainEl } = useMotion();

  const sectionRef = useRef<HTMLElement>(null);
  const loaderMaskRef = useRef<HTMLDivElement>(null);

  // Defaults to the static/disabled baseline (matches SSR and the no-JS
  // fallback) and upgrades to the motion hallway once confirmed on the
  // client. Defaulting the other way — motion first, downgrading to
  // StaticHero after hydration for reduced-motion/Save-Data visitors —
  // unmounts an already-pinned ScrollTrigger seconds after creating it,
  // which reliably crashes React's reconciliation (removeChild on a node
  // ScrollTrigger's pin-spacer had already relocated).
  const disableHallway = useClientValue(shouldUseStaticBaseline, true);
  const isDesktop = useClientValue(() => window.matchMedia("(min-width: 1024px)").matches, true);
  const seenIntro = useClientValue(hasSeenIntro, true);
  const shouldPlay = !disableHallway && !seenIntro;
  const [revealDone, setRevealDone] = useState(false);
  const [stackSettled, setStackSettled] = useState(false);

  const { contextSafe } = useGSAP({ scope: sectionRef });

  // Default DOM (see app/page.tsx) is already the fully-settled hero, so a
  // JS failure here just leaves that static page — nothing to unwind. When
  // shouldPlay is true, lock the settled page behind the closed curtain
  // before the user sees it.
  useLayoutEffect(() => {
    if (!shouldPlay) return;

    document.body.style.overflow = "hidden";
    lenisRef.current?.stop();
    document.getElementById("main")?.setAttribute("aria-busy", "true");

    gsap.set(curtainRef.current, { clipPath: "inset(0 0 0 0)", pointerEvents: "auto" });
    // lenis/curtainRef are stable for the component's lifetime; shouldPlay
    // is the only input that should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPlay]);


  // Hands scrolling back to the visitor and marks the intro seen. Shared by the
  // reveal finishing normally and by Skip cutting it short, so both exits leave
  // the page in exactly the same state.
  const releaseIntro = useCallback(() => {
    lenisRef.current?.start();
    document.body.style.overflow = "";
    document.getElementById("main")?.removeAttribute("aria-busy");
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    gsap.set(curtainRef.current, { pointerEvents: "none" });
    setRevealDone(true);
  }, [lenisRef, curtainRef]);

  // contextSafe-wrapping a closure over refs is the documented @gsap/react
  // pattern for callbacks invoked later (here, from useIntroProgress's
  // onSettled) rather than during this render.
  // eslint-disable-next-line react-hooks/refs
  const startReveal = contextSafe(() => {
    const tl = gsap.timeline({ onComplete: releaseIntro });

    // Straight onto the corridor. There used to be a single hero photo that
    // clip-path opened and then dissolved before the hallway appeared — a beat
    // that made the loader hand off to *one picture* rather than to the space
    // the whole intro is about. The curtain now reveals the corridor itself,
    // already populated (see PRIMED), with no intermediate image.
    tl.to(loaderMaskRef.current, { yPercent: -110, duration: 0.62, ease: EASE_SETTLE }, 0)
      .to(curtainRef.current, { clipPath: "inset(0 0 100% 0)", duration: 1.1, ease: EASE_CURTAIN }, 0.14);
  });


  // Skip during the wait cuts the reveal to its finished state rather than
  // playing it out; skip once the hallway is running jumps past it to the page.
  // eslint-disable-next-line react-hooks/refs
  const skipReveal = contextSafe(() => {
    gsap.killTweensOf([curtainRef.current, loaderMaskRef.current]);
    gsap.set(curtainRef.current, { clipPath: "inset(0 0 100% 0)" });
    // Deliberately does not reveal the copy: skipping the wait drops you at the
    // mouth of the tunnel, not past it. Skipping the tunnel is the other branch
    // of onSkip below.
    releaseIntro();
  });

  const onSkip = useCallback(() => {
    if (!revealDone) {
      skipReveal();
      return;
    }
    // Already through the reveal: the ask is "past the photos", not "past the
    // loader". Lenis owns the scroll, so go through it or ScrollTrigger and the
    // smoother end up disagreeing about where we are.
    const target = document.getElementById("after-hero");
    if (!target) return;
    if (lenisRef.current) lenisRef.current.scrollTo(target);
    else target.scrollIntoView();
  }, [revealDone, skipReveal, lenisRef]);

  // Exactly what is on screen the instant the curtain lifts: the nearest few
  // wall photos plus the front of the stack. Measuring the first three entries
  // of the archive instead meant one visible photo was never waited for, so the
  // corridor could be revealed with a card still undecoded.
  const heroAssets = [...hallwayPhotos.slice(0, 3), ...stackPhotos.slice(0, 1)].map((p) => p.src);
  const { progress, dotColor, showEscapeHatch } = useIntroProgress(
    heroAssets,
    startReveal,
    !shouldPlay,
  );

  // Loading while the curtain is still down, then hallway until the stack
  // lands, at which point there is nothing left to escape from.
  const introPhase: IntroPhase | null = disableHallway
    ? null
    : shouldPlay && !revealDone
      ? "loading"
      : stackSettled
        ? null
        : "hallway";

  // Mobile flies fewer photos, and lands fewer: five across a 390px viewport is
  // ~78px each, too small to read as photographs once they spread into a row.
  const flying = isDesktop ? hallwayPhotos : hallwayPhotos.slice(0, MOBILE_FLY_COUNT);
  const landing = isDesktop ? stackPhotos : stackPhotos.slice(0, MOBILE_ROW_COUNT);
  const maxScale = isDesktop ? 3.2 : 2.4;

  usePhotoHallway({
    containerRef: sectionRef,
    flyCount: flying.length,
    stackCount: landing.length,
    maxScale,
    // Slightly slower per photo on mobile, where there are fewer of them and a
    // shorter section would flick past.
    perItemVh: isDesktop ? 0.3 : 0.34,
    riseToTop: true,
    // The copy's rise is scrubbed by the hook itself; this only drives the
    // escape control, which retires once there is nothing left to skip.
    onPhaseChange: (phase) => setStackSettled(phase === "hero"),
    disabled: disableHallway,
  });

  if (disableHallway) {
    return <StaticHero />;
  }

  return (
    <section ref={sectionRef} className="relative min-h-[100vh] overflow-hidden">
      {/* Every layer below lives INSIDE this wrapper. The wrapper's negative
          z-index makes it a stacking context, so anything left outside it —
          the backdrop was, once — paints over the whole hallway no matter what
          z-index it carries. Ordering within: backdrop 0, beacon 1, stack 2,
          flying photos 10+. */}
      <div className="absolute inset-0 -z-10">
        <div className={HALLWAY_BACKDROP_CLASS} />
        <div className={HALLWAY_BEACON_CLASS} />
        <div className={HALLWAY_CORRIDOR_CLASS}>
          {flying.map((photo, i) => (
            <div
              key={photo.src}
              className={HALLWAY_CARD_CLASS}
              // Varied widths plus each photo's real ratio: identical boxes read
              // as a slideshow, differing sizes read as depth.
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
                sizes="45vw"
                className="h-full w-full"
              />
            </div>
          ))}
        </div>

        {/* The destination. Present from the first frame, approaching in the
            distance, so arriving at it is earned rather than sudden. */}
        <div className={HALLWAY_STACK_CLASS}>
          {landing.map((photo) => (
            <div
              key={photo.src}
              className={STACK_CARD_CLASS}
              style={{ ["--card-ar" as string]: `${photo.width} / ${photo.height}` }}
            >
              <Frame
                src={photo.src}
                alt={photo.description}
                title={photo.title}
                aspectRatio="auto"
                sizes="34vw"
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex min-h-[100vh] flex-col justify-end px-4 pb-16 pt-24 sm:px-8">
        {/* Left half on desktop: the stack parks on the right, so the two share
            the hero instead of the copy sitting on top of the photos. */}
        <div className={`relative lg:max-w-[48%] ${HALLWAY_RISE_CLASS}`}>
          <HeroCopy />
        </div>
      </div>

      {/* The tunnel has no copy, so it needs its own hint that scrolling is
          what moves it. Retires the moment the stack lands. */}
      {!stackSettled && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-xs uppercase tracking-wide text-paper/50">
          Scroll
        </div>
      )}


      {introPhase && (
        <IntroEscape
          phase={introPhase}
          emphasis={introPhase === "hallway" || showEscapeHatch}
          onSkip={onSkip}
        />
      )}

      {shouldPlay &&
        !revealDone &&
        curtainEl &&
        createPortal(<Loader ref={loaderMaskRef} progress={progress} dotColor={dotColor} />, curtainEl)}
    </section>
  );
}

export function StaticHero() {
  const rest = archivePhotos.slice(1);
  return (
    <>
      <section className="relative flex min-h-[85vh] flex-col justify-end overflow-hidden px-4 pb-16 pt-24 sm:px-8">
        <div className="absolute inset-0 -z-10">
          <Frame
            src="/archive/2025-full-house.jpg"
            alt="A speaker facing a packed auditorium at DevFest Chennai 2025."
            title="Full house, 2025"
            aspectRatio="auto"
            preload
            className="h-full w-full"
          />
          <div className="absolute inset-0 bg-ink/65" />
        </div>

        <HeroCopy />
      </section>

      {/* No id="after-hero" here: page.tsx owns that anchor (SkipLink + the
          motion hero's Scroll link target it). Two elements sharing the id in
          the static-baseline render was invalid HTML and an ambiguous target. */}
      <div className="grid grid-cols-2 gap-4 px-4 py-12 sm:grid-cols-3 sm:px-8 lg:grid-cols-4">
        {rest.map((photo) => (
          <Frame key={photo.src} src={photo.src} alt={photo.description} title={photo.title} />
        ))}
      </div>
    </>
  );
}
