import { useSyncExternalStore } from "react";

function subscribeNever() {
  return () => {};
}

/**
 * Reads a client-only value (matchMedia, sessionStorage, localStorage...)
 * without the setState-in-effect pattern — the value is decided once on
 * mount and doesn't change reactively afterwards in this app, so a store
 * that never notifies subscribers is the correct (and lint-clean) fit.
 */
export function useClientValue<T>(getSnapshot: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeNever, getSnapshot, () => serverValue);
}
