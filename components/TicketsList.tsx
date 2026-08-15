"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { siteConfig, formatEventDate } from "@/site.config";
import { ticketCta } from "@/lib/cta";
import { GlowButton } from "@/components/GlowButton";

/** Brand pastels only (see the "do not hand-mix new shades" note in
 *  globals.css) — cycled across the placeholder community events. The
 *  flagship card below deliberately breaks the cycle with a neutral, since
 *  it isn't one of the brand's four accent colours. */
const COLORS = ["bg-yellow-pastel", "bg-blue-pastel", "bg-red-pastel", "bg-green-pastel"];
const FLAGSHIP_COLOR = "bg-neutral-200";

// Every card uses the same venue shot (the real IITM Research Park photo
// VenueReveal.tsx uses) rather than inventing per-event photography that
// doesn't exist yet — matches the reference design, which does the same.
const VENUE_IMAGE = { src: "/venue.webp", alt: `${siteConfig.venue.name}, the DevFest Chennai venue` };

type EventCard = {
  key: string;
  title: string;
  date: string;
  description: string;
  cta: { label: string; href?: string; external?: boolean };
  color: string;
};

/**
 * The community events are static placeholders (siteConfig.subEvents). The
 * flagship DevFest 2026 card is built from siteConfig + ticketCta() instead
 * of being hand-written alongside them, so its date and "Get tickets" link
 * can't drift out of sync with the real event — and so it never promises a
 * ticket link that doesn't exist yet (see ticketCta()'s own doc comment).
 */
function buildEvents(): EventCard[] {
  const cards: EventCard[] = siteConfig.subEvents.map((event, i) => ({
    key: event.slug,
    title: event.title,
    date: event.date,
    description: event.description,
    cta: { label: event.ctaLabel },
    color: COLORS[i % COLORS.length],
  }));

  const ticket = ticketCta();
  cards.push({
    key: "devfest-2026",
    title: siteConfig.name,
    date: formatEventDate(siteConfig.date),
    description: `The flagship day — ${siteConfig.chapter}'s main event at ${siteConfig.venue.name}.`,
    cta: ticket.available
      ? { label: ticket.label, href: ticket.href, external: ticket.external }
      : { label: ticket.label },
    color: FLAGSHIP_COLOR,
  });

  return cards;
}

/**
 * Arrow always points toward the image side, trailing the label when the
 * text sits left of it and leading when text sits right of it — mirrors
 * reading order into the photo rather than always pointing the same way.
 * Inert (a <span>, not a link) for any CTA without a real destination yet.
 */
function EventCta({ event, imageOnRight }: { event: EventCard; imageOnRight: boolean }) {
  const label = imageOnRight ? `${event.cta.label} →` : `← ${event.cta.label}`;
  const className = "text-black underline-offset-4 hover:underline";

  if (!event.cta.href) return <span className="text-lg text-black/70 sm:text-xl">{label}</span>;
  if (event.cta.external) {
    return (
      <a href={event.cta.href} target="_blank" rel="noreferrer" className={`text-lg sm:text-xl ${className}`}>
        {label}
      </a>
    );
  }
  return (
    <Link href={event.cta.href} className={`text-lg sm:text-xl ${className}`}>
      {label}
    </Link>
  );
}

/**
 * Desktop: one full-width row per event, alternating which side the photo
 * sits on. The row's height is the TEXT side's natural content height — no
 * min-height anywhere — and the image square (aspect-square, sized off that
 * same height via h-full) simply matches whatever that turns out to be, so
 * it sits sized-to-fit inside the row rather than forcing the row tall
 * around an oversized image.
 *
 * The square is flush against the row's OUTER edge (true right edge of the
 * viewport when the photo side is on the right, true left edge when it's on
 * the left) — its w-1/2 container no longer fills edge-to-edge itself, so
 * the square reads as pushed into that corner with a gutter of the card's
 * own colour between it and the text, rather than spanning the whole half.
 */
function EventRow({ event, imageOnRight }: { event: EventCard; imageOnRight: boolean }) {
  return (
    <div className={`flex items-center ${imageOnRight ? "flex-row" : "flex-row-reverse"} ${event.color}`}>
      <div
        className={`flex flex-1 flex-col gap-4 px-12 py-10 lg:py-14 ${
          imageOnRight ? "items-start text-left" : "items-end text-right"
        }`}
      >
        {/* Reversed when the image is on the left so the date — the
            "shrink-0" trailing element — always lands on THIS block's edge
            nearest the image, not the block's generic "right", which would
            be the far outer edge for a right-side text block. */}
        <div className={`flex w-full items-baseline justify-between gap-4 ${imageOnRight ? "" : "flex-row-reverse"}`}>
          <h2 className="text-4xl font-bold text-black sm:text-5xl lg:text-6xl">{event.title}</h2>
          <span className="shrink-0 text-lg text-black/80 sm:text-xl">{event.date}</span>
        </div>
        <p className="max-w-lg text-lg text-black/80 sm:text-xl">{event.description}</p>
        <EventCta event={event} imageOnRight={imageOnRight} />
      </div>
      {/*
       * A fixed width, not h-full off the row: h-full against a row whose
       * own height is itself derived from its tallest child (this one
       * included) is a circular auto-height dependency flexbox can't always
       * resolve — it collapsed this to a 0×0 box. Anchoring off width
       * instead (aspect-square computes height from it) sidesteps that
       * entirely, and the row's `items-center` (not the old items-stretch)
       * keeps this at its own natural square size instead of being
       * stretched tall and distorted whenever the text side is taller.
       *
       * shrink-0, not w-1/2: a w-1/2 wrapper around a square this much
       * narrower than half the row left ~500px of dead space between the
       * text block and the actual photo, no matter how the text side's
       * padding was tuned. Freed-up width goes to the text block via
       * flex-1. Still flush against the row's own outer edge — it's the
       * outermost flex item, nothing left to justify it away from.
       */}
      <div className="relative aspect-square w-56 shrink-0 sm:w-72 lg:w-96">
        <Image src={VENUE_IMAGE.src} alt={VENUE_IMAGE.alt} fill sizes="(min-width: 1024px) 384px, (min-width: 640px) 288px, 224px" className="object-cover" />
      </div>
    </div>
  );
}

/**
 * Mobile: one event full-screen at a time, ONE card — the colour lives on
 * this outer element, not the text block inside it, so the whole thing
 * (text AND photo) reads as a single coloured card rather than a colour
 * box sitting next to a separate photo box. Text keeps its own natural
 * content height; the photo fills whatever space is left over below it,
 * edge-to-edge, no padding or rounding around it.
 */
function EventPanel({ event }: { event: EventCard }) {
  return (
    <div className={`flex flex-1 flex-col ${event.color}`}>
      <div className="flex flex-col gap-6 px-6 py-10">
        <h2 className="text-4xl font-bold text-black sm:text-5xl">{event.title}</h2>
        <p className="text-xl text-black/80">{event.description}</p>
        <div className="flex items-center justify-between gap-4">
          <EventCta event={event} imageOnRight />
          <span className="text-xl text-black/80">{event.date}</span>
        </div>
      </div>
      <div className="relative flex-1">
        <Image src={VENUE_IMAGE.src} alt={VENUE_IMAGE.alt} fill sizes="100vw" className="object-cover" />
      </div>
    </div>
  );
}

export function TicketsList() {
  const [events] = useState(buildEvents);
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
    <div>
      {/* pt-24: clears the floating home/hamburger buttons (fixed, top: 28px,
          h-11 ≈ 44px tall — see components/HamburgerMenu.tsx's TOP const),
          which sit on top of this bar's own content rather than pushing it
          down, same as every other page's top padding does. */}
      <div className="bg-black px-6 pb-8 pt-24 sm:px-8 sm:pb-10 sm:pt-28">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Pick your event</h1>
      </div>

      {/* Mobile / tablet: one event at a time, like a carousel. Nav controls
          sit above the card (reachable without scrolling), not below it. */}
      <div className="flex min-h-dvh flex-col lg:hidden">
        <div className="flex items-center justify-between gap-4 bg-black px-6 py-5">
          <GlowButton shape="circle" size="md" onClick={prev}>
            <span className="sr-only">Previous event</span>
            <span aria-hidden>←</span>
          </GlowButton>
          {/* Jumps straight to the flagship event — not a label for whichever
              card happens to be showing. */}
          <GlowButton shape="pill" size="md" onClick={() => setIndex(flagshipIndex)}>
            Main event
          </GlowButton>
          <GlowButton shape="circle" size="md" onClick={next}>
            <span className="sr-only">Next event</span>
            <span aria-hidden>→</span>
          </GlowButton>
        </div>
        <EventPanel event={current} />
      </div>

      {/* Desktop: the whole list, stacked, alternating sides. */}
      <div className="hidden lg:block">
        {events.map((event, i) => (
          <EventRow key={event.key} event={event} imageOnRight={i % 2 === 0} />
        ))}
      </div>
    </div>
  );
}
