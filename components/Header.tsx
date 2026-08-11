"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navRoutes } from "@/lib/routes";

/**
 * The site's navigation. Minimal on purpose — the previous header was removed
 * ("a new one is being designed") and nothing replaced it, which left eight of
 * the nine routes unreachable from each other: the 404 page was the only
 * surface on the site that offered a route index. This is the smallest thing
 * that fixes that, not the final design.
 *
 * Reads `navRoutes` (lib/routes.ts), which was already exported for exactly
 * this and had zero consumers. That list and the 404's rescue grid are now the
 * same source, so the header can't drift into linking a page that no longer
 * exists.
 *
 * `fixed`, deliberately: this page is a chain of GSAP ScrollTrigger pins whose
 * scroll-distance math is measured off real element heights (VenueReveal,
 * ExpectShowcase and MoodSection each pin an element and reserve a pin-spacer).
 * A header in normal flow would add its height to the top of the document and
 * shift every one of those measurements. Fixed positioning takes it out of flow
 * entirely, so the choreography below is untouched.
 *
 * z-50 puts it above page content (which tops out at z-40, the ScrollCue
 * buttons) and below the boot preloader (z-995) and <Loader> (z-1000) — the
 * intro still covers it, as it should.
 */
export function Header() {
  const pathname = usePathname();

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 py-3 sm:px-8">
      {/*
       * bg-surface, not an alpha wash: BracketsField paints a fixed 3D layer
       * behind the whole homepage, and globals.css is explicit that any panel
       * carrying text over it needs an occluding surface or an extruded
       * bracket travels straight through the words. See --surface there.
       *
       * Horizontally scrollable rather than wrapping — a wrapping fixed bar
       * changes its own height at some widths, which would make it cover a
       * different amount of the hero on a phone than on a laptop.
       */}
      <nav
        aria-label="Primary"
        className="pointer-events-auto max-w-full overflow-x-auto rounded-full border border-paper/10 bg-surface px-2 py-1.5 backdrop-blur-sm"
      >
        <ul className="flex items-center gap-1 whitespace-nowrap">
          {navRoutes.map((route) => {
            const active = pathname === route.href;
            return (
              <li key={route.href}>
                <Link
                  href={route.href}
                  // aria-current is what actually announces the active page;
                  // the colour change is the sighted equivalent, not a
                  // replacement for it.
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-full px-3 py-1.5 text-sm transition-colors ${
                    active ? "bg-paper/10 text-paper" : "text-paper/70 hover:bg-paper/5 hover:text-paper"
                  }`}
                >
                  {route.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
