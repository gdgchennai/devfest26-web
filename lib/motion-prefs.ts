export const LITE_STORAGE_KEY = "devfest-lite";
export const INTRO_SEEN_KEY = "devfest-intro-seen";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * `?lite=1` turns it on, `?lite=0` turns it off, and either way the answer is
 * remembered. Both directions matter: the toggle drives the preference through
 * the URL so the choice is linkable, bookmarkable and testable — "open the site
 * the way I see it" has to be something a visitor can send to someone else, and
 * `?lite=0` is the only way back out of a stored preference on a shared machine.
 *
 * NOTE: this persists as a side effect of being read. Harmless (it writes the
 * same value every time) but it is why the pre-paint script in app/layout.tsx
 * inlines the same two rules rather than calling this — that script has to run
 * before any module loads. Change one, change the other.
 */
export function isLiteMode(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const param = params.get("lite");
  if (param === "1") {
    window.localStorage.setItem(LITE_STORAGE_KEY, "1");
    return true;
  }
  if (param === "0") {
    clearLiteMode();
    return false;
  }
  return window.localStorage.getItem(LITE_STORAGE_KEY) === "1";
}

/** The one place that knows how to forget the preference. */
export function clearLiteMode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LITE_STORAGE_KEY);
}

type Listener = () => void;
const liteModeListeners = new Set<Listener>();

/**
 * `isLiteMode()` (and everything built on it — `shouldUseStaticBaseline`,
 * `shouldSkipHeavyAssets`) is read all over the site through `useClientValue`,
 * whose store deliberately never notifies (see its own doc comment) — the
 * preference was assumed to only ever change via a full page reload, which
 * gives every one of those components a fresh mount for free. `LiteToggle`
 * no longer reloads the page (see there), so `MotionProvider` subscribes to
 * this instead, purely to key-remount its whole subtree on a flip — that
 * remount is what still gives every consumer a "fresh mount" without an
 * actual navigation, so none of them had to change.
 */
export function subscribeLiteModeChange(listener: Listener): () => void {
  liteModeListeners.add(listener);
  return () => liteModeListeners.delete(listener);
}

/** Called by `LiteToggle` once it's finished updating the URL/localStorage/
 *  `html.lite` class, so every subscriber re-reads `isLiteMode()` and gets
 *  the new answer. */
export function notifyLiteModeChange(): void {
  liteModeListeners.forEach((listener) => listener());
}

/**
 * Cheap, synchronous signal that the device's GPU/CPU is likely to struggle
 * with the WebGL scenes (curved marquee, brackets field). There is no
 * reliable "GPU tier" API, so this leans on the same signals browsers expose
 * for adaptive loading: low core count and low device memory. Both are
 * `undefined` on browsers that don't support them (notably Safari), in which
 * case we don't downgrade — false negatives are fine, false positives make
 * capable devices worse for no reason.
 */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores <= 4) return true;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (typeof memory === "number" && memory <= 4) return true;
  return false;
}

/**
 * Whether the connection is genuinely slow — `saveData`, or a `2g`/`slow-2g`
 * effective type. Deliberately NOT `3g`: Chrome's `effectiveType` is a rolling
 * estimate off recent network activity and reports `3g` very readily — on a dev
 * server, on any connection with elevated RTT, or on fine broadband that just
 * had a slow moment — so gating the lite prompt on it fired for people on
 * perfectly usable connections (and on localhost). `navigator.connection` is
 * absent on Safari/Firefox → `false` (no signal, no downgrade).
 */
export function isSlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === "slow-2g" || connection.effectiveType === "2g";
}

/**
 * Dev-only URL override for the preloader's lite-mode prompt, so it's testable
 * without spoofing `navigator.connection` (Chrome's throttling doesn't reliably
 * update `effectiveType`) or waiting out a real slow load. `?lite-prompt=1`
 * forces the prompt shown, `?lite-prompt=0` forces it hidden, absent → `null`
 * (no opinion). Stripped from prod builds — `NODE_ENV` is statically replaced,
 * so this is dead code there.
 */
export function litePromptOverride(): boolean | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const forced = new URLSearchParams(window.location.search).get("lite-prompt");
  return forced === "1" ? true : forced === "0" ? false : null;
}

/**
 * The *instant* half of "should the preloader offer lite mode" — a genuinely
 * slow connection (2g / save-data) or a device likely to struggle with the
 * WebGL scenes. The other half is measured (`slow` from useAssetsLoaded — the
 * load has actually been dragging), which is the more reliable signal; this one
 * catches the cases that are knowable at t=0. Offering lite does NOT downgrade
 * anything by itself (see `shouldUseStaticBaseline`).
 */
export function shouldSuggestLiteMode(): boolean {
  const forced = litePromptOverride();
  if (forced !== null) return forced;
  return isSlowConnection() || isLowPowerDevice();
}

/**
 * Phone / small-tablet viewports. Matches the site's `lg` (1024px) breakpoint
 * and the pre-paint script in app/layout.tsx — change one, change the other.
 *
 * PageSpeed Insights (and real phones) cannot run the WebGL hero + hallway
 * intro without tanking LCP and TBT; the SSR StaticHero is the page they get.
 * Desktop / wide screens keep the full motion layer.
 */
export function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

/**
 * True when the full motion layer (preloader, intro, hallway, 3D) should be
 * skipped entirely and the visitor sent straight to the static site.
 *
 * Connection speed is intentionally not a gate — the bouncing preloader holds
 * until everything is ready rather than downgrading slow/save-data visitors.
 * Opt-outs: reduced-motion, the manual lite toggle, and narrow viewports
 * (see isNarrowViewport).
 */
export function shouldUseStaticBaseline(): boolean {
  return prefersReducedMotion() || isLiteMode() || isNarrowViewport();
}

/**
 * True when a heavy optional download (three.js, chiefly) must not be fetched
 * at all. Lite mode and narrow viewports skip it; reduced-motion on a wide
 * screen still gets still WebGL imagery (a vestibular preference, not a
 * bandwidth one — rendered once instead of animated).
 */
export function shouldSkipHeavyAssets(): boolean {
  return isLiteMode() || isNarrowViewport();
}
