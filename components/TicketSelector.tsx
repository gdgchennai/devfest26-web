"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { TiltCard } from "@/components/TiltCard";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { siteConfig, uiCopy, shortEventDate } from "@/site.config";
import type { Ticket } from "@/site.config";

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
 *
 * Returns every ancestor it touched, together with the exact inline
 * `z-index` each one had before — so the caller can put that back once the
 * flip is undone. One of these ancestors (TicketStack's `.ticket-fan__card`)
 * has its z-index set BY REACT, per its position in the fan, not by CSS —
 * and since raising it here mutates `node.style` directly, bypassing React,
 * a later `clearProps` would remove that inline value outright rather than
 * restoring it: React only reapplies an inline style when the component that
 * set it re-renders, and closing the checkout only re-renders this card, not
 * its TicketStack parent, so the fan's z-order would be gone for good.
 * Capturing and restoring the original value sidesteps that entirely.
 */
function raiseStackingAncestors(el: HTMLElement, zIndex = 9999): { node: HTMLElement; previousZIndex: string }[] {
  const raised: { node: HTMLElement; previousZIndex: string }[] = [];
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).zIndex !== "auto") {
      raised.push({ node, previousZIndex: node.style.zIndex });
      gsap.set(node, { zIndex });
    }
  }
  return raised;
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
 * checkout overlay (the KonfHub widget, in TicketCard) fade in over it —
 * there's no navigation any more, so closing that overlay just reverses this
 * same timeline and the ticket knits itself back together.
 *
 * No portal, no `position: fixed`, for the tear itself: nothing between here
 * and `<body>` sets `overflow: hidden` any more (see the .ticket-tier-card
 * comment in globals.css), so the flip wrapper is free to scale up in place —
 * as a plain `position: relative` element, it never runs into the
 * `TiltCard`-transform-as-containing-block problem that only affects
 * `position: fixed`/`absolute` descendants. (The checkout overlay itself DOES
 * portal to `<body>` — see TicketCard — since IT is a `position: fixed` panel
 * and TiltCard's `perspective` would otherwise trap it.)
 */
function useTicketTearTransition() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const endFlipRef = useRef<HTMLDivElement>(null);
  const tearingRef = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const raisedRef = useRef<{ node: HTMLElement; previousZIndex: string }[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  function handleBuyClick() {
    if (tearingRef.current) return;

    const body = bodyRef.current;
    const endFlip = endFlipRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || shouldUseStaticBaseline();

    // No tear to play — reduced motion, or the refs aren't mounted yet — so
    // the checkout just opens directly rather than skipping straight to a
    // navigation that no longer happens.
    if (!body || !endFlip || reduceMotion) {
      setCheckoutOpen(true);
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

    const tl = gsap.timeline({ onComplete: () => setCheckoutOpen(true) });
    timelineRef.current = tl;

    tl
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
      //
      // Guarded to forward playback only: a function added via `.add()`
      // fires again when the playhead crosses it during `tl.reverse()` too
      // (closeCheckout's undo), and re-running this on the way back would
      // re-raise every ancestor AND recapture their "previous" z-index as
      // whatever it already was — 9999 — permanently stomping the real
      // original value closeCheckout is trying to restore.
      .add(() => {
        if (tl.reversed()) return;
        gsap.set(endFlip, { transformPerspective: 1000, zIndex: 9999 });
        raisedRef.current = raiseStackingAncestors(endFlip);
      })
      .to(endFlip, { rotationY: 180, scale: 45, duration: 0.85, ease: "power3.in" });
  }

  // The close button: hide the checkout, then run the whole tear/flip/zoom
  // backwards so the ticket visibly knits itself back together instead of
  // just vanishing. Nothing to reverse if the checkout opened without a tear
  // (reduced motion / refs not ready) — just drop straight back to idle.
  function closeCheckout() {
    setCheckoutOpen(false);
    const tl = timelineRef.current;
    if (!tl) {
      tearingRef.current = false;
      return;
    }
    tl.eventCallback("onReverseComplete", () => {
      gsap.set(endFlipRef.current, { clearProps: "zIndex,transformPerspective" });
      // Explicit restore, not `clearProps`: see raiseStackingAncestors' own
      // comment for why blindly clearing the fan wrapper's z-index would
      // lose it for good instead of putting it back.
      raisedRef.current.forEach(({ node, previousZIndex }) => {
        if (previousZIndex) gsap.set(node, { zIndex: previousZIndex });
        else gsap.set(node, { clearProps: "zIndex" });
      });
      raisedRef.current = [];
      timelineRef.current = null;
      tearingRef.current = false;
    });
    tl.reverse();
  }

  return { bodyRef, endFlipRef, handleBuyClick, checkoutOpen, closeCheckout };
}

/** Turns a brand pastel Tailwind class ("bg-blue-pastel") into its full-tone
 *  custom-property reference ("var(--blue)") — the border color each ticket
 *  uses instead of a fixed blue, so a yellow tier gets a yellow border, etc. */
function accentVarFromPastelClass(pastelClass: string): string {
  const hue = pastelClass.replace(/^bg-/, "").replace(/-pastel$/, "");
  return `var(--${hue})`;
}

/** One brand pastel per (category, audience) — kept out of the config so a
 *  ticket edit stays pure data. red-pastel is the placeholder's, so it's
 *  avoided here. */
function ticketColor(ticket: Ticket): string {
  if (ticket.audience === "women-diverse") return "bg-green-pastel";
  return ticket.category === "student" ? "bg-yellow-pastel" : "bg-blue-pastel";
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
function TicketCard({
  ticket,
  perks,
  addOnsNote,
  taxNote,
}: {
  ticket: Ticket;
  perks: string[];
  addOnsNote: string;
  taxNote: string;
}) {
  const color = ticketColor(ticket);
  const { bodyRef, endFlipRef, handleBuyClick, checkoutOpen, closeCheckout } = useTicketTearTransition();

  // Escape-to-close and a scroll-locked body while the checkout is open —
  // same pattern as HamburgerMenu's own open panel.
  useEffect(() => {
    if (!checkoutOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeCheckout();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen]);

  return (
    <div
      className="ticket-tier-card"
      style={{ "--tier-accent": accentVarFromPastelClass(color) } as CSSProperties}
    >
      <div ref={bodyRef} className={`ticket-tier-card__body ${color}`}>
        <h2 className="text-2xl font-bold text-black sm:text-3xl">{ticket.name}</h2>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-black/80">
          {perks.map((perk) => (
            <li key={perk}>{perk}</li>
          ))}
        </ol>
        <p className="mt-auto pt-6 text-sm text-black/60">
          On sale until {shortEventDate(ticket.closes)} · {addOnsNote}
        </p>
      </div>

      <div className="ticket-tier-card__perf" aria-hidden />

      {/* The stub as a two-sided flip card — see useTicketTearTransition's
          own doc comment for why this replaced a separate white overlay. */}
      <div ref={endFlipRef} className="ticket-tier-card__end-flip">
        <div className={`ticket-tier-card__end ${color}`}>
          <p className="text-3xl font-bold text-black">
            {ticket.currency} {ticket.price}
            <sup className="text-sm font-semibold">*</sup>
          </p>
          <p className="mt-1 text-xs text-black/60">* {taxNote}</p>
          <button
            type="button"
            onClick={handleBuyClick}
            className="mt-4 inline-block rounded-full bg-[var(--tier-accent)] px-6 py-3 text-sm font-medium text-ink hover:opacity-90"
          >
            {uiCopy.ticketSelector.buyTicketLabel}
          </button>
        </div>
        <div className="ticket-tier-card__end-back" aria-hidden />
      </div>

      {/* Portalled to <body>, not rendered in place: TiltCard's `.tilt-scene`
          sets `perspective`, which (like `transform`) makes a descendant's
          `position: fixed` resolve against IT instead of the viewport — this
          panel needs the real viewport, so it has to sit outside that
          subtree entirely, the same reasoning the tear/flip stub's z-index
          walk (raiseStackingAncestors) exists for. */}
      {checkoutOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9999] flex flex-col bg-white">
            <div className="flex items-center justify-end px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={closeCheckout}
                aria-label={uiCopy.ticketSelector.closeCheckoutLabel}
                className="rounded-full p-2 text-black/60 transition-colors hover:bg-black/5 hover:text-black"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
              <iframe
                src={ticket.href}
                title={`Register for ${ticket.name}`}
                allow="payment"
                // No `allow-top-navigation*`: whatever the widget's checkout
                // flow needs (its own scripts/forms/cookies, a payment
                // gateway popup) stays sandboxed to this frame — none of it
                // can carry the visitor's whole tab away to the KonfHub URL.
                sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-modals"
                className="h-full w-full min-h-[500px] border-0"
              />
            </div>
          </div>,
          document.body,
        )}
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
        <p className="text-2xl font-semibold text-black/70 sm:text-3xl">{uiCopy.ticketSelector.placeholderPrompt}</p>
      </div>
      <div className="ticket-tier-card__perf" aria-hidden />
      <div className="ticket-tier-card__end bg-red-pastel" />
    </div>
  );
}

/** Shown when both dropdowns are picked but nothing in that (category,
 *  audience) pair is currently `visible` — same silhouette as the placeholder,
 *  different copy. */
function TicketClosed() {
  return (
    <div className="ticket-tier-card" style={{ "--tier-accent": accentVarFromPastelClass("bg-red-pastel") } as CSSProperties}>
      <div className="ticket-tier-card__body ticket-tier-card__body--placeholder items-center justify-center bg-red-pastel text-center">
        <p className="text-xl font-semibold text-black/70 sm:text-2xl">{uiCopy.ticketSelector.notOnSalePrompt}</p>
      </div>
      <div className="ticket-tier-card__perf" aria-hidden />
      <div className="ticket-tier-card__end bg-red-pastel" />
    </div>
  );
}

/**
 * The fanned stack: the given `cards` all share one CSS grid cell (see
 * `.ticket-fan` in globals.css) so the container's height always matches
 * whichever card is currently on top, rather than a guessed fixed height.
 * `activeSlot` is the index of the card that should be in front — slot 0 (the
 * placeholder) until both dropdowns are picked, then slot 1 (the resolved
 * ticket, or the "not on sale" card). Whichever card is in front is flat, full
 * opacity, and wrapped in `TiltCard` for the hover tilt; every other card
 * recedes behind it by its distance from that slot and is `inert` (see below)
 * so it can't be clicked while buried.
 */
function TicketStack({
  cards,
  activeSlot,
  staticBaseline,
}: {
  cards: { key: string; content: ReactNode }[];
  activeSlot: number;
  staticBaseline: boolean;
}) {
  // Lite mode: no fanned stack, no shuffle transition, no tilt — just the
  // single active card, mounted plainly. Buried cards aren't rendered at all
  // rather than hidden/inert, since there's no fan for them to peek out of.
  if (staticBaseline) {
    const active = cards[activeSlot];
    return (
      <div className="ticket-fan mx-auto w-full max-w-2xl">
        <div key={active.key} className="ticket-fan__card">
          {active.content}
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-fan mx-auto w-full max-w-2xl">
      {cards.map(({ key, content }, i) => {
        const offset = i - activeSlot;
        const isActive = offset === 0;
        // Clamp the visible fan depth: any card more than two behind sits in
        // the same spot as the third, so the tail stays tight no matter how
        // many tickets are mounted.
        const fanned = Math.sign(offset) * Math.min(Math.abs(offset), 2);

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
                : `translate(${fanned * 14}px, ${Math.abs(fanned) * 8}px) rotate(${fanned * 3}deg) scale(0.97)`,
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

/** Which ticket `audience` each "and I identify as ___" option maps to. The
 *  "for women & diverse groups" tickets cover Female and Non binary; Male and
 *  "Prefer not to say" get the general ticket. */
const AUDIENCE_BY_IDENTITY: Record<string, Ticket["audience"]> = {
  Female: "women-diverse",
  "Non binary": "women-diverse",
  Male: "all",
  "Prefer not to say": "all",
};

export function TicketSelector() {
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);
  const { profiles, identities, tickets, perks, taxNote, addOnsNote } = siteConfig.ticketSelector;
  // Both dropdowns start unpicked — an empty underline, not a preselected
  // value — so nobody's professional status or gender gets assumed for them.
  const [profileKey, setProfileKey] = useState("");
  const [identity, setIdentity] = useState("");

  const category = profileKey as Ticket["category"] | "";
  const audience = AUDIENCE_BY_IDENTITY[identity] as Ticket["audience"] | undefined;
  const bothPicked = category !== "" && audience !== undefined;
  const resolved = bothPicked
    ? tickets.find((t) => t.visible && t.category === category && t.audience === audience) ?? null
    : null;

  // Every possible card is mounted at all times so the fan can *slide* between
  // them (a freshly-mounted card can't animate in from a stacked position):
  // the placeholder, one card per currently-visible ticket, and the "not on
  // sale" fallback. `activeSlot` is which one comes to the front.
  const visibleTickets = tickets.filter((t) => t.visible);
  const cards: { key: string; content: ReactNode }[] = [
    { key: "placeholder", content: <TicketPlaceholder /> },
    ...visibleTickets.map((t) => ({
      key: t.id,
      content: <TicketCard ticket={t} perks={perks[t.category]} addOnsNote={addOnsNote} taxNote={taxNote} />,
    })),
    { key: "closed", content: <TicketClosed /> },
  ];
  const activeSlot = resolved
    ? visibleTickets.findIndex((t) => t.id === resolved.id) + 1
    : bothPicked
      ? cards.length - 1 // the "not on sale" card
      : 0; // the placeholder

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-6 pb-24 pt-28 sm:px-8 sm:pt-32">
      <h1 className="text-4xl font-bold tracking-tight text-paper sm:text-5xl">{uiCopy.ticketSelector.heading}</h1>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-6 text-2xl text-paper sm:text-3xl">
        <span>{uiCopy.ticketSelector.imAPrompt}</span>
        <TicketDropdown
          label={uiCopy.ticketSelector.imAPrompt}
          value={profileKey}
          onChange={setProfileKey}
          options={profiles.map((p) => ({ value: p.key, label: p.label }))}
          panelClassName="bg-yellow-pastel"
        />
        <span>{uiCopy.ticketSelector.identifyPrompt}</span>
        <TicketDropdown
          label={uiCopy.ticketSelector.identifyPrompt}
          value={identity}
          onChange={setIdentity}
          options={identities.map((i) => ({ value: i, label: i }))}
          panelClassName="bg-green-pastel"
        />
      </div>

      <TicketStack cards={cards} activeSlot={activeSlot} staticBaseline={staticBaseline} />
    </div>
  );
}
