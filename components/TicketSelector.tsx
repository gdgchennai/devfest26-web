"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { TiltCard } from "@/components/TiltCard";
import { siteConfig } from "@/site.config";
import type { TicketTier } from "@/site.config";

/**
 * A single "I'm a ___" / "and I identify as ___" choice. Renders as an
 * underlined label with a caret; clicking it opens a pastel panel of options
 * directly below, styled after the brand's dropdown reference — not a native
 * `<select>`, since a native popup can't take the rounded pastel treatment
 * consistently across browsers.
 */
function TicketDropdown({
  label,
  value,
  options,
  onChange,
  panelClassName,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  panelClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [labelWidth, setLabelWidth] = useState<number>();

  const longestLabel = options.reduce((longest, o) => (o.label.length > longest.length ? o.label : longest), "");

  // Measured in real pixels, not estimated from character count (a `ch`
  // guess overshot the actual text, which is why this field looked wider
  // than the widest option actually needs). Re-measured on resize since the
  // sm: breakpoint bumps the font size.
  useLayoutEffect(() => {
    function measure() {
      if (measureRef.current) setLabelWidth(measureRef.current.offsetWidth);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [longestLabel]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        // No visible label yet to name the control until something's picked —
        // aria-label carries "I'm a"/"and I identify as" for assistive tech.
        aria-label={current ? undefined : label}
        className="flex items-center gap-2 border-b-2 border-paper/70 pb-1 text-2xl font-semibold text-paper transition-colors hover:border-paper sm:text-3xl"
      >
        {/* Invisible twin of the longest option — out of flow, so it never
            affects layout — measured via ref above to size the blank/filled
            label below to exactly that option's rendered width, so nothing
            shifts once a value is picked. */}
        <span ref={measureRef} aria-hidden className="pointer-events-none absolute whitespace-nowrap opacity-0">
          {longestLabel}
        </span>
        <span
          className="inline-block text-left"
          style={labelWidth !== undefined ? { width: labelWidth } : undefined}
        >
          {current?.label ?? " "}
        </span>
        <span aria-hidden className={`inline-block transition-transform ${open ? "-rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className={`absolute left-0 top-full z-20 mt-3 min-w-[15rem] overflow-hidden rounded-3xl text-black shadow-xl ${panelClassName}`}
        >
          {options.map((opt, i) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`block w-full px-8 py-4 text-center text-lg font-semibold hover:bg-black/5 ${
                  i < options.length - 1 ? "border-b border-black/15" : ""
                } ${opt.value === value ? "underline" : ""}`}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A high z-index only wins WITHIN its own stacking context — and there are
 * several ancestors between the stub and `<body>` that each cap one open
 * with an explicit z-index of their own: TicketStack's `.ticket-fan__card`
 * (its own inline transform + z-index) and the ticket-select page's own
 * `.ticket-select-lift` wrapper (z-10, there to sit above BracketsField's
 * fixed 3D backdrop) both trap anything inside them below the fixed
 * header's z-50, no matter how high THIS element's own z-index goes. Rather
 * than hardcode those two selectors — fragile the next time either
 * component's structure changes — this walks every ancestor up to `<body>`
 * and raises any that already caps its own stacking context (a computed
 * z-index other than "auto"), so the stub's flip always ends up above
 * everything else on the page regardless of what sits between them.
 */
function raiseStackingAncestors(el: HTMLElement, zIndex = 9999) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).zIndex !== "auto") gsap.set(node, { zIndex });
  }
}

/**
 * The Buy button's tear-open transition: the ticket splits apart along its
 * own perforation (the body sliding one way, the stub the other — see
 * .ticket-tier-card__body/__end in globals.css, each its own fully painted
 * piece so neither goes blank once it moves past where the two used to
 * touch). The body half stays exactly where the tear left it — it's never
 * hidden. The stub itself is a real two-sided flip card (see
 * .ticket-tier-card__end-flip below): its front is the actual ticket content,
 * its back is a plain white face, and rotating the whole thing past 90°
 * swaps which one `backface-visibility: hidden` shows — so it's the ACTUAL
 * torn-off piece that becomes the white flash as it flips, not a separate
 * box appearing over it. Only once it's fully rotated and scaled up does the
 * page actually navigate.
 *
 * No portal, no `position: fixed`: nothing between here and `<body>` sets
 * `overflow: hidden` any more (see the .ticket-tier-card comment in
 * globals.css), so the flip wrapper is free to scale up in place — as a
 * plain `position: relative` element, it never runs into the
 * `TiltCard`-transform-as-containing-block problem that only affects
 * `position: fixed`/`absolute` descendants.
 */
function useTicketTearTransition(href: string) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const endFlipRef = useRef<HTMLDivElement>(null);
  const tearingRef = useRef(false);

  function handleBuyClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (tearingRef.current) return;

    const body = bodyRef.current;
    const endFlip = endFlipRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!body || !endFlip || reduceMotion) {
      window.location.href = href;
      return;
    }

    tearingRef.current = true;

    const bodyRect = body.getBoundingClientRect();
    const endRect = endFlip.getBoundingClientRect();
    // Which side of the perforation the stub is actually on right now — a
    // side-by-side row on desktop, stacked on mobile (see .ticket-tier-card's
    // own flex-direction breakpoint) — so the split below pulls apart along
    // the right axis in both layouts instead of always assuming the desktop
    // one.
    const isRowLayout = endRect.left >= bodyRect.right - 1;

    gsap
      .timeline({ onComplete: () => window.location.assign(href) })
      // Stage 1 — the two halves visibly rip apart along the perforation: a
      // clear, unhurried separation (each moving its own way, slightly
      // rotating as if still hinged at the torn edge) with the dark page
      // showing through the growing gap between them, before anything else
      // happens. This is the part that has to actually read as "torn" —
      // everything after it is just the stub taking its own path away.
      .to(
        body,
        {
          x: isRowLayout ? -56 : -14,
          y: isRowLayout ? 26 : -56,
          rotation: isRowLayout ? -9 : 9,
          duration: 0.55,
          ease: "power2.out",
        },
        0,
      )
      .to(
        endFlip,
        {
          x: isRowLayout ? 56 : 14,
          y: isRowLayout ? -26 : 56,
          rotation: isRowLayout ? 9 : -9,
          duration: 0.55,
          ease: "power2.out",
        },
        0,
      )
      // Stage 2 — only once that split is clearly visible: lift the stub
      // above everything else on the page (the fixed header included), then
      // flip it edge-on — its white back face takes over right as its own
      // content face rotates out of view — while zooming it up until it's
      // the only thing left on screen. The body half is untouched from here
      // on; it just stays put, torn but visible.
      .add(() => {
        gsap.set(endFlip, { transformPerspective: 1000, zIndex: 9999 });
        raiseStackingAncestors(endFlip);
      })
      .to(endFlip, { rotationY: 180, scale: 45, duration: 0.85, ease: "power3.in" });
  }

  return { bodyRef, endFlipRef, handleBuyClick };
}

/** Turns a brand pastel Tailwind class ("bg-blue-pastel") into its full-tone
 *  custom-property reference ("var(--blue)") — the border color each ticket
 *  uses instead of a fixed blue, so a yellow tier gets a yellow border, etc. */
function accentVarFromPastelClass(pastelClass: string): string {
  const hue = pastelClass.replace(/^bg-/, "").replace(/-pastel$/, "");
  return `var(--${hue})`;
}

/**
 * The ticket itself — same perforated-seam language as components/TicketStub.tsx,
 * but a light brand-pastel surface with dark ink text (this page reads as a
 * physical paper ticket, not the homepage's glass ticket stub), since `tier.color`
 * can be any one of the four brand pastels.
 *
 * `tier.color` is applied to __body and __end SEPARATELY, not to this outer
 * div — the tear transition (useTicketTearTransition above) translates the
 * body and the __end-flip wrapper apart as independent pieces, and a shared
 * background/border painted only on this outer div would leave each half
 * blank the moment it moved past this div's own edges. `--tier-accent` (read
 * by .ticket-tier-card__body/__end's border-color in globals.css) is set
 * here instead, since a CSS custom property inherits down to both of them
 * from one place.
 */
function TicketCard({ tier, taxNote }: { tier: TicketTier; taxNote: string }) {
  const { bodyRef, endFlipRef, handleBuyClick } = useTicketTearTransition(tier.href);

  return (
    <div
      className="ticket-tier-card"
      style={{ "--tier-accent": accentVarFromPastelClass(tier.color) } as CSSProperties}
    >
      <div ref={bodyRef} className={`ticket-tier-card__body ${tier.color}`}>
        <h2 className="text-2xl font-bold text-black sm:text-3xl">{tier.title}</h2>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-black/80">
          {tier.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ol>
        <p className="mt-auto pt-6 text-sm text-black/60">{tier.addOnsNote}</p>
      </div>

      <div className="ticket-tier-card__perf" aria-hidden />

      {/* The stub as a two-sided flip card — see useTicketTearTransition's
          own doc comment for why this replaced a separate white overlay. */}
      <div ref={endFlipRef} className="ticket-tier-card__end-flip">
        <div className={`ticket-tier-card__end ${tier.color}`}>
          <p className="text-3xl font-bold text-black">
            {tier.currency} {tier.price}
            <sup className="text-sm font-semibold">*</sup>
          </p>
          <p className="mt-1 text-xs text-black/60">* {taxNote}</p>
          <a
            href={tier.href}
            onClick={handleBuyClick}
            className="mt-4 inline-block rounded-full bg-[var(--tier-accent)] px-6 py-3 text-sm font-medium text-ink hover:opacity-90"
          >
            Buy ticket
          </a>
        </div>
        <div className="ticket-tier-card__end-back" aria-hidden />
      </div>
    </div>
  );
}

/**
 * The front-of-stack card until "I'm a ___" actually has a pick — the same
 * ticket silhouette (rounded corners, perforated seam) as a real tier, sized
 * to match and coloured bg-red-pastel like any other tier (so it's solid
 * enough to fully hide the real tiers fanned behind it), but with a prompt
 * where the details would be instead of a title/features, and nothing at all
 * on the right: no price, no checkout link. Sits in the fan exactly like a
 * real tier (see TicketStack) so picking a profile reads as swapping it out
 * for the real thing, not as a different page section appearing.
 */
function TicketPlaceholder() {
  return (
    <div className="ticket-tier-card" style={{ "--tier-accent": accentVarFromPastelClass("bg-red-pastel") } as CSSProperties}>
      <div className="ticket-tier-card__body ticket-tier-card__body--placeholder items-center justify-center bg-red-pastel text-center">
        <p className="text-2xl font-semibold text-black/70 sm:text-3xl">Pick your details above to find the right ticket</p>
      </div>
      <div className="ticket-tier-card__perf" aria-hidden />
      <div className="ticket-tier-card__end bg-red-pastel" />
    </div>
  );
}

/**
 * The fanned stack: the empty placeholder above plus one card per tier, all
 * sharing one CSS grid cell (see `.ticket-fan` in globals.css) so the
 * container's height always matches whichever card is currently on top,
 * rather than a guessed fixed height. `selectedIndex` is the tier whose
 * `profileKey` matches the current "I'm a ___" pick, or -1 before anything's
 * picked — which is exactly when the placeholder (slot 0 below) belongs in
 * front. Whichever card is in front is flat, full opacity, and wrapped in
 * `TiltCard` for the hover tilt; every other card recedes behind it by its
 * distance from that slot and is `inert` (see below) so it can't be clicked
 * while buried.
 */
function TicketStack({ tiers, selectedIndex, taxNote }: { tiers: TicketTier[]; selectedIndex: number; taxNote: string }) {
  const cards: { key: string; content: ReactNode }[] = [
    { key: "placeholder", content: <TicketPlaceholder /> },
    ...tiers.map((tier) => ({ key: tier.profileKey, content: <TicketCard tier={tier} taxNote={taxNote} /> })),
  ];
  // Slot 0 is the placeholder; a real tier's own index shifts up by one to
  // make room for it.
  const activeSlot = selectedIndex === -1 ? 0 : selectedIndex + 1;

  return (
    <div className="ticket-fan mx-auto w-full max-w-2xl">
      {cards.map(({ key, content }, i) => {
        const offset = i - activeSlot;
        const isActive = offset === 0;

        return (
          <div
            key={key}
            // `inert`, not just aria-hidden: a buried card's own "Buy ticket"
            // link is a real focusable element, and aria-hidden alone hides
            // it from assistive tech while leaving it reachable by Tab —
            // inert removes it from both the a11y tree and the tab order.
            inert={!isActive}
            className="ticket-fan__card transition-transform duration-500 ease-out"
            style={{
              transform: isActive
                ? "translate(0, 0) rotate(0deg) scale(1)"
                : `translate(${offset * 14}px, ${Math.abs(offset) * 8}px) rotate(${offset * 3}deg) scale(0.97)`,
              zIndex: cards.length - Math.abs(offset),
              opacity: isActive ? 1 : 0.6,
            }}
          >
            {isActive ? <TiltCard maxTilt={2.5}>{content}</TiltCard> : content}
          </div>
        );
      })}
    </div>
  );
}

export function TicketSelector() {
  const { profiles, identities, tiers, taxNote } = siteConfig.ticketSelector;
  // Both dropdowns start unpicked — an empty underline, not a preselected
  // value — so nobody's professional status or gender gets assumed for them.
  const [profileKey, setProfileKey] = useState("");
  const [identity, setIdentity] = useState("");

  // -1 before "I'm a ___" has a pick — TicketStack reads that as "show the
  // empty placeholder in front" rather than guessing a tier.
  const selectedIndex = tiers.findIndex((tier) => tier.profileKey === profileKey);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-6 pb-24 pt-28 sm:px-8 sm:pt-32">
      <h1 className="text-4xl font-bold tracking-tight text-paper sm:text-5xl">Get your tickets now</h1>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-6 text-2xl text-paper sm:text-3xl">
        <span>I&apos;m a</span>
        <TicketDropdown
          label="I'm a"
          value={profileKey}
          onChange={setProfileKey}
          options={profiles.map((p) => ({ value: p.key, label: p.label }))}
          panelClassName="bg-yellow-pastel"
        />
        <span>and I identify as</span>
        <TicketDropdown
          label="and I identify as"
          value={identity}
          onChange={setIdentity}
          options={identities.map((i) => ({ value: i, label: i }))}
          panelClassName="bg-green-pastel"
        />
      </div>

      <TicketStack tiers={tiers} selectedIndex={selectedIndex} taxNote={taxNote} />
    </div>
  );
}
