/**
 * A tiny module-level registry of one-shot "ready" signals, so a component deep
 * in one part of the tree (e.g. the 3D <BracketsField> backdrop) can tell the
 * preloader — which lives in a sibling subtree — when its heavy assets have
 * finished loading, without prop-drilling or a context.
 *
 * Each named signal is a latched promise: whichever call arrives first
 * (markReady or whenReady) creates it, and once marked it stays resolved for
 * the life of the page. Ordering-safe: a whenReady() after markReady() gets an
 * already-resolved promise. Module state resets on a full reload, which is the
 * only time the preloader runs, so no manual reset is needed.
 */
type Signal = { promise: Promise<void>; resolve: () => void; done: boolean; failed: boolean };

const signals: Record<string, Signal> = {};

function get(name: string): Signal {
  let sig = signals[name];
  if (!sig) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    sig = { promise, resolve, done: false, failed: false };
    signals[name] = sig;
  }
  return sig;
}

/** Mark a named signal ready. Idempotent — safe to call more than once. */
export function markReady(name: string): void {
  const sig = get(name);
  if (!sig.done) {
    sig.done = true;
    sig.resolve();
  }
}

/**
 * Settle a signal as FAILED. Waiters are still released — a failure must never
 * leave the preloader hanging — but the failure is recorded so a waiter can ask
 * afterwards whether this actually succeeded.
 *
 * The distinction matters because "released" and "succeeded" were previously the
 * same thing: BracketsField called markReady() from its own catch block, so a
 * three.js chunk that failed to download looked identical to one that loaded,
 * and the preloader handed off to a hero that could never render.
 */
export function markFailed(name: string): void {
  const sig = get(name);
  if (!sig.done) {
    sig.done = true;
    sig.failed = true;
    sig.resolve();
  }
}

/** Whether a settled signal settled as a failure. Meaningless before it settles. */
export function didFail(name: string): boolean {
  return get(name).failed;
}

/** A promise that resolves once the named signal is (or becomes) ready. */
export function whenReady(name: string): Promise<void> {
  return get(name).promise;
}

/** The one signal the preloader currently waits on — the 3D brackets backdrop. */
export const BRACKETS_READY = "brackets";
