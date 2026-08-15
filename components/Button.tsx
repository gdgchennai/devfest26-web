import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The site's only button/CTA surface. Before this existed the same class string
 * was written out by hand in seven places and had already drifted three
 * different paddings apart, so a change to the CTA meant finding all of them.
 *
 * Renders whichever element the destination calls for: a `<button>` when given
 * an onClick, a `<Link>` for in-site routes, a plain `<a>` for external URLs
 * (ticketing and the CFP form live off-site, and `siteConfig.ticketing.url`
 * falls back to an internal route when it is not set yet).
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

const SIZE: Record<Size, string> = {
  sm: "px-4 py-2",
  md: "px-6 py-3",
  lg: "px-8 py-3",
};

const BASE = "inline-block rounded-full text-sm font-medium";

function classesFor(variant: Variant, size: Size, className: string) {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`.trim();
}

/*
 * The same pill, minus the interactivity. Used where there is nothing to link
 * to yet — chiefly the ticket CTA while `siteConfig.ticketing.url` is null,
 * which must still occupy the CTA's space and weight without pretending to be
 * a destination. Exported rather than added as a `disabled` prop because the
 * result is not a disabled control: it is a statement, and rendering it as a
 * real <button disabled> would put an unreachable tab stop in the header.
 */
export function inertButtonClasses(size: Size = "md", className = "") {
  return `${BASE} ${SIZE[size]} border border-dashed border-paper/25 text-paper/60 ${className}`.trim();
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
