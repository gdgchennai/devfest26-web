"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { GlowButton } from "@/components/GlowButton";
import { useMotion } from "@/components/motion/MotionProvider";
import { getHorizontalCueFor, subscribeHorizontalCue } from "@/components/motion/scrollCueRegistry";
import { uiCopy } from "@/site.config";

export type ScrollCueDirection = "down" | "up" | "left" | "right";

/*
 * A single chevron drawn pointing down; every other direction is this same
 * mark rotated, so the four arrows stay pixel-identical in weight and size.
 */
export function ArrowGlyph({ direction }: { direction: ScrollCueDirection }) {
  const rotation = { down: 0, right: -90, up: 180, left: 90 }[direction];
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      style={{ transform: `rotate(${rotation}deg)`, transition: "transform 220ms ease" }}
    >
      <path
        d="M5 9l7 7 7-7"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ScrollCueButtonProps = {
  direction: ScrollCueDirection;
  label: string;
  visible: boolean;
  onClick: () => void;
  className?: string;
  /** Responsive size: md base (mobile proportions), scales to lg on desktop */
  responsiveSize?: boolean;
};

/*
 * One glass, circular scroll-cue button. Visibility is a fade+scale rather
 * than unmounting, so it never steals focus/layout when it reappears, and
 * pointer-events are dropped while hidden so an invisible button can't still
 * eat clicks (or keyboard focus) meant for the page beneath it.
 */
export function ScrollCueButton({ direction, label, visible, onClick, className = "", responsiveSize = true }: ScrollCueButtonProps) {
  return (
    <div
      className={`fixed z-40 transition-all duration-300 ease-out ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      } ${className}`}
      aria-hidden={!visible}
    >
      <GlowButton
        shape="circle"
        // Mobile-first: md (h-11 w-11) on phones, scales to lg (h-14 w-14) on desktop.
        // Maintains proportional mobile aesthetic while providing better visibility on larger screens.
        size={responsiveSize ? "md" : "md"}
        onClick={onClick}
        // Hardcoded white, not text-paper: these float over every kind of
        // section backdrop the page has, dark AND light (VenueReveal flips
        // --theme, which --paper is mixed from — see globals.css — to near-
        // black for its light stretch, which read as a near-invisible arrow
        // there). White stays legible against all of them.
        textClassName="text-white"
        // Scale up on desktop: md base → sm:h-14 sm:w-14 for better visibility
        surfaceClassName={responsiveSize ? "sm:h-14 sm:w-14" : ""}
      >
        <span className="sr-only">{label}</span>
        <ArrowGlyph direction={direction} />
      </GlowButton>
    </div>
  );
}

/** Every top-level homepage section is wrapped in one of these (see app/page.tsx). */
const SECTION_SELECTOR = "[data-scroll-cue-section]";

/** How settled scroll has to have been, in ms, before a cue button reappears —
 *  covers both a user's wheel/touch scroll AND a cue-triggered `lenis.scrollTo`,
 *  since both fire the same Lenis "scroll" event stream. */
const SETTLE_MS = 150;

/**
 * Pixels/second for the horizontal-cue "jump to card/end" scroll, inside a
 * horizontal-cue section (ExpectShowcase's cards, MoodSection's marquee).
 * Deliberately NOT left to Lenis's default (calling `.scrollTo()` with no
 * `duration` makes it lerp-follow instead of tween on a fixed clock) — lerp
 * covers a FIXED FRACTION of the remaining distance every frame, so it moves
 * faster, not slower, the longer the jump is, which reads as a snap-cut
 * rather than something readable while it moves. A normal "next section" hop
 * is short and reads fine on Lenis's own default, hence this only applies
 * inside a horizontal-cue section.
 *
 * A constant SPEED, not a flat DURATION (this used to be a flat 4s,
 * `HORIZONTAL_CUE_SCROLL_SECONDS`): that was tuned for MoodSection's one
 * long "jump to the fully-arrived end" hop, but once ExpectShowcase started
 * stepping one card-width at a time (see scrollToNext/scrollBack) instead of
 * jumping to the row's end, the same flat 4 seconds made a single short
 * card-hop feel glacial — a fixed time applied to a much shorter distance is
 * a slower APPARENT speed, not the same one. Dividing distance by a constant
 * speed instead keeps the pace itself consistent regardless of which of the
 * two it's animating: a short card hop finishes quickly, a long marquee jump
 * still takes proportionally longer, same as it always did.
 */
const HORIZONTAL_CUE_PIXELS_PER_SECOND = 1400;
/** However short or long the actual jump is, keep it in this range — never
 *  quite an instant cut, never a multi-second crawl. */
const HORIZONTAL_CUE_MIN_SECONDS = 0.25;
const HORIZONTAL_CUE_MAX_SECONDS = 3;

function horizontalCueDuration(fromY: number, toY: number, pixelsPerSecond = HORIZONTAL_CUE_PIXELS_PER_SECOND): number {
  const seconds = Math.abs(toY - fromY) / pixelsPerSecond;
  return Math.min(HORIZONTAL_CUE_MAX_SECONDS, Math.max(HORIZONTAL_CUE_MIN_SECONDS, seconds));
}

/**
 * Passing a `duration` without an `easing` makes Lenis fall back to its own
 * default — `1.001 - 2**(-10t)`, an exponential ease-OUT that races through
 * most of the distance early and spends a long tail crawling the last bit.
 * That reads as "fast, then slows down" — the opposite of the point here,
 * which is to hold a readable, CONSTANT pace across the whole jump so
 * there's no fast stretch to blink through. Linear is what "constant pace"
 * literally means; nothing fancier is needed for a single fixed-distance
 * scroll like this.
 */
const LINEAR_EASING = (t: number) => t;

/** Below this scrollY, "back" has nowhere useful left to send you — still
 *  the hero, whether or not it's also the top of the page. */
const BACK_VISIBLE_THRESHOLD_VH = 0.6;

/**
 * The site's one floating scroll-cue: a "forward" button (down-arrow, or
 * right-arrow while a horizontal-cue section — the pinned About-DevFest card
 * row, or MoodSection's marquee — is the active section) bottom-center, and
 * a "back to top" button (up-arrow, or left-arrow in that same section)
 * bottom-right. The plain "next section" hop is an ordinary Lenis
 * `scrollTo` — no forced duration, so the motion is the exact same
 * smoothing a visitor's own wheel/trackpad scroll gets, not a hard cut. The
 * horizontal-cue "next card" hop is the one exception, on an explicit
 * duration instead (see HORIZONTAL_CUE_SCROLL_SECONDS) — that jump can cover
 * a whole pinned card row or marquee's width, long enough that Lenis's
 * default lerp-follow read as a snap rather than something readable while it
 * moves. Renders nothing under reduced-motion/lite: there is no Lenis
 * instance in that world, and a button promising "smooth" scroll would be
 * lying about the very thing it's for.
 */
export function ScrollCueController() {
  const { lenisRef, staticBaseline } = useMotion();
  const pathname = usePathname();
  const sectionsRef = useRef<HTMLElement[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [, forceTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const settleTimer = useRef<number | undefined>(undefined);

  // Guards every direct `window`/`document` read in the render body below —
  // staticBaseline's own SSR default is `false` (see MotionProvider), so this
  // component WOULD otherwise attempt a full render on the server.
  useEffect(() => setMounted(true), []);

  // Re-runs on every route change, not just once: this controller lives in
  // the root layout and never unmounts across client-side navigation, so
  // without `pathname` in the deps it kept whichever homepage section (and
  // `activeIndex`) was active when you clicked away — e.g. the forward
  // "Scroll to next section" cue would still render on /tickets, which has
  // no `data-scroll-cue-section` markers at all, because the stale index
  // from "/" never got cleared. Resetting first, unconditionally, is what
  // makes a section-less page correctly show no forward cue rather than
  // whatever it last was.
  useEffect(() => {
    sectionsRef.current = [];
    setActiveIndex(-1);
    if (staticBaseline) return;

    const sections = Array.from(document.querySelectorAll<HTMLElement>(SECTION_SELECTOR));
    sectionsRef.current = sections;
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = sections.indexOf(entry.target as HTMLElement);
          if (index !== -1) setActiveIndex(index);
        }
      },
      // A thin band at viewport centre: whichever section is crossing the
      // middle of the screen right now is "active", same technique as a
      // scroll-spy nav highlight.
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    sections.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [staticBaseline, pathname]);

  useEffect(() => {
    if (staticBaseline) return;
    return subscribeHorizontalCue(() => forceTick((n) => n + 1));
  }, [staticBaseline]);

  useEffect(() => {
    if (staticBaseline) return;
    const onScroll = () => {
      setIsScrolling(true);
      setScrollY(window.scrollY);
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setIsScrolling(false), SETTLE_MS);
    };

    // lenisRef.current is only populated once MotionProvider's OWN mount
    // effect runs — and effects fire children-first, so this component's
    // effects (it's a sibling of <main>/<Footer> inside MotionProvider) run
    // BEFORE that parent effect does. A plain `if (!lenis) return` here would
    // permanently miss the instance. Polling one rAF at a time until it
    // exists is cheap (it only ever takes a frame or two) and self-cancels
    // via the cleanup below either way.
    let raf = 0;
    let attached: typeof lenisRef.current = null;
    const tryAttach = () => {
      const lenis = lenisRef.current;
      if (!lenis) {
        raf = requestAnimationFrame(tryAttach);
        return;
      }
      attached = lenis;
      setScrollY(window.scrollY);
      lenis.on("scroll", onScroll);
    };
    tryAttach();

    return () => {
      cancelAnimationFrame(raf);
      attached?.off("scroll", onScroll);
      window.clearTimeout(settleTimer.current);
    };
  }, [staticBaseline, lenisRef]);

  const scrollToNext = useCallback(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    const activeEl = sectionsRef.current[activeIndex];
    const cue = getHorizontalCueFor(activeEl);

    if (cue) {
      // activeIndex() is the NEAREST card, not "the card we're currently
      // sitting on" — right at the very start of the section (e.g. the
      // heading still showing, before card 0 has actually slid into
      // centre), 0 is already the nearest card, so a naive `+1` here landed
      // on card 1, skipping card 0 outright. Comparing against where that
      // nearest card actually IS tells the two cases apart: still
      // approaching it (target: arrive there) vs. already there (target:
      // the one after).
      const nearest = cue.activeIndex();
      const nearestY = cue.scrollYForCard(nearest);
      const target = window.scrollY < nearestY - 1 ? nearest : nearest + 1;
      if (target < cue.cardCount) {
        const targetY = cue.scrollYForCard(target);
        lenis.scrollTo(targetY, {
          duration: horizontalCueDuration(window.scrollY, targetY, cue.pixelsPerSecond),
          easing: LINEAR_EASING,
        });
        return;
      }
    }
    const next = sectionsRef.current[activeIndex + 1];
    if (next) {
      lenis.scrollTo(next);
      return;
    }
    // No further tracked section — SeeYouThereSection is the last
    // `data-scroll-cue-section` in app/page.tsx, but the Footer beneath it
    // is rendered in the root layout, not that page, so it was never part
    // of `sections`. On the last section, "forward" has to mean "the actual
    // bottom of the document" (the footer) rather than a no-op.
    lenis.scrollTo(document.documentElement.scrollHeight);
  }, [activeIndex, lenisRef]);

  // Mirrors scrollToNext: one card back when there's a previous card in the
  // active horizontal-cue section, otherwise the button's other job — back
  // to the very top of the page. Previously this always scrolled to the top
  // regardless of what the button's own "left" (previous-card) glyph
  // promised, so clicking it inside e.g. ExpectShowcase jumped clean out of
  // the card row instead of stepping back one card.
  const scrollBack = useCallback(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    const activeEl = sectionsRef.current[activeIndex];
    const cue = getHorizontalCueFor(activeEl);

    if (cue) {
      // Mirrors scrollToNext's own nearest-vs-arrived distinction (see
      // there): if we've already scrolled PAST the nearest card (on our way
      // toward the one after it), "back" returns to the nearest card
      // itself; only once actually there does "back" step to the one
      // before it.
      const nearest = cue.activeIndex();
      const nearestY = cue.scrollYForCard(nearest);
      const target = window.scrollY > nearestY + 1 ? nearest : nearest - 1;
      // cue.minIndex, not a hardcoded 0 (or -1): a cue with its own entry
      // position below index 0 (ExpectShowcase's heading state) should step
      // there first, one position at a time like every other step this
      // function takes — but a cue without one (MoodSection, whose own
      // index 0 already IS its entry — see HorizontalCue's own doc comment)
      // must NOT accept -1 here, or scrollYForCard(-1) would just resolve
      // to the exact same position as index 0 and this "back" click would
      // silently do nothing instead of leaving the section as it should.
      if (target >= cue.minIndex) {
        const targetY = cue.scrollYForCard(target);
        lenis.scrollTo(targetY, {
          duration: horizontalCueDuration(window.scrollY, targetY, cue.pixelsPerSecond),
          easing: LINEAR_EASING,
        });
        return;
      }
    }
    // Previous SECTION, not literally back to the top of the page — this
    // used to always jump to scrollY 0 regardless of how many sections lay
    // between here and there, which was fine as a last resort (there was no
    // per-card stepping to fall out of) but wrong once "up" is meant to be
    // one step at a time like the forward direction already is (see
    // scrollToNext's own "next section" fallback, which this now mirrors).
    const previous = sectionsRef.current[activeIndex - 1];
    if (previous) {
      lenis.scrollTo(previous);
      return;
    }
    // No section behind this one (the hero) — nothing left but the literal
    // top, which is where the hero already sits anyway.
    lenis.scrollTo(0);
  }, [activeIndex, lenisRef]);

  if (staticBaseline || !mounted) return null;

  const sections = sectionsRef.current;
  const activeEl = sections[activeIndex];
  const cue = getHorizontalCueFor(activeEl);
  const inHorizontal = !!cue;
  const cardIndex = inHorizontal && cue ? cue.activeIndex() : -1;
  const onLastCard = !inHorizontal || !cue || cardIndex >= cue.cardCount - 1;
  const onFirstCard = inHorizontal && cue ? cardIndex <= cue.minIndex : false;

  const forwardDirection: ScrollCueDirection = inHorizontal && !onLastCard ? "right" : "down";
  const isLastSection = activeIndex !== -1 && activeIndex === sections.length - 1;
  // On the last tracked section, "forward" still has somewhere to go — the
  // footer, past the end of `sections` (see scrollToNext) — right up until
  // scroll has actually reached the bottom of the document. Only then is
  // there genuinely nowhere further, same reasoning as backVisible's own
  // "nowhere useful left to send you" threshold below.
  const atPageBottom = scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
  const forwardHasTarget = forwardDirection === "right" || !isLastSection || !atPageBottom;
  const forwardVisible = !isScrolling && activeIndex !== -1 && forwardHasTarget;

  // "left" for every position down to the cue's own minIndex — there,
  // "back" doesn't mean "previous card/entry" (there isn't one), it means
  // the same thing it does outside a horizontal-cue section entirely: up,
  // to the previous section.
  const backDirection: ScrollCueDirection = inHorizontal && !onFirstCard ? "left" : "up";
  const backVisible = !isScrolling && scrollY > window.innerHeight * BACK_VISIBLE_THRESHOLD_VH;

  // Hero (the very first section) keeps the forward button dead-centre, and
  // the last section (the footer beat) keeps the back button dead-centre —
  // both untouched from where they started. Everywhere in between, the two
  // buttons split to opposite edges: back left, forward right.
  const isHero = activeIndex === 0;
  const forwardPositionClass = isHero ? "left-1/2 -translate-x-1/2" : "right-4 sm:right-8";
  const backPositionClass = isLastSection ? "left-1/2 -translate-x-1/2" : "left-4 sm:left-8";

  return (
    <>
      <ScrollCueButton
        direction={forwardDirection}
        label={forwardDirection === "right" ? uiCopy.scrollCue.nextCardLabel : uiCopy.scrollCue.scrollToNextSectionLabel}
        visible={forwardVisible}
        onClick={scrollToNext}
        className={`bottom-6 sm:bottom-8 ${forwardPositionClass}`}
      />
      <ScrollCueButton
        direction={backDirection}
        label={backDirection === "left" ? uiCopy.scrollCue.previousCardLabel : uiCopy.scrollCue.previousSectionLabel}
        visible={backVisible}
        onClick={scrollBack}
        className={`bottom-6 sm:bottom-8 ${backPositionClass}`}
      />
    </>
  );
}
