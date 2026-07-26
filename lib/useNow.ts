"use client";

import { useRef, useSyncExternalStore } from "react";

function getServerNow() {
  return null;
}

/**
 * The current time, or `null` on the server and on the first client render.
 * Anything that highlights "what's on right now" has to render identically on
 * both sides or hydration mismatches, so the null pass is deliberate: markup
 * ships with nothing highlighted and the marker appears after mount.
 *
 * Extracted from AgendaList when the homepage timeline needed the same clock.
 */
export function useNow(): Date | null {
  // getSnapshot reads this cached ref rather than calling Date.now() itself,
  // so it returns a stable value between the minute-by-minute notifications
  // useSyncExternalStore requires (calling Date.now() directly as getSnapshot
  // would "change" on every call and defeat the point of the store).
  const cachedNow = useRef<number | null>(null);
  const nowMs = useSyncExternalStore(
    (callback) => {
      cachedNow.current = Date.now();
      callback();
      const id = setInterval(() => {
        cachedNow.current = Date.now();
        callback();
      }, 60_000);
      return () => clearInterval(id);
    },
    () => cachedNow.current,
    getServerNow,
  );

  return nowMs === null ? null : new Date(nowMs);
}
