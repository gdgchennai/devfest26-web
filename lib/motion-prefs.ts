export const LITE_STORAGE_KEY = "devfest-lite";
export const INTRO_SEEN_KEY = "devfest-intro-seen";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Whether the connection is metered/slow. NOTE: no longer used for gating — the
 * experience is deliberately identical on every connection (the preloader holds
 * until everything is ready, rather than downgrading slow visitors to a static
 * page). Kept for potential future use / diagnostics. Also: Chrome DevTools
 * network throttling reports `effectiveType: "slow-2g"` for its 3G presets, so
 * gating on this made the intro impossible to test under throttling.
 */
export function isSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === "2g" || connection.effectiveType === "slow-2g";
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
 * True when the full motion layer (preloader, intro, hallway, 3D) should be
 * skipped entirely and the visitor sent straight to the static site.
 *
 * The experience is intentionally consistent on every connection speed — the
 * bouncing preloader holds until everything is ready rather than downgrading
 * slow/save-data visitors. So the ONLY opt-outs are an explicit accessibility
 * preference (reduced-motion) and the manual lite toggle (`?lite=1`). Save-data
 * / slow-connection deliberately does NOT downgrade anymore (see isSaveData).
 */
export function shouldUseStaticBaseline(): boolean {
  return prefersReducedMotion() || isLiteMode();
}

/**
 * True when a heavy optional download (three.js, chiefly) must not be fetched
 * at all. Now only the manual lite toggle opts out — every real connection gets
 * the full 3D experience, with the preloader covering the download time.
 *
 * Deliberately NOT gated on reduced-motion: that is a vestibular preference, not
 * a bandwidth one, so those visitors still get still imagery (rendered once
 * instead of animated), just nothing that moves.
 */
export function shouldSkipHeavyAssets(): boolean {
  return isLiteMode();
}
