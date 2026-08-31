import { useEffect, useState } from "react";
import { whenReady, didFail, BRACKETS_READY } from "@/lib/assetReady";
import imagekitLoader, { IMAGEKIT_QUALITY } from "@/lib/imagekit-loader";

/**
 * Minimum time the preloader stays up even on an instant (cached) load — a
 * pseudo loading beat. A bounce cycle is ~1.25s, so ~2s guarantees the dots
 * bounce two full times before the hand-off, rather than flashing past.
 *
 * Applied ONLY on the first-visit intro (see the `fullIntro` param). On a
 * return to `/` within the session — a client-side nav back, or a refresh
 * after the intro was already seen — every asset is cached and resolves in a
 * few ms, so this floor was just a mandatory ~2.7s stare at bouncing dots
 * with nothing actually loading. That path hands off the instant the waits
 * settle instead.
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
 * Per-asset budget. MAX_DURATION is the whole-preloader ceiling; this is the
 * ceiling for any ONE source, and it exists because those are different
 * questions. Without it a single stalled connection held the bounce for the
 * full 15s even when every other asset had settled in two — the visitor waits
 * out the worst case of the slowest thing rather than the realistic case of
 * everything.
 *
 * Past this an asset is treated as failed, which is a decision, not a guess: an
 * image that has not arrived in eight seconds is not going to arrive in time to
 * be part of an intro.
 */
const ASSET_BUDGET = 8000;

/**
 * How long from NAVIGATION START before the load counts as *slow* — the signal
 * the intro uses to offer lite mode (see `slow` in AssetsState, the prompt in
 * Loader.tsx, and the matching inline check in app/layout.tsx's boot preloader).
 *
 * Measured against nav start, not against this hook mounting: on a slow
 * connection most of the wait is the JS bundle downloading and hydrating —
 * which is over before this hook exists — so a clock that started here would
 * miss it entirely. `performance.now()` is ms since `timeOrigin` (~nav start),
 * so it already accounts for every second the visitor has been staring at a
 * blank screen then the bouncing dots.
 *
 * `navigator.connection` is deliberately NOT the signal: it reports "3g" on
 * localhost and phones on real 3G don't always report it. "This has taken N
 * seconds" is the trustworthy one.
 *
 * 4s: a fast load (HTML + JS + hydrate + cached/quick assets) is done well
 * under it, so it never trips for them. Past it — a phone on real 3G, congested
 * venue wifi — a one-tap way out is worth offering before they sit through the
 * whole intro (and, on the worst connections, hand off via MAX_DURATION with
 * textures still missing).
 */
const SLOW_AFTER = 4000;

/**
 * Next's default `images.deviceSizes`. next/image builds its srcset from
 * these, so mirroring the list here lets the preloader hand the browser the
 * SAME candidates a <Frame> will render. The browser then applies its own
 * selection to both, picks the identical URL, and the <Frame> gets a cache hit
 * instead of a fresh fetch.
 *
 * This is the one place coupled to Next's defaults: if `images.deviceSizes`
 * is ever set in next.config, update this to match or the preloader silently
 * warms URLs nothing asks for.
 */
const DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

/** An image the optimizer serves, so it must be warmed at the same widths. */
export type SizedAsset = { src: string; sizes: string };

function optimizedSrcSet(src: string): string {
  return DEVICE_SIZES.map((w) => `${optimizedSrc(src, w)} ${w}w`).join(", ");
}

/**
 * Next's own default quality (v16: `qualities: [75]`) — the built-in
 * optimizer rejects a quality outside its configured set, same constraint as
 * DEVICE_SIZES above.
 */
const DEV_QUALITY = 75;

/**
 * One optimizer URL at one width — for consumers that cannot use a srcset
 * because they are not an <img>: chiefly three.js `TextureLoader`, which takes
 * a single URL string.
 *
 * Branches the same way next.config.ts does: dev keeps Next's built-in
 * `/_next/image` optimizer, prod goes through the custom ImageKit loader.
 * This has to mirror that branch exactly, not just call the ImageKit loader
 * unconditionally — this function is a plain JS call, not something routed
 * through next/image's own loader resolution, so nothing else keeps it in
 * sync automatically. Get this wrong (as it briefly was, calling
 * imagekitLoader() in both environments) and the preloader warms ImageKit
 * URLs in dev while every real <Image>/<Frame> requests /_next/image —
 * exactly the "warmed URL ≠ consumer URL" bug this file's other comments
 * already warn about.
 *
 * `w` must be one of DEVICE_SIZES — the optimizer rejects widths outside the
 * configured set.
 */
export function optimizedSrc(src: string, width: number): string {
  if (process.env.NODE_ENV === "production") {
    return imagekitLoader({ src, width, quality: IMAGEKIT_QUALITY });
  }
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${DEV_QUALITY}`;
}

/** The 3D title's typeface, fetched here so the extruded wordmark is ready too. */
const TITLE_TYPEFACE = "/fonts/google-sans-bold.typeface.json";

/**
 * Resolves to `true` once the initial experience is genuinely ready — web fonts
 * loaded, the title typeface fetched, every critical image decoded, and the 3D
 * brackets backdrop built (three.js downloaded + meshes made) — but never
 * before MIN_DURATION.
 *
 * **What blocks the bounce and what is merely warmed are two different
 * questions**, and conflating them makes everyone wait for things nobody can
 * see yet:
 *
 *   Blocking — no graceful fallback, so absence is a visible hole:
 *     web fonts · the title typeface · the marquee textures · three.js
 *   Warmed only — degrades gracefully AND not on screen at hand-off:
 *     the flythrough's <Frame>s
 *

 * This is the preloader's clock: the 4-dot bounce loops until this flips, then
 * hands off (morph → CTA on a first visit, or a plain fade-out on a refresh).
 * It waits for real completion of every source, so nothing pops in unloaded on
 * reveal, and only bails via MAX_DURATION if a request truly hangs.
 * Deliberately does NOT wait on lazy / off-screen images.
 */
export type AssetsState = {
  /** The preloader may hand off. */
  ready: boolean;
  /**
   * A load-bearing asset definitively failed, so the full hero cannot render
   * meaningfully — the caller should show the static baseline instead of
   * handing off to an empty canvas. See DEGRADED_WHEN below for what counts.
   */
  degraded: boolean;
  /**
   * The load passed SLOW_AFTER without finishing — the visitor is on a slow
   * enough connection that the intro should offer them lite mode while they
   * wait. Sticky once set (a load that was slow stays flagged even after it
   * finally completes). Never set on a fast load or a cached return visit.
   */
  slow: boolean;
};

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
  /**
   * True only on the first-visit intro (HeroSection's `playIntro`). When false
   * — a return to `/` within the session — MIN_DURATION is skipped so the
   * preloader hands off as soon as the (already-cached) waits settle instead
   * of holding the bounce for a fixed ~2s. See MIN_DURATION.
   */
  fullIntro: boolean = true,
): AssetsState {
  /*
   * Starts false and is ONLY flipped by finish(). The disabled case is handled
   * on the way out instead (see the return), not by seeding this.
   *
   * Seeding it — `useState(disabled)` — silently disabled the whole hook. On the
   * hydration render `shouldUseStaticBaseline()` returns its server value `true`,
   * so `showLoader` is false, so `disabled` is true, so this initialised to
   * ready=true. `useState` ignores later argument changes, so when `disabled`
   * flipped to false a render later there was nothing to flip `ready` back: the
   * preloader reported "ready" before it had waited for anything, and
   * MIN_DURATION / MAX_DURATION were both dead code.
   *
   * It looked like it worked because the bounce only hands off on a cycle
   * boundary and then plays a morph, so there is always a plausible few seconds
   * of dots. Caught by pausing the typeface request forever: hand-off still
   * happened on schedule.
   */
  const [state, setState] = useState<AssetsState>({ ready: false, degraded: false, slow: false });

  useEffect(() => {
    // Nothing to wait on — the caller isn't showing a preloader.
    if (disabled) return;

    let settled = false;
    const start = performance.now();
    let minTimer = 0;
    const budgetTimers: number[] = [];
    const failed = new Set<string>();

    // Flag a slow load SLOW_AFTER ms after NAVIGATION START (not after this
    // effect ran — `start` is `performance.now()`, i.e. ms since nav start, so
    // subtracting it gives the time left, clamped to 0 when boot + hydration
    // already blew past the threshold → prompt shows as soon as the Loader is
    // interactive). Guarded on `settled` so a load that just squeaked in under
    // the wire isn't retroactively labelled slow.
    const slowTimer = window.setTimeout(
      () => {
        if (!settled) setState((s) => (s.slow ? s : { ...s, slow: true }));
      },
      Math.max(0, SLOW_AFTER - start),
    );

    /*
     * Every wait goes through here, and none of them can reject: a failure is
     * recorded by label and swallowed, so one dead asset never blocks the rest.
     * That is what allSettled was doing before — this adds the two things it
     * could not: a per-asset ceiling, and a record of WHICH source failed, which
     * is the only way to tell "one photo missing, carry on" from "the thing this
     * intro exists to introduce cannot render".
     */
    function watch(work: Promise<unknown>, label: string): Promise<void> {
      let timer = 0;
      const budget = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`budget: ${label}`)), ASSET_BUDGET);
        budgetTimers.push(timer);
      });
      return Promise.race([work, budget]).then(
        () => window.clearTimeout(timer),
        () => {
          failed.add(label);
          window.clearTimeout(timer);
        },
      );
    }

    /*
     * What makes the hero not worth showing. Both leave the visitor looking at
     * a hero with nothing in it, and StaticHero — which carries the title, date,
     * venue and CTAs — is strictly better than that.
     *
     * A single missing photo is deliberately NOT degradation: the strip simply
     * has one fewer picture, which nobody can perceive.
     */
    function isDegraded() {
      const everyTextureFailed =
        assets.length > 0 && assets.every((src) => failed.has(`texture:${src}`));
      return failed.has("typeface") || failed.has("three") || everyTextureFailed;
    }

    function finish() {
      if (settled) return;
      settled = true;
      window.clearTimeout(failsafe);
      const degraded = isDegraded();
      // The minimum bounce is skipped entirely when degraded (MIN_DURATION
      // buys polish on a fast successful load; making someone watch a
      // decorative beat before being told the decoration isn't coming is the
      // wrong trade) and on a return visit (`fullIntro` false — nothing is
      // actually loading, see MIN_DURATION).
      const floor = degraded || !fullIntro ? 0 : MIN_DURATION;
      const wait = Math.max(0, floor - (performance.now() - start));
      // Functional update: preserve `slow` if the slow timer already fired
      // (a slow load that eventually completed is still a slow load).
      minTimer = window.setTimeout(() => setState((s) => ({ ...s, ready: true, degraded })), wait);
    }

    const waits: Promise<unknown>[] = [];

    // Web fonts — text shouldn't swap/reflow after the reveal. Not load-bearing:
    // a fallback face is a cosmetic loss, not a blank hero.
    if (document.fonts?.ready) waits.push(watch(document.fonts.ready, "fonts"));

    /*
     * The 3D title's typeface (a JSON blob, not an <img>).
     *
     * The `r.ok` check is load-bearing and was missing: fetch only rejects on a
     * network-level failure, so a 404 resolved with ok:false and .arrayBuffer()
     * happily parsed the error body. A missing typeface was therefore recorded
     * as SUCCESS — the preloader handed off pleased with itself and the extruded
     * title simply never appeared, with nothing anywhere reporting why.
     */
    waits.push(
      watch(
        fetch(TITLE_TYPEFACE).then((r) => {
          if (!r.ok) throw new Error(`typeface ${r.status}`);
          return r.arrayBuffer();
        }),
        "typeface",
      ),
    );

    /*
     * Single-URL assets, decoded off-DOM — today, the curved marquee's textures,
     * which three.js mounts only after hydration.
     *
     * `assets` must be the EXACT strings the consumer will request. It is not a
     * list of "the photos involved": warm a raw original while the consumer asks
     * the optimizer and the dots bounce on a file nothing wants, then hand off
     * to a hero that still has to fetch. The caller therefore passes the array
     * the consumer itself exports (MARQUEE_TEXTURES) rather than rebuilding it.
     *
     * This list used to be all 15 raw archive originals — ~5 MB on the default
     * path — for two stated consumers. Neither holds now: ExpectShowcase renders
     * through next/image, and TextureLoader can read an optimizer URL perfectly
     * well (86% smaller, measured).
     */
    assets.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      waits.push(watch(img.decode ? img.decode() : Promise.resolve(), `texture:${src}`));
    });

    /*
     * Optimizer-served images — WARMED BUT NOT AWAITED, and the difference is
     * the whole point of this block.
     *
     * These are the flythrough's <Frame>s. Two reasons they must not hold the
     * bounce: they are not on screen at hand-off (the flythrough only plays
     * after the visitor clicks Enter, which is later still), and <Frame> renders
     * its brand-shape panel and cross-fades each photo in on decode, so a late
     * arrival degrades to "a panel that fills in" rather than to a hole.
     *
     * Blocking on them was making everyone — including fast connections — wait
     * out ten decodes for pictures they could not yet see. Starting the fetch is
     * the part that mattered; awaiting it never was.
     *
     * Setting sizes BEFORE srcset still matters: the browser resolves the
     * candidate at srcset-assignment time, and with no sizes yet it would
     * default to 100vw and pick a wider (different, uncached) variant.
     */
    sizedAssets.forEach(({ src, sizes }) => {
      const img = new window.Image();
      img.sizes = sizes;
      img.srcset = optimizedSrcSet(src);
      img.src = src; // fallback for anything that ignores srcset
      // Swallow: an un-awaited rejection here is an unhandled promise rejection.
      void img.decode?.().catch(() => {});
    });

    // The 3D brackets backdrop signals when three.js has downloaded and its
    // meshes are built. It settles on failure too (markFailed), so this can
    // never hang — and because it now distinguishes the two, a failed three.js
    // chunk is reported as "three" rather than passing for success. That is the
    // difference between handing off to a blank canvas and handing off to
    // StaticHero.
    waits.push(
      whenReady(BRACKETS_READY).then(() => {
        if (didFail(BRACKETS_READY)) failed.add("three");
      }),
    );

    // Every wait is already non-rejecting and already budget-capped by watch(),
    // so this resolves once each source has resolved, failed, or run out of its
    // own time — whichever comes first.
    Promise.all(waits).then(finish);

    // Whole-preloader ceiling. With per-asset budgets in place this should now
    // be unreachable in practice; it stays as the backstop for anything that
    // manages to hang outside a watch() (e.g. a wait added later without one).
    const failsafe = window.setTimeout(finish, MAX_DURATION);

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(failsafe);
      window.clearTimeout(slowTimer);
      budgetTimers.forEach((t) => window.clearTimeout(t));
    };
    // assets is a fresh array each render; disabled is the only meaningful
    // input. `fullIntro` is read once here on purpose — it is stable for the
    // whole life of this effect (a return visit mounts with it false; a first
    // visit has it true until well after finish() has run), and re-running on
    // its change would reset `settled` mid-load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  // Derived, not seeded: a caller that isn't waiting is ready by definition, and
  // when `disabled` flips the answer changes with it instead of being frozen at
  // whatever it was on the first render.
  return disabled ? { ready: true, degraded: false, slow: false } : state;
}
