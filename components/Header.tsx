"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navRoutes } from "@/lib/routes";
import { volunteerCta } from "@/lib/cta";
import { uiCopy } from "@/site.config";
import { AuthButton } from "@/components/auth/AuthButton";

/**
 * The site's navigation for lite mode. Full mode uses the hamburger menu
 * (components/HamburgerMenu.tsx) instead — its expanding panel leans on
 * transitions lite mode is meant to skip. Which one renders is decided purely
 * by CSS (`.nav-lite-only`, gated on `html.lite`), not JS, so there's no
 * hydration flash — see app/globals.css.
 *
 * Two layouts, one item list:
 *  • `< sm` — a native `<details>` disclosure. A hamburger, but with no
 *    animation and no JS, so it stays within lite's no-motion contract while
 *    the full item list stops overflowing a phone (which the horizontal
 *    scroll-bar below did once Agenda/Speakers were in the nav).
 *  • `sm+` — the horizontal pill bar. Scrollable rather than wrapping: a
 *    wrapping FIXED bar changes its own height at some widths, covering a
 *    different amount of the hero on a phone than a laptop. At `sm+` there's
 *    room, so this rarely actually scrolls.
 *
 * Reads `navRoutes` (lib/routes.ts) — same source as the 404's rescue grid,
 * so the header can't drift into linking a page that no longer exists.
 *
 * `fixed`, deliberately: this page is a chain of GSAP ScrollTrigger pins whose
 * scroll-distance math is measured off real element heights. A header in normal
 * flow would add its height to the top of the document and shift every one of
 * those measurements. Fixed takes it out of flow entirely.
 *
 * z-50 puts it above page content (z-40, the ScrollCue buttons) and below the
 * boot preloader (z-995) and <Loader> (z-1000) — the intro still covers it.
 */
export function Header() {
  const pathname = usePathname();
  const volunteer = volunteerCta();

  const routeItems = navRoutes.map((route) => {
    const active = pathname === route.href;
    return (
      <li key={route.href}>
        <Link
          href={route.href}
          // aria-current is what actually announces the active page; the colour
          // change is the sighted equivalent, not a replacement for it.
          aria-current={active ? "page" : undefined}
          className={`block rounded-full px-3 py-1.5 text-sm transition-colors ${
            active ? "bg-paper/10 text-paper" : "text-paper/70 hover:bg-paper/5 hover:text-paper"
          }`}
        >
          {route.label}
        </Link>
      </li>
    );
  });

  const volunteerItem = (
    <li>
      <a
        href={volunteer.href}
        target="_blank"
        rel="noreferrer"
        className="block rounded-full px-3 py-1.5 text-sm text-paper/70 transition-colors hover:bg-paper/5 hover:text-paper"
      >
        {volunteer.label}
      </a>
    </li>
  );

  return (
    <header className="nav-lite-only pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center py-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:pl-[max(2rem,env(safe-area-inset-left,0px))] sm:pr-[max(2rem,env(safe-area-inset-right,0px))]">
      {/* bg-surface, not an alpha wash: BracketsField paints a fixed 3D layer
          behind the homepage and globals.css is explicit that a panel carrying
          text over it needs an occluding surface. See --surface there. */}

      {/* < sm: disclosure. The list drops straight in with no transition
          (open/closed is instant) — the whole point in lite mode. The chevron
          flips when open via an arbitrary variant on the <details>. */}
      <details className="pointer-events-auto w-full max-w-xs sm:hidden [&[open]_.chevron]:rotate-180">
        <summary
          className="flex cursor-pointer list-none items-center justify-between rounded-full border border-paper/10 bg-surface px-4 py-2 text-sm text-paper backdrop-blur-sm [&::-webkit-details-marker]:hidden"
        >
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Menu
          </span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true" className="chevron">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <nav aria-label={uiCopy.header.navAriaLabel} className="mt-2 rounded-2xl border border-paper/10 bg-surface p-2 backdrop-blur-sm">
          <ul className="flex flex-col">
            {routeItems}
            {volunteerItem}
            <li>
              <AuthButton variant="pill" />
            </li>
          </ul>
        </nav>
      </details>

      {/* sm+: the horizontal pill bar. */}
      <nav
        aria-label={uiCopy.header.navAriaLabel}
        className="pointer-events-auto hidden max-w-full overflow-x-auto rounded-full border border-paper/10 bg-surface px-2 py-1.5 backdrop-blur-sm sm:block"
      >
        <ul className="flex items-center gap-1 whitespace-nowrap">
          {routeItems}
          {volunteerItem}
          <li>
            <AuthButton variant="pill" />
          </li>
        </ul>
      </nav>
    </header>
  );
}
