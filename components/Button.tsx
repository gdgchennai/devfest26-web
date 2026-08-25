import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The site's only button/CTA surface. Before this existed the same class string
 * was written out by hand in seven places and had already drifted three
 * different paddings apart, so a change to the CTA meant finding all of them.
 *
 * Renders whichever element the destination calls for: a `<button>` when given
 * an onClick, a `<Link>` for in-site routes, a plain `<a>` for external URLs
 * (the CFP form falls back to an internal route when no external one is set;
 * ticketing is always internal — see `siteConfig.ticketing`).
 */
type Variant = "primary" | "secondary";
type Size = "sm" | "md" | "lg";

/*
 * Ink label on the core colours, not paper. Paper on #4285F4 is 3.56:1 and this
 * label is 14px, which needs 4.5:1 — ink gives 5.89:1. The brand palette has no
 * darker blue to reach 4.5 with a light label, so the label is what changes.
 * (That figure was 4.68:1 while --ink was #1e1e1e; it improved when ink went
 * to #000, so the reasoning stands and the margin is now wider.)
 */
const VARIANT: Record<Variant, string> = {
  primary: "bg-blue text-ink hover:opacity-90",
  // border-paper/45, not /30: this button has no fill, so its border is the
  // only thing that identifies the control's bounds — WCAG 1.4.11 wants 3:1 for
  // that. /30 measured 2.30:1; /45 is 3.94:1.
  secondary: "border border-paper/45 text-paper hover:bg-paper/10",
};

// Mobile-first sizing with desktop scaling: starts at mobile proportions,
// scales up smoothly on larger screens while maintaining consistent visual style.
const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 sm:px-3.5 sm:py-1.75",
  md: "px-4 py-2 sm:px-5 sm:py-2.5",
  lg: "px-6 py-2.5 sm:px-7 sm:py-3",
};

// Smaller font size (13px) looks better proportioned on small buttons,
// consistent across viewports to match mobile-first proportions.
// Includes focus-visible for keyboard navigation accessibility.
const BASE = "inline-block rounded-full text-xs font-medium transition-opacity duration-150 hover:opacity-90 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper focus-visible:outline-offset-2";

function classesFor(variant: Variant, size: Size, className: string) {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`.trim();
}

/** In-site destinations get client navigation; anything else is a real anchor. */
function isInternal(href: string) {
  return href.startsWith("/") || href.startsWith("#");
}

type ButtonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  href,
  onClick,
}: ButtonProps) {
  const classes = classesFor(variant, size, className);

  if (href === undefined) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {children}
      </button>
    );
  }

  if (isInternal(href)) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}
