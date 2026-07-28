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
type Signal = { promise: Promise<void>; resolve: () => void; done: boolean };

const signals: Record<string, Signal> = {};

function get(name: string): Signal {
  let sig = signals[name];
  if (!sig) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    sig = { promise, resolve, done: false };
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

/** A promise that resolves once the named signal is (or becomes) ready. */
export function whenReady(name: string): Promise<void> {
  return get(name).promise;
}

/** The one signal the preloader currently waits on — the 3D brackets backdrop. */
export const BRACKETS_READY = "brackets";
