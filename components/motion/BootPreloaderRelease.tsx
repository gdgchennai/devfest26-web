"use client";

import { useLayoutEffect } from "react";

/**
 * Hides the server-rendered `#boot-preloader` (defined inline in the root
 * layout) once React has mounted, by adding `boot-done` to <html>.
 *
 * This lives in the LAYOUT, beside the preloader it releases, because the
 * preloader renders on every route. It previously only ever ran inside
 * HeroSection, which mounts on `/` alone — so every other route
 * (/about, /agenda, /cfp, /code-of-conduct, /contact, /memories, /speakers,
 * /venue) rendered the white field with the bouncing dots and had nothing to
 * take it down: the page underneath was fully rendered but permanently
 * covered. Whatever owns the preloader has to own the release.
 *
 * Safe on the homepage too. This is a parent of HeroSection, and layout effects
 * run children-first, so HeroSection's own release (and the GSAP <Loader> that
 * mounts in the same commit to take over the white field) still happen first;
 * this only adds an already-added class. The Loader also sits at z-1000 against
 * the preloader's z-995, so it covers the page regardless of the order.
 *
 * useLayoutEffect, not useEffect: the class must land before the browser
 * paints, or the preloader would flash away a frame after the content behind it
 * is already visible.
 */
export function BootPreloaderRelease() {
  useLayoutEffect(() => {
    document.documentElement.classList.add("boot-done");
  }, []);

  return null;
}
