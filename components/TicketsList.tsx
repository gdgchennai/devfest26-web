"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { siteConfig, shortEventDate, uiCopy, type SubEvent } from "@/site.config";
import { ticketCta } from "@/lib/cta";
import { GlowButton } from "@/components/GlowButton";
import { ArrowGlyph } from "@/components/ArrowGlyph";
import { RollingText } from "@/components/motion/RollingText";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

gsap.registerPlugin(useGSAP);

/** Brand pastels only (see the "do not hand-mix new shades" note in
 *  globals.css) — the default cycle across the community-event cards, used
 *  for any subEvent that doesn't set its own `color` (see SubEvent.color).
 *  The flagship card below deliberately breaks the cycle with a neutral,
 *  since it isn't one of the brand's four accent colours. */
const COLORS = ["bg-yellow-pastel", "bg-blue-pastel", "bg-red-pastel", "bg-green-pastel"];
const FLAGSHIP_COLOR = "bg-yellow-pastel";

// The flagship card's own CTA, deliberately NOT ticketCta().href: that value
// is `/tickets` (this page), which made the flagship "Get tickets" button a
// same-page no-op. This is the one card that should actually sell a ticket,
// so it skips the picker and goes straight to the tier selector.
const FLAGSHIP_TICKET_HREF = "/tickets/select";

// Fallback for events with no real photography yet (see SubEvent's `image`
// doc comment) — the same venue shot VenueReveal.tsx uses.
const VENUE_IMAGE = { src: "/venue.webp", alt: uiCopy.common.venueAlt };

type EventCard = {
  key: string;
  title: string;
  date: string;
  description: string;
  cta: { label: string; href?: string; external?: boolean };
  color: string;
  image: { src: string; alt: string };
};

/**
 * The community events are static placeholders (siteConfig.subEvents). The
 * flagship DevFest 2026 card is built from siteConfig + ticketCta() instead
 * of being hand-written alongside them, so its date and "Get tickets" link
 * can't drift out of sync with the real event — and so it never promises a
 * ticket link that doesn't exist yet (see ticketCta()'s own doc comment).
 */
function buildEvents(): EventCard[] {
  const cards: EventCard[] = siteConfig.subEvents.map((event: SubEvent, i) => ({
    key: event.slug,
    title: event.title,
    date: shortEventDate(event.date),
    description: event.description,
    cta: event.href ? { label: event.ctaLabel, href: event.href, external: true } : { label: event.ctaLabel },
    color: event.color ?? COLORS[i % COLORS.length],
    image: event.image ? { src: event.image, alt: event.title } : VENUE_IMAGE,
  }));

  const ticket = ticketCta();
  cards.push({
    key: "devfest-2026",
    title: siteConfig.name,
    date: shortEventDate(siteConfig.date),
    description: `${uiCopy.ticketsList.flagshipDescriptionPrefix}${siteConfig.chapter}${uiCopy.ticketsList.flagshipDescriptionMiddle}${siteConfig.venue.name}${uiCopy.ticketsList.flagshipDescriptionSuffix}`,
    cta: ticket.available
      ? { label: ticket.label, href: FLAGSHIP_TICKET_HREF, external: false }
      : { label: ticket.label },
    color: FLAGSHIP_COLOR,
    image: { src: "/banner/main.webp", alt: siteConfig.name },
  });

  return cards;
}

/** `plain`: lite mode — same GlowButton, no RollingText (no animation at all
 *  in lite, per its own requirement, and RollingText is a hover animation).
 *  No arrow appended here — each `cta.label` (siteConfig.subEvents' own
 *  `ctaLabel`, or ticketCta().label for the flagship card) carries its own
 *  trailing "→" already, so this used to render a second one on top of it. */
function EventCta({ event, plain = false }: { event: EventCard; plain?: boolean }) {
  const label = plain ? (
    <>{event.cta.label}</>
  ) : (
    <RollingText>{event.cta.label}</RollingText>
  );
  return (
    // shrink-0 + whitespace-nowrap: without them, the flex row this sits in
    // (CTA + date, justify-between) can squeeze this narrower than its
    // content — and RollingText's per-character spans (from SplitText) have
    // no word grouping the way plain text does, so the browser was free to
    // wrap between ANY two of them, including mid-word ("Comin" / "g").
    // shrink-0 stops the squeeze; whitespace-nowrap is the belt-and-braces
    // second guard in case the row is ever narrower than the button itself.
    <span className="shrink-0 whitespace-nowrap">
      {event.cta.href ? (
        <GlowButton
          shape="pill"
          size="sm"
          href={event.cta.href}
          target={event.cta.external ? "_blank" : undefined}
          rel={event.cta.external ? "noreferrer" : undefined}
          textClassName="text-black"
        >
          {label}
        </GlowButton>
      ) : (
        // No real destination yet (e.g. "Coming soon") — still a GlowButton
        // for visual consistency with the rest, just a no-op onClick rather
        // than a link, since GlowButton always needs one or the other.
        <GlowButton shape="pill" size="sm" onClick={() => {}} textClassName="text-black">
          {label}
        </GlowButton>
      )}
    </span>
  );
}

/** `plain`: lite mode — passed straight through to EventCta, and drops the
 *  drop shadow (no motion/depth effects in lite mode, same reasoning). */
function CardFace({ event, plain = false }: { event: EventCard; plain?: boolean }) {
  return (
    // container-type: inline-size turns this box into a query container, so
    // the cqw units below scale continuously with THIS card's actual
    // rendered width — set dynamically in JS (see sizeCard() in
    // TicketsCarouselMotion), not just a handful of Tailwind breakpoints —
    // rather than jumping between a few fixed sizes that stop matching once
    // the card's real width lands between them (or below the smallest one,
    // which is what was clipping the flagship card's text).
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-2xl ${
        plain ? "" : "shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
      } ${event.color}`}
      style={{ containerType: "inline-size" }}
    >
      <div className="relative h-2/5 w-full shrink-0">
        <Image src={event.image.src} alt={event.image.alt} fill sizes="320px" decoding="async" fetchPriority="low" className="object-cover" />
      </div>
      <div className="flex flex-1 flex-col gap-[2cqw] p-[5cqw]">
        <h3 className="text-[clamp(0.95rem,7.5cqw,1.75rem)] font-bold leading-snug text-black">{event.title}</h3>
        <p className="line-clamp-3 text-[clamp(0.75rem,4.4cqw,1.1rem)] text-black/70">{event.description}</p>
        <div className="mb-[6cqw] mt-auto flex items-center justify-between gap-2 text-[clamp(0.75rem,4.2cqw,1.05rem)]">
          <EventCta event={event} plain={plain} />
          <span className="shrink-0 text-black/70">{event.date}</span>
        </div>
      </div>
    </div>
  );
}

/** Shared by both the motion and lite variants. `plain`: lite mode — the
 *  site's actual lite-mode background, --orig-black (#131313), matching
 *  html.lite's own body/--page-bg rule in globals.css ("fully --orig-black,
 *  not the site's usual pure --ink black" — the two are deliberately
 *  different colours). No Tailwind token is registered for --orig-black
 *  (only --ink is, via @theme inline), hence the arbitrary-value class. The
 *  motion variant keeps literal black — this was only ever meant for lite. */
function TicketsTitleBar({ plain = false }: { plain?: boolean }) {
  return (
    // pt-24: clears the floating home/hamburger buttons (fixed, top: 28px,
    // h-11 ≈ 44px tall — see components/HamburgerMenu.tsx's TOP const).
    <div
      className={`shrink-0 px-6 pb-8 pt-24 text-center sm:px-8 sm:pb-10 sm:pt-28 ${
        plain ? "bg-[var(--orig-black)]" : "bg-black"
      }`}
    >
      <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl xl:text-6xl">{uiCopy.ticketsList.heading}</h1>
    </div>
  );
}

/**
 * Ported from GSAP's "Infinite scrolling, dragging, and snapping cards"
 * (https://codepen.io/GreenSock/pen/RwKwLWK) — same seamless-loop technique,
 * same variable names/structure, adapted onto our event data instead of a
 * fixed set of portrait images, and WITHOUT the pen's ScrollTrigger pin: the
 * pen ties the loop to actual page-scroll position (pinning the whole page
 * while you scroll through the cards), which is exactly what this must NOT
 * do — the loop is confined to this section and driven only by the prev /
 * next / Main event buttons (see the useGSAP effect below). The core idea,
 * since it's dense: a `rawSequence` timeline holds one little
 * scale/fade/xPercent animation per card, staggered `spacing` seconds apart,
 * laid down THREE times back to back so a moving window can always see a
 * full set with neighbours on either side. A second timeline, `seamlessLoop`,
 * just scrubs that window across the middle copy (`repeat: -1`,
 * `duration: cycleDuration` so one loop is exactly `spacing * cardCount`),
 * and the buttons only ever move a single `playhead.offset` number, which
 * gets wrapped and fed into that window — no separate "which card" state to
 * keep in sync with the tween.
 *
 * This mirrors the pen's CURRENT buildSeamlessLoop. An earlier port used the
 * pen's older `overlap`/`startTime`/`loopTime` two-tween form, which only
 * yields a `spacing * cardCount` loop when `startTime > overlap*spacing + 1`
 * — true for the pen's 15+ images at spacing 0.1, false for our ~10 cards,
 * where the second tween went negative-duration and stretched the loop to
 * 1.5x. wrapTime then wrapped on the wrong period and jumps (esp. the "Main
 * event" button) landed on the wrong card once `offset` passed one cycle.
 */
function buildSeamlessLoop(items: HTMLElement[], spacing: number, animateFunc: (el: HTMLElement) => gsap.core.Timeline) {
  const cycleDuration = spacing * items.length;
  const rawSequence = gsap.timeline({ paused: true });
  const seamlessLoop = gsap.timeline({
    paused: true,
    repeat: -1,
    onRepeat() {
      // Works around a rare edge-case bug, per the original pen's comment.
      if (this._time === this._dur) this._tTime += this._dur - 0.01;
    },
  });

  // Three copies of every card's animation, end to end. `dur` is one card
  // anim's length (they're all identical) — half of it is how far past the
  // start the window sits so a card is dead-centre at the loop's time 0.
  let dur = 0;
  for (let i = 0; i < items.length * 3; i++) {
    const anim = animateFunc(items[i % items.length]);
    rawSequence.add(anim, i * spacing);
    if (!dur) dur = anim.duration();
  }

  seamlessLoop.fromTo(
    rawSequence,
    { time: cycleDuration + dur / 2 },
    { time: `+=${cycleDuration}`, duration: cycleDuration, ease: "none" },
  );
  return seamlessLoop;
}

function TicketsCarouselMotion() {
  const events = useRef(buildEvents()).current;
  const galleryRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLUListElement>(null);
  // Read by the Prev/Next buttons' onClick — set once the whole apparatus
  // (scrub tween + scrollToOffset) exists, inside useGSAP below.
  const apiRef = useRef<{
    scrub: gsap.core.Tween;
    scrollToOffset: (offset: number) => void;
    jumpToIndex: (index: number) => void;
    spacing: number;
  } | null>(null);
  const flagshipIndex = events.length - 1;

  useGSAP(
    () => {
      const cardsEl = cardsRef.current;
      const stageEl = stageRef.current;
      if (!cardsEl || !stageEl) return;
      // Nested listeners don't keep the narrowing above — copy after the guard.
      const cards = cardsEl;
      const stage = stageEl;

      // Sizes the card off the SMALLER of "what this breakpoint wants" and
      // "what actually fits the stage's real height" — computed here in JS,
      // not via CSS max-height, because max-height on a non-replaced element
      // just clips the aspect-ratio-derived height without shrinking the
      // (explicit) width to match: it silently DISTORTED the ratio instead
      // of preserving it. Setting both width and height explicitly, from
      // the same source number, is the only way to guarantee the 3:4 ratio
      // holds while still fitting inside whatever room the stage actually
      // has (title bar + button row height varies by breakpoint).
      const BREAKPOINT_WIDTHS: [minWidth: number, cardWidth: number][] = [
        [1280, 384], // xl:w-96
        [1024, 320], // lg:w-80
        [640, 256], // sm:w-64
        [0, 224], // w-56
      ];
      function sizeCard() {
        const w = window.innerWidth;
        const desiredWidth = BREAKPOINT_WIDTHS.find(([min]) => w >= min)![1];
        // 0.92: a little breathing room above/below rather than the card
        // touching the stage's edges exactly.
        const maxWidthFromHeight = (stage.clientHeight * (3 / 4)) * 0.92;
        const width = Math.min(desiredWidth, maxWidthFromHeight);
        cards.style.width = `${width}px`;
        cards.style.height = `${(width * 4) / 3}px`;
      }
      sizeCard();
      window.addEventListener("resize", sizeCard);

      const cardEls = gsap.utils.toArray<HTMLElement>(cards.children);
      const spacing = 0.1;
      // ±1 at 76% of card width (the readable centre three); ±2 at 152%
      // and a smaller scale — a peek that there is more deck past the trio.
      const X_TRAVEL = 380;
      gsap.set(cardEls, { xPercent: X_TRAVEL, opacity: 0, scaleX: 0.5, scaleY: 0.5 });

      // Visible window is centre ±2 (five cards). Ease stays at 0 until
      // global t≈0.25 so ±3 never appear; the remainder is power2.out so
      // the ±2 peeks land smaller/dimmer than the neighbours.
      const packEase = (t: number) => {
        const start = 0.48;
        if (t <= start) return 0;
        const u = (t - start) / (1 - start);
        return u * (2 - u);
      };

      const snapTime = gsap.utils.snap(spacing);
      const animateFunc = (element: HTMLElement) => {
        const tl = gsap.timeline();
        // scaleX/scaleY, NOT the `scale` shorthand. buildSeamlessLoop stacks
        // three copies of every card's animation on the same element; near the
        // loop seam a just-finished copy and a starting copy briefly coexist,
        // and under the loop's non-linear seek GSAP's `scale` shorthand leaves
        // scaleX on one and scaleY on the other — the cards flanking the
        // flagship (index 9, right at the seam) rendered horizontally
        // squashed. Tweening the two axes as first-class props keeps them in
        // lockstep.
        tl.fromTo(
          element,
          { scaleX: 0.5, scaleY: 0.5, opacity: 0.5 },
          {
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            zIndex: 100,
            duration: 0.5,
            yoyo: true,
            repeat: 1,
            ease: packEase,
            immediateRender: false,
          },
        ).fromTo(element, { xPercent: X_TRAVEL }, { xPercent: -X_TRAVEL, duration: 1, ease: "none", immediateRender: false }, 0);
        return tl;
      };

      const seamlessLoop = buildSeamlessLoop(cardEls, spacing, animateFunc);
      const playhead = { offset: 0 };
      // prev/next/jumpToIndex and wrapTime all assume "offset ± k*spacing ==
      // move k cards", which holds only while the loop's period is exactly
      // cardEls.length * spacing. Guard in dev in case a future change to
      // buildSeamlessLoop breaks that (an earlier version did — see there).
      if (process.env.NODE_ENV !== "production") {
        const period = cardEls.length * spacing;
        if (Math.abs(seamlessLoop.duration() - period) > 1e-6) {
          console.error(
            `[TicketsList] seamless loop period ${seamlessLoop.duration()} != expected ${period} ` +
              `(cards=${cardEls.length}, spacing=${spacing})`,
          );
        }
      }
      const wrapTime = gsap.utils.wrap(0, seamlessLoop.duration());

      const scrub = gsap.to(playhead, {
        offset: 0,
        onUpdate() {
          seamlessLoop.time(wrapTime(playhead.offset));
        },
        duration: 0.85,
        ease: "power2.inOut",
        paused: true,
      });

      // Eases the playhead to the nearest card position — no ScrollTrigger,
      // no page scroll position involved at all. wrapTime() (used inside
      // scrub's onUpdate above) already wraps ANY offset, positive or
      // negative, onto a valid spot on the repeating seamlessLoop timeline,
      // so "infinite" here falls straight out of that wrap — it never
      // needed to be tied to how far the PAGE has scrolled.
      function scrollToOffset(offset: number, duration = 0.85) {
        scrub.vars.offset = snapTime(offset);
        scrub.duration(duration);
        scrub.invalidate().restart();
      }

      // Each card owns exactly one `spacing`-sized slot on the timeline (see
      // buildSeamlessLoop's `time = i * spacing`), so the currently-centred
      // card's index is just the offset in units of spacing, wrapped to the
      // real card count — no separate "which card is showing" state to keep
      // in sync with the tween. Shorter path (forward or back) so "Main
      // event" does not spin the long way around the deck; duration scales
      // with steps so a one-card nudge stays snappy and a longer jump still
      // eases the target into the middle.
      function jumpToIndex(targetIndex: number) {
        const n = cardEls.length;
        const current = Math.round((scrub.vars.offset as number) / spacing);
        const currentIndex = ((current % n) + n) % n;
        let delta = ((targetIndex - currentIndex) % n + n) % n;
        if (delta > n / 2) delta -= n;
        const steps = Math.abs(delta);
        scrollToOffset((scrub.vars.offset as number) + delta * spacing, 0.7 + Math.min(steps, 4) * 0.18);
      }

      // Horizontal swipe / click-drag on the stage. Axis-locked: a mostly
      // vertical gesture is left to the page (this used to fight scroll).
      // Buttons/links inside a card are ignored so CTAs still click.
      let pointerId: number | null = null;
      let originX = 0;
      let originY = 0;
      let lastX = 0;
      let lastT = 0;
      let vel = 0;
      let axis: "h" | "v" | null = null;
      let didDrag = false;

      function onPointerDown(e: PointerEvent) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if ((e.target as HTMLElement).closest("a,button")) return;
        pointerId = e.pointerId;
        originX = lastX = e.clientX;
        originY = e.clientY;
        lastT = performance.now();
        vel = 0;
        axis = null;
        didDrag = false;
        stage.setPointerCapture(e.pointerId);
      }

      function onPointerMove(e: PointerEvent) {
        if (e.pointerId !== pointerId) return;
        const dx = e.clientX - originX;
        const dy = e.clientY - originY;
        if (!axis) {
          if (Math.hypot(dx, dy) < 8) return;
          axis = Math.abs(dx) > Math.abs(dy) * 1.1 ? "h" : "v";
          if (axis === "h") scrub.pause();
        }
        if (axis !== "h") return;
        e.preventDefault();
        didDrag = true;
        const now = performance.now();
        const d = e.clientX - lastX;
        vel = d / Math.max(1, now - lastT);
        lastX = e.clientX;
        lastT = now;
        const w = cards.offsetWidth || 1;
        playhead.offset += (-d / w) * spacing;
        scrub.vars.offset = playhead.offset;
        seamlessLoop.time(wrapTime(playhead.offset));
      }

      function onPointerUp(e: PointerEvent) {
        if (e.pointerId !== pointerId) return;
        pointerId = null;
        if (axis === "h") {
          const flick = Math.abs(vel) > 0.35 ? (vel < 0 ? spacing : -spacing) : 0;
          scrollToOffset(playhead.offset + flick);
        }
        axis = null;
      }

      function onClickCapture(e: MouseEvent) {
        if (!didDrag) return;
        e.preventDefault();
        e.stopPropagation();
        didDrag = false;
      }

      stage.addEventListener("pointerdown", onPointerDown);
      stage.addEventListener("pointermove", onPointerMove, { passive: false });
      stage.addEventListener("pointerup", onPointerUp);
      stage.addEventListener("pointercancel", onPointerUp);
      stage.addEventListener("click", onClickCapture, true);

      // Laptop trackpads fire `wheel` with deltaX for a two-finger horizontal
      // swipe. Axis-lock the gesture (same idea as pointer drag) so a vertical
      // scroll that carries a little deltaX is not stolen — that was eating
      // page/Lenis scroll and leaving Chrome to treat leftover horizontal
      // overscroll as back/forward. Never stopPropagation: Lenis listens on
      // window. preventDefault only after we have locked to X.
      const galleryEl = galleryRef.current;
      let wheelTimer = 0;
      let wheelAxis: "h" | "v" | null = null;
      let wheelAxisTimer = 0;
      function onWheel(e: WheelEvent) {
        let dx = e.deltaX;
        let dy = e.deltaY;
        if (e.deltaMode === 1) {
          dx *= 16;
          dy *= 16;
        }
        window.clearTimeout(wheelAxisTimer);
        wheelAxisTimer = window.setTimeout(() => {
          wheelAxis = null;
        }, 140);
        if (!wheelAxis) {
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
          // Strict: equal or greater Y is page scroll, not the deck.
          wheelAxis = Math.abs(dx) > Math.abs(dy) * 1.75 ? "h" : "v";
        }
        if (wheelAxis !== "h") return;
        e.preventDefault();
        scrub.pause();
        const w = cards.offsetWidth || 1;
        playhead.offset += (dx / w) * spacing;
        scrub.vars.offset = playhead.offset;
        seamlessLoop.time(wrapTime(playhead.offset));
        window.clearTimeout(wheelTimer);
        wheelTimer = window.setTimeout(() => scrollToOffset(playhead.offset), 90);
      }
      galleryEl?.addEventListener("wheel", onWheel, { passive: false, capture: true });

      apiRef.current = { scrub, scrollToOffset, jumpToIndex, spacing };

      return () => {
        window.removeEventListener("resize", sizeCard);
        window.clearTimeout(wheelTimer);
        window.clearTimeout(wheelAxisTimer);
        galleryEl?.removeEventListener("wheel", onWheel, true);
        stage.removeEventListener("pointerdown", onPointerDown);
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerup", onPointerUp);
        stage.removeEventListener("pointercancel", onPointerUp);
        stage.removeEventListener("click", onClickCapture, true);
      };
    },
    { scope: galleryRef },
  );

  return (
    // flex + h-dvh, not the gallery having its own separate h-dvh below the
    // title bar in normal flow: that left the two stacked taller than one
    // viewport, so the gallery's bottom (where Prev/Next live) started below
    // the fold and needed a scroll before either the buttons or the pin's
    // start point were reachable. This way title (shrink-0) + gallery
    // (flex-1) always add up to exactly one viewport.
    <div className="flex h-dvh flex-col overscroll-x-none">
      <TicketsTitleBar />

      {/* Not pinned to page scroll and not scroll-driven — the page scrolls
          straight past it and the buttons are the only control. Its two
          children are a flex column, not two absolutely-positioned layers
          fighting over top/bottom percentages: that's what was clipping the
          card's own top off (a magic `top-38%` anchor + a big card at a
          short viewport height put the card's top edge above this
          container's top, and overflow-hidden clipped it) and letting the
          button row overlap the card's bottom edge. */}
      <div ref={galleryRef} className="relative flex w-full flex-1 flex-col overflow-hidden overscroll-x-none bg-black">
        {/* The card stage: truly centred (top-1/2/-translate-y-1/2) WITHIN
            this box specifically, not some percentage of the whole gallery
            that also has to leave room for the button row below it. */}
        <div ref={stageRef} className="relative min-h-0 flex-1 cursor-grab touch-pan-y select-none active:cursor-grabbing">
          {/* No width classes / aspect-ratio here — sizeCard() in the
              useGSAP effect sets width+height directly, in px, computed
              together from the same number so the 3:4 ratio is exact
              regardless of how much it had to shrink to fit the stage
              (a plain CSS max-height on an aspect-ratio box clips the
              computed height without reciprocally shrinking the explicit
              width — that distorted the ratio instead of preserving it). */}
          <ul
            ref={cardsRef}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            {events.map((event) => (
              <li key={event.key} className="absolute left-0 top-0 h-full w-full">
                <CardFace event={event} />
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-4 pb-6 pt-4 sm:pb-8">
          <GlowButton
            shape="circle"
            size="md"
            onClick={() =>
              apiRef.current?.scrollToOffset((apiRef.current.scrub.vars.offset as number) - apiRef.current.spacing)
            }
          >
            <span className="sr-only">{uiCopy.ticketsList.previousEventSr}</span>
            <ArrowGlyph direction="left" />
          </GlowButton>
          {/* Jumps straight to the flagship card — not a label for whichever
              card happens to be centred right now. */}
          <GlowButton shape="pill" size="md" onClick={() => apiRef.current?.jumpToIndex(flagshipIndex)}>
            {uiCopy.ticketsList.mainEventLabel}
          </GlowButton>
          <GlowButton
            shape="circle"
            size="md"
            onClick={() =>
              apiRef.current?.scrollToOffset((apiRef.current.scrub.vars.offset as number) + apiRef.current.spacing)
            }
          >
            <span className="sr-only">{uiCopy.ticketsList.nextEventSr}</span>
            <ArrowGlyph direction="right" />
          </GlowButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Lite mode: no GSAP at all — no seamless-loop timeline, no sizeCard() resize
 * apparatus. A single flat card, swapped
 * instantly (plain useState, no eased tween) by the same three buttons —
 * "flat" and "no animation" both literally, not just a lighter-weight
 * version of the motion one. EventCta/CardFace are handed `plain` so the
 * GlowButtons stay (same visual language) but RollingText — a hover
 * animation — doesn't run in lite mode either.
 */
function TicketsCarouselStatic() {
  const events = useRef(buildEvents()).current;
  const [index, setIndex] = useState(0);
  const flagshipIndex = events.length - 1;
  const current = events[index];

  function prev() {
    setIndex((i) => (i - 1 + events.length) % events.length);
  }
  function next() {
    setIndex((i) => (i + 1) % events.length);
  }

  return (
    <div className="flex h-dvh flex-col">
      <TicketsTitleBar plain />

      {/* bg-[var(--orig-black)], not bg-ink: same lite-mode background as
          TicketsTitleBar above (see its own doc comment) — this is the one
          the card stage and button row below actually show through to,
          since neither of them carries its own background colour. */}
      <div className="relative flex w-full flex-1 flex-col overflow-hidden bg-[var(--orig-black)]">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
          {/*
           * h-full, not a guessed dvh fraction: this box's DIRECT PARENT
           * (min-h-0 flex-1 in a flex-col) is already sized by flexbox to
           * the EXACT remaining space after the title bar and button row —
           * whatever that real number is, no estimating required. A fixed
           * WIDTH (w-56 sm:w-64...) with aspect-ratio deriving height was
           * the original bug (computed height could exceed that exact
           * space and get clipped by the ancestor's overflow-hidden); then
           * `h-[min(60dvh,32rem)]` was a step in the right direction but
           * still a GUESS at how tall the title+buttons actually are — one
           * that undershot at some viewport heights and still clipped.
           * h-full has nothing left to guess: it's 100% of a box flexbox
           * already computed precisely. w-auto lets aspect-ratio derive the
           * width from that (the case browsers handle correctly — one
           * explicit axis, one auto); max-w caps it on a short, wide window.
           * overflow-hidden on this flex box is now just a safety net, not
           * doing the real clipping.
           */}
          <div className="aspect-[3/4] h-full w-auto max-w-[24rem]">
            <CardFace event={current} plain />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-4 pb-6 pt-4 sm:pb-8">
          <GlowButton shape="circle" size="md" onClick={prev}>
            <span className="sr-only">{uiCopy.ticketsList.previousEventSr}</span>
            <ArrowGlyph direction="left" />
          </GlowButton>
          {/* Jumps straight to the flagship card — not a label for whichever
              card happens to be centred right now. */}
          <GlowButton shape="pill" size="md" onClick={() => setIndex(flagshipIndex)}>
            {uiCopy.ticketsList.mainEventLabel}
          </GlowButton>
          <GlowButton shape="circle" size="md" onClick={next}>
            <span className="sr-only">{uiCopy.ticketsList.nextEventSr}</span>
            <ArrowGlyph direction="right" />
          </GlowButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Picks between the two above based on lite mode (or reduced-motion, which
 * `shouldUseStaticBaseline` folds in too — same "no heavy motion" gate the
 * rest of the site uses, e.g. HeroSection's CurvedMarqueeHero/StaticHero
 * split). Defaults to the static variant on the server/first paint
 * (`useClientValue`'s serverValue), same reasoning as everywhere else it's
 * used: the SSR-safe baseline, upgraded once the real preference is known.
 */
export function TicketsList() {
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);
  return staticBaseline ? <TicketsCarouselStatic /> : <TicketsCarouselMotion />;
}
