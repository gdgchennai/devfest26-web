"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/site.config";

/**
 * The header's links, split out purely so the active-route check can run on
 * the client without dragging the rest of Header with it — Header reads
 * `lib/content`, which parses every content JSON through zod, and making it a
 * client component would ship all of that to the browser. Both pieces receive
 * the already-filtered nav array instead.
 *
 * Two exports rather than one fragment because they sit in different places in
 * the bar: the inline nav is centre-left, the menu belongs beside the CTA on
 * the right.
 */

/** "/" would otherwise prefix-match every route. */
function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav({ nav }: { nav: readonly NavItem[] }) {
  const isActive = useIsActive();

  return (
    <nav className="hidden items-center gap-6 md:flex">
      {nav.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative text-sm decoration-blue underline-offset-4 transition-colors hover:text-paper hover:underline ${
              active ? "text-paper" : "text-paper/70"
            }`}
          >
            {item.label}
            {active && (
              <span
                aria-hidden
                className="absolute -bottom-1.5 left-0 h-0.5 w-full rounded-full bg-blue"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function HeaderMenu({ nav }: { nav: readonly NavItem[] }) {
  const isActive = useIsActive();

  return (
    <details className="relative md:hidden">
      <summary className="list-none cursor-pointer rounded p-2 text-paper/80 hover:text-paper [&::-webkit-details-marker]:hidden">
        Menu
      </summary>
      <nav className="absolute right-0 top-full mt-2 flex w-44 flex-col gap-1 rounded-lg bg-ink p-2 shadow-lg ring-1 ring-paper/10">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded px-3 py-2 text-sm hover:bg-paper/10 hover:text-paper ${
                active ? "bg-paper/10 text-paper" : "text-paper/80"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </details>
  );
}
