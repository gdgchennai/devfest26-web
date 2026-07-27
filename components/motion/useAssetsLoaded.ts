import { useEffect, useState } from "react";

/**
 * Minimum time the loader stays up even on an instant (cached) load, so the
 * bounce always reads as a deliberate beat rather than a flash.
 */
const MIN_DURATION = 1200;
/** Hard ceiling — a stalled or failed decode must never trap the visitor. */
const WATCHDOG = 6000;

/**
 * Resolves to `true` once every asset has decoded (or the watchdog fires),
 * but not before MIN_DURATION has elapsed. Drives the loader's hand-off from
 * its bounce loop to the morph — see <Loader>.
 */
export function useAssetsLoaded(assets: string[], disabled: boolean): boolean {
  const [loaded, setLoaded] = useState(disabled);

  useEffect(() => {
    // When disabled, `loaded` already initialised to true — nothing to wait on.
    if (disabled) return;

    let settled = false;
    let remaining = assets.length;
    const start = performance.now();
    let minTimer = 0;

    function settle() {
      if (settled) return;
      settled = true;
      const wait = Math.max(0, MIN_DURATION - (performance.now() - start));
      minTimer = window.setTimeout(() => setLoaded(true), wait);
    }

    if (remaining === 0) settle();
    assets.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      (img.decode ? img.decode() : Promise.resolve())
        .catch(() => {})
        .finally(() => {
          remaining -= 1;
          if (remaining <= 0) settle();
        });
    });

    const watchdog = window.setTimeout(settle, WATCHDOG);

    return () => {
      window.clearTimeout(watchdog);
      window.clearTimeout(minTimer);
    };
    // assets is a fresh array each render; disabled is the only meaningful input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return loaded;
}
