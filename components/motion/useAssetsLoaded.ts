import { useEffect, useState } from "react";
import { whenReady, BRACKETS_READY } from "@/lib/assetReady";

/**
 * Minimum time the preloader stays up even on an instant (cached) load — a
 * pseudo loading beat. A bounce cycle is ~1.25s, so ~2s guarantees the dots
 * bounce two full times before the hand-off, rather than flashing past.
 */
const MIN_DURATION = 2000;
/**
 * How long the bounce will wait before handing off regardless.
 *
 * Normally it never trips: every wait below settles on its own (images, fonts
 * and the typeface all resolve or reject; the 3D signal fires on failure too —
 * see BracketsField), so a load that finishes in 4s hands off at 4s. This is
 * the ceiling for the case where something is merely very slow rather than
 * broken — a phone on venue wifi — because a visitor staring at bouncing dots
 * past ~15s has been abandoned, whatever the network is doing.
 *
 * Handing off early is safe by construction: <Frame> renders its brand-shape
 * fallback panel for any image that has not arrived, and swaps each photo in as
 * it decodes. So the intro degrades to "some panels, filling in" rather than
 * stalling — no separate lite-mode branch needed for this path.
 */
const MAX_DURATION = 15000;

/**
 * Next's default `images.deviceSizes` and quality. next/image builds its srcset
 * from these, so mirroring them here lets the preloader hand the browser the
 * SAME candidate list a <Frame> will render. The browser then applies its own
 * selection to both, picks the identical URL, and the <Frame> gets a cache hit
 * instead of a fresh fetch.
 *
 * This is the one place coupled to Next's defaults: if `images.deviceSizes` or
 * a per-image `quality` is ever set in next.config, update these to match or
 * the preloader silently warms URLs nothing asks for.
 */
const DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const DEFAULT_QUALITY = 75;

/** An image the optimizer serves, so it must be warmed at the same widths. */
export type SizedAsset = { src: string; sizes: string };

function optimizedSrcSet(src: string): string {
  return DEVICE_SIZES.map(
    (w) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${DEFAULT_QUALITY} ${w}w`,
  ).join(", ");
}

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
export function useAssetsLoaded(
  assets: string[],
  disabled: boolean,
  /**
   * Images the OPTIMIZER serves (the flythrough's <Frame>s). Warmed through a
   * matching srcset/sizes pair rather than by raw URL — warming the raw file
   * would leave the balls bouncing on an asset the flythrough never requests,
   * then hand off to cards that still have to fetch. That mismatch is exactly
   * what made every card show its fallback panel for the whole intro.
   */
  sizedAssets: SizedAsset[] = [],
): boolean {
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

    // Every critical image, decoded off-DOM (covers the hero strip + curved
    // marquee, which React only mounts after hydration).
    //
    // These are the RAW urls, and they are the ones that matter: the curved
    // marquee loads them through three.js TextureLoader and ExpectShowcase
    // through a plain <img>, neither of which can use /_next/image. The
    // flythrough's <Frame>s go through the optimizer instead (see HeroSection)
    // and fetch their own much smaller variants, so warming raw here is for
    // those two consumers, not for the flythrough.
    assets.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      waits.push(img.decode ? img.decode() : Promise.resolve());
    });

    // Optimizer-served images. Setting sizes BEFORE srcset matters: the browser
    // resolves the candidate at srcset-assignment time, and with no sizes yet it
    // would default to 100vw and pick a wider (different, uncached) variant.
    sizedAssets.forEach(({ src, sizes }) => {
      const img = new window.Image();
      img.sizes = sizes;
      img.srcset = optimizedSrcSet(src);
      img.src = src; // fallback for anything that ignores srcset
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
