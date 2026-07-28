import { useEffect, useState } from "react";
import { whenReady, BRACKETS_READY } from "@/lib/assetReady";

/**
 * Minimum time the preloader stays up even on an instant (cached) load — a
 * pseudo loading beat. A bounce cycle is ~1.25s, so ~2s guarantees the dots
 * bounce two full times before the hand-off, rather than flashing past.
 */
const MIN_DURATION = 2000;
/**
 * Last-resort hang failsafe. NOT a normal-path cap: every wait below settles on
 * its own (images/fonts/typeface resolve or reject; the 3D signal always fires,
 * success or failure — see BracketsField), so a real load — however slow —
 * hands off the moment it genuinely finishes. This only trips if a request
 * hangs open forever (never loads, never errors), so the visitor is never
 * trapped. Deliberately generous so it never cuts a legitimately slow load off.
 */
const MAX_DURATION = 90000;

/** The 3D title's typeface, fetched here so the extruded wordmark is ready too. */
const TITLE_TYPEFACE = "/fonts/google-sans-bold.typeface.json";

/**
 * Resolves to `true` once the initial experience is genuinely ready — web fonts
 * loaded, the title typeface fetched, every critical image decoded, and the 3D
 * brackets backdrop built (three.js downloaded + meshes made) — but never
 * before MIN_DURATION.
 *
 * This is the preloader's clock: the 4-dot bounce loops until this flips, then
 * hands off (morph → CTA on a first visit, or a plain fade-out on a refresh).
 * It waits for real completion of every source, so nothing pops in unloaded on
 * reveal, and only bails via MAX_DURATION if a request truly hangs.
 * Deliberately does NOT wait on lazy / off-screen images.
 */
export function useAssetsLoaded(assets: string[], disabled: boolean): boolean {
  const [loaded, setLoaded] = useState(disabled);

  useEffect(() => {
    // When disabled, `loaded` already initialised to true — nothing to wait on.
    if (disabled) return;

    let settled = false;
    const start = performance.now();
    let minTimer = 0;

    function finish() {
      if (settled) return;
      settled = true;
      window.clearTimeout(failsafe);
      const wait = Math.max(0, MIN_DURATION - (performance.now() - start));
      minTimer = window.setTimeout(() => setLoaded(true), wait);
    }

    const waits: Promise<unknown>[] = [];

    // Web fonts — text shouldn't swap/reflow after the reveal.
    if (document.fonts?.ready) waits.push(document.fonts.ready);

    // The 3D title's typeface (a JSON blob, not an <img>) — fetch to warm cache.
    waits.push(fetch(TITLE_TYPEFACE).then((r) => r.arrayBuffer()));

    // Every critical image, decoded off-DOM (covers the flythrough + hero strip
    // + curved marquee, some of which React only mounts after hydration). The
    // flythrough <Frame>s render `unoptimized`, so these raw URLs are exactly
    // what they request — a warm cache, not a fresh fetch.
    assets.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      waits.push(img.decode ? img.decode() : Promise.resolve());
    });

    // The 3D brackets backdrop signals when three.js has downloaded and its
    // meshes are built (see BracketsField → markReady, which fires on failure
    // too, so this can't hang the preloader if WebGL/three ever errors).
    waits.push(whenReady(BRACKETS_READY));

    // allSettled: one slow/failed asset never blocks the rest — we hand off once
    // every source has genuinely resolved or rejected.
    Promise.allSettled(waits).then(finish);

    const failsafe = window.setTimeout(finish, MAX_DURATION);

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(failsafe);
    };
    // assets is a fresh array each render; disabled is the only meaningful input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return loaded;
}
