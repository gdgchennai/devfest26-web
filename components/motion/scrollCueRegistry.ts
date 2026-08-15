/*
 * A tiny module-level mailbox between ExpectShowcase (the one section that
 * scrolls its content horizontally, driven by ordinary vertical page scroll
 * scrubbing a pinned ScrollTrigger) and ScrollCueController (the global
 * floating arrow). ExpectShowcase is the only component that knows its own
 * card count and pin geometry, so it publishes a small API here on mount
 * instead of that geometry leaking into shared React context that everyone
 * else would re-render on.
 */
export type HorizontalCue = {
  /** The pinned stage element — used to test "is this the active section". */
  el: HTMLElement;
  cardCount: number;
  /** 0-based index of the card currently centred by the pin's scrub progress. */
  activeIndex: () => number;
  /** Absolute page scrollY that centres the given card index. */
  scrollYForCard: (index: number) => number;
};

let current: HorizontalCue | null = null;
const listeners = new Set<() => void>();

export function setHorizontalCue(cue: HorizontalCue | null) {
  current = cue;
  listeners.forEach((fn) => fn());
}

export function getHorizontalCue() {
  return current;
}

export function subscribeHorizontalCue(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
