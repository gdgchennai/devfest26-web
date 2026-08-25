"use client";

import Link from "next/link";
import { forwardRef, type ForwardedRef, type ReactNode, useRef } from "react";

/**
 * Glassmorphism button with a neon four-colour border (brand red/blue/green/
 * yellow) that reads as one smooth wrapped gradient rather than four flat
 * corners — see the `.glow-btn` block in app/globals.css for how the ring and
 * its blurred halo are built. A press triggers `.glow-btn--burst`, which
 * spikes the halo's blur/opacity and eases back — the "energy dispersing"
 * moment from the brief.
 *
 * `shape` controls the geometry only; everything else (glass surface, ring,
 * burst) is shared so box/pill/circle all get the identical effect.
 */
type Shape = "box" | "pill" | "circle";
type Size = "sm" | "md" | "lg";

const RADIUS: Record<Shape, string> = {
  box: "rounded-2xl",
  pill: "rounded-full",
  circle: "rounded-full",
};

// Responsive padding: mobile-first with sm: breakpoint scaling for desktop.
// Prevents oversized padding/text on small screens while maintaining desktop
// visibility and touch-target size.
const PADDING: Record<"box" | "pill", Record<Size, string>> = {
  box: {
    sm: "px-3 py-1.5 sm:px-4 sm:py-2",
    md: "px-4 py-2 sm:px-6 sm:py-3",
    lg: "px-6 py-2.5 sm:px-8 sm:py-4",
  },
  pill: {
    sm: "px-4 py-1.5 sm:px-5 sm:py-2",
    md: "px-5 py-2 sm:px-7 sm:py-3",
    lg: "px-7 py-2.5 sm:px-9 sm:py-4",
  },
};

// Responsive circle sizes: mobile-first (smaller on phones) with sm: breakpoint
// scaling for desktop. Prevents buttons from dominating mobile screens while
// keeping them visible on larger viewports.
const CIRCLE_SIZE: Record<Size, string> = {
  sm: "h-10 w-10 sm:h-11 sm:w-11",
  md: "h-11 w-11 sm:h-14 sm:w-14",
  lg: "h-13 w-13 sm:h-16 sm:w-16",
};

/** In-site destinations get client navigation; anything else is a real anchor. */
function isInternal(href: string) {
  return href.startsWith("/") || href.startsWith("#");
}

/** Assigns a DOM node to every ref in the list — lets this component keep its
 *  own internal ref (for the burst class) while still forwarding a caller's
 *  ref (VenueReveal needs one to GSAP-animate the whole button's opacity). */
function setRefs<T>(refs: Array<ForwardedRef<T> | undefined>) {
  return (node: T) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as { current: T | null }).current = node;
    }
  };
}

type GlowButtonProps = {
  children: ReactNode;
  shape?: Shape;
  size?: Size;
  className?: string;
  /** Only meaningful on the external-anchor branch (non-internal href) —
   *  same reason ShowMoodSection/VenueReveal set these by hand today. */
  target?: string;
  rel?: string;
  /** Overrides the default text-paper — needed wherever the button sits on a
   *  photo rather than the flat page backdrop (paper flips to near-black in
   *  light theme, same reasoning as VenueReveal/ShowMoodSection's other
   *  photo-overlaid captions, which force white regardless of --theme). */
  textClassName?: string;
  /** Extra classes appended to the glass surface itself (not the outer glow
   *  ring) — e.g. responsive padding/text-size overrides. Safe to add
   *  breakpoint-prefixed utilities (sm:/lg:) alongside the base `size`; only
   *  risk is stacking a SECOND unprefixed utility for the same property,
   *  which Tailwind won't reliably resolve in a particular direction. */
  surfaceClassName?: string;
  /** Passed straight through to the internal `<Link>` on the internal-href
   *  branch. Defaults to Next's own default (true) — set false for same-page
   *  query-param toggles (filters, tabs) where jumping scroll to top on every
   *  click would fight whatever local UI state the click is meant to update. */
  scroll?: boolean;
  /** Only meaningful on the `onClick` (button) branch — a link is never
   *  "disabled" in the same sense. Dims the glass surface and turns off
   *  pointer events via .glow-btn__surface:disabled. */
  disabled?: boolean;
} & ({ href: string; onClick?: never } | { href?: never; onClick?: () => void });

export const GlowButton = forwardRef<HTMLSpanElement, GlowButtonProps>(function GlowButton(
  {
    children,
    shape = "pill",
    size = "md",
    className = "",
    href,
    onClick,
    target,
    rel,
    textClassName = "text-paper",
    surfaceClassName = "",
    scroll,
    disabled,
  },
  forwardedRef,
) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const setWrapperRefs = setRefs([wrapperRef, forwardedRef]);

  /*
   * Re-triggers the burst keyframe on every press, including rapid repeats —
   * a CSS animation that's already running does not restart just because the
   * class is re-added, so the class is removed and a reflow is forced first.
   */
  function burst() {
    const node = wrapperRef.current;
    if (!node) return;
    node.classList.remove("glow-btn--burst");
    void node.offsetWidth;
    node.classList.add("glow-btn--burst");
  }

  const geometry =
    shape === "circle"
      ? `${RADIUS.circle} ${CIRCLE_SIZE[size]}`
      : `${RADIUS[shape]} ${PADDING[shape][size]}`;

  const wrapperClass = `glow-btn ${RADIUS[shape]} ${className}`.trim();
  // Responsive text size: smaller on mobile (text-xs), standard on desktop (sm:text-sm).
  // Prevents text from appearing cramped on small buttons on mobile while maintaining
  // clarity on larger screens and buttons.
  const surfaceClass =
    `glow-btn__surface inline-flex items-center justify-center text-xs sm:text-sm font-medium ${textClassName} ${geometry} ${surfaceClassName}`.trim();

  const label = <span className="glow-btn__label">{children}</span>;
  const corners = <span className="glow-btn__corners" aria-hidden="true" />;

  if (href === undefined) {
    return (
      <span ref={setWrapperRefs} className={wrapperClass} data-shape={shape} onPointerDown={burst}>
        {corners}
        <button type="button" onClick={onClick} disabled={disabled} className={surfaceClass}>
          {label}
        </button>
      </span>
    );
  }

  if (isInternal(href)) {
    return (
      <span ref={setWrapperRefs} className={wrapperClass} data-shape={shape} onPointerDown={burst}>
        {corners}
        <Link href={href} scroll={scroll} className={surfaceClass}>
          {label}
        </Link>
      </span>
    );
  }

  return (
    <span ref={setWrapperRefs} className={wrapperClass} data-shape={shape} onPointerDown={burst}>
      {corners}
      <a href={href} target={target} rel={rel} className={surfaceClass}>
        {label}
      </a>
    </span>
  );
});
