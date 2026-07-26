"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { archivePhotos } from "@/lib/content";
import { Frame } from "@/components/Frame";
import { HeroCopy } from "@/components/motion/HeroCopy";
import { Loader } from "@/components/motion/Loader";
import { StackControls } from "@/components/motion/StackControls";
import { useIntroProgress } from "@/components/motion/useIntroProgress";
import { usePhotoHallway, cardWidthVw, HALLWAY_CARD_CLASS } from "@/components/motion/usePhotoHallway";
import { useMotion } from "@/components/motion/MotionProvider";
import { EASE_SETTLE, EASE_FACTS, EASE_CURTAIN } from "@/components/motion/eases";
import { INTRO_SEEN_KEY, shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

const DESKTOP_COUNT = 12;
const MOBILE_COUNT = 7;

function hasSeenIntro() {
  return window.sessionStorage.getItem(INTRO_SEEN_KEY) !== null;
}

export function HeroSection() {
  const { lenisRef, curtainRef, curtainEl } = useMotion();

  const sectionRef = useRef<HTMLElement>(null);
  const eyebrowRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const factsGroupRef = useRef<HTMLDivElement>(null);
  const frameWrapRef = useRef<HTMLDivElement>(null);
  const imageScaleRef = useRef<HTMLDivElement>(null);
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
    gsap.set(frameWrapRef.current, { clipPath: "inset(38% 34% 38% 34% round 6px)", opacity: 1 });
    gsap.set(imageScaleRef.current, { scale: 1.35 });
    gsap.set([eyebrowRef.current, wordmarkRef.current, taglineRef.current], { yPercent: 110 });
    gsap.set(factsGroupRef.current, { opacity: 0, y: 12 });
    // lenis/curtainRef are stable for the component's lifetime; shouldPlay
    // is the only input that should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPlay]);

  // contextSafe-wrapping a closure over refs is the documented @gsap/react
  // pattern for callbacks invoked later (here, from useIntroProgress's
  // onSettled) rather than during this render.
  // eslint-disable-next-line react-hooks/refs
  const startReveal = contextSafe(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        lenisRef.current?.start();
        document.body.style.overflow = "";
        document.getElementById("main")?.removeAttribute("aria-busy");
        window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
        gsap.set(curtainRef.current, { pointerEvents: "none" });
        setRevealDone(true);
      },
    });

    tl.to(loaderMaskRef.current, { yPercent: -110, duration: 0.62, ease: EASE_SETTLE }, 0)
      .to(curtainRef.current, { clipPath: "inset(0 0 100% 0)", duration: 1.1, ease: EASE_CURTAIN }, 0.14)
      .to(
        frameWrapRef.current,
        { clipPath: "inset(0% 0% 0% 0% round 0px)", duration: 1.25, ease: EASE_SETTLE },
        0.24,
      )
      .to(imageScaleRef.current, { scale: 1, duration: 1.7, ease: EASE_SETTLE }, 0.24)
      .to(
        [eyebrowRef.current, wordmarkRef.current, taglineRef.current],
        { yPercent: 0, duration: 0.9, ease: EASE_SETTLE, stagger: 0.08 },
        0.8,
      )
      .to(factsGroupRef.current, { opacity: 1, y: 0, duration: 0.6, ease: EASE_FACTS }, 1.22)
      // The opened frame hands off to the hallway, which takes over as the
      // scroll backdrop — without this it stays an opaque layer forever,
      // permanently hiding the hallway photos scrolling behind it.
      .to(frameWrapRef.current, { opacity: 0, duration: 0.5, ease: EASE_FACTS }, 1.5);
  });

  const heroAssets = archivePhotos.slice(0, 3).map((p) => p.src);
  const { progress, dotColor, showEscapeHatch } = useIntroProgress(
    heroAssets,
    startReveal,
    !shouldPlay,
  );

  const count = isDesktop ? DESKTOP_COUNT : MOBILE_COUNT;
  const maxScale = isDesktop ? 3.2 : 2.4;
  const hallwayPhotos = archivePhotos.slice(0, count);

  const { cycle } = usePhotoHallway({
    containerRef: sectionRef,
    count,
    maxScale,
    // Slightly slower per photo on mobile, where there are fewer of them and a
    // shorter section would flick past.
    perItemVh: isDesktop ? 0.3 : 0.34,
    onSettledChange: setStackSettled,
    disabled: disableHallway,
  });

  if (disableHallway) {
    return <StaticHero />;
  }

  return (
    <section ref={sectionRef} className="relative min-h-[100vh] overflow-hidden">
      <div className="absolute inset-0 -z-10">
        {hallwayPhotos.map((photo, i) => (
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
        <div className="absolute inset-0 bg-ink/65" />
      </div>

      <div className="relative flex min-h-[100vh] flex-col justify-end px-4 pb-16 pt-24 sm:px-8">
        {/* Only visible during the entry reveal (opacity set to 1 there);
            fades back out once settled so the hallway shows through on scroll. */}
        <div
          ref={frameWrapRef}
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[6px] opacity-0"
        >
          <div ref={imageScaleRef} className="h-full w-full">
            <Frame
              src="/archive/2025-full-house.jpg"
              alt="A speaker facing a packed auditorium at DevFest Chennai 2025."
              title="Full house, 2025"
              aspectRatio="auto"
              preload
              className="h-full w-full"
            />
          </div>
        </div>

        <HeroCopy
          showScrollHint={!stackSettled}
          eyebrowRef={eyebrowRef}
          wordmarkRef={wordmarkRef}
          taglineRef={taglineRef}
          factsRef={factsGroupRef}
        />
      </div>

      <StackControls active={stackSettled} count={count} onCycle={cycle} />

      {shouldPlay &&
        !revealDone &&
        curtainEl &&
        createPortal(
          <Loader ref={loaderMaskRef} progress={progress} dotColor={dotColor} showEscapeHatch={showEscapeHatch} />,
          curtainEl,
        )}
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
