export const LITE_STORAGE_KEY = "devfest-lite";
export const INTRO_SEEN_KEY = "devfest-intro-seen";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === "2g" || connection.effectiveType === "slow-2g";
}

export function isLiteMode(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("lite") === "1") {
    window.localStorage.setItem(LITE_STORAGE_KEY, "1");
    return true;
  }
  return window.localStorage.getItem(LITE_STORAGE_KEY) === "1";
}

export function clearLiteMode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LITE_STORAGE_KEY);
}

/** True when the full motion layer (loader, curtain, hallway/pile) should be skipped entirely. */
export function shouldUseStaticBaseline(): boolean {
  return prefersReducedMotion() || isSaveData() || isLiteMode();
}
