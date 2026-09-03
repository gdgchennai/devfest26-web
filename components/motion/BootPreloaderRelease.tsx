"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";

/**
 * Hides the server-rendered `#boot-preloader` (defined inline in the root
 * layout) once React has mounted, by adding `boot-done` to <html>.
 *
 * This lives in the LAYOUT, beside the preloader it releases, because the
 * preloader renders on every route. Inner routes have nothing else to take it
 * down. On `/` with the full motion intro, HeroMotion owns the handoff — it
 * mounts the GSAP <Loader> over the same white field, then adds `boot-done`.
 * Releasing from here first would flash StaticHero while that chunk loads
 * (`next/dynamic`, `ssr: false`).
 *
 * useLayoutEffect, not useEffect: the class must land before the browser
 * paints, or the preloader would flash away a frame after the content behind it
 * is already visible.
 */
export function BootPreloaderRelease() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (pathname === "/" && !shouldUseStaticBaseline()) return;
    document.documentElement.classList.add("boot-done");
  }, [pathname]);

  return null;
}
