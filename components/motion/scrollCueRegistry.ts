/*
 * A tiny module-level mailbox between the page's horizontal-scroll sections
 * (ExpectShowcase's pinned card row, MoodSection's marquee — both drive
 * ordinary vertical page scroll into horizontal content) and
 * ScrollCueController (the global floating arrow). Each such section is the
 * only thing that knows its own card count and pin geometry, so it publishes
 * a small API here on mount instead of that geometry leaking into shared
 * React context that everyone else would re-render on.
 *
 * More than one of these sections is mounted at once (both are permanent
 * page sections, not lazily mounted on scroll), so this is a small
 * registry, not a single slot — `getHorizontalCueFor` is how the caller
 * (ScrollCueController) picks out the one that actually belongs to whichever
 * section is currently active, rather than whichever registered most
 * recently. A single `current` slot here used to mean the second section to
 * mount permanently won the slot for the rest of the session, regardless of
 * which one the visitor had actually scrolled into.
 */
export type HorizontalCue = {
  /** The pinned stage element — used to test "is this the active section". */
  el: HTMLElement;
  cardCount: number;
  /**
   * The lowest index `activeIndex`/`scrollYForCard` ever produce — normally
   * `0`, or `-1` for a cue whose section has its own distinct "entry"
   * position before card 0 (ExpectShowcase's heading-only state, before any
   * card has slid into centre). Not every cue has one: MoodSection's own
   * index 0 ("just entered") already IS its entry, so its `minIndex` stays
   * `0` — treating -1 as valid there would have `scrollYForCard(-1)`
   * resolve to the exact same position as index 0, making a "back" click at
   * its own card 0 silently do nothing instead of leaving the section.
   * Callers use this to know how far "back" can step before it means
   * leaving the section entirely, rather than assuming -1 always applies.
   */
  minIndex: number;
  /** Index of the card (or, if `minIndex` is -1, possibly the entry)
   *  currently nearest the pin's scrub progress. */
  activeIndex: () => number;
  /** Absolute page scrollY that centres the given index (down to `minIndex`). */
  scrollYForCard: (index: number) => number;
  /** Overrides ScrollCueController's own default pace (pixels/second) for
   *  the button-triggered jump between two of this cue's own positions —
   *  unset means "use the shared default". Per-cue, not global, because a
   *  pace tuned for one section (a short one-card hop) reading too fast or
   *  slow doesn't mean every other section's jump should change too. */
  pixelsPerSecond?: number;
};

const registered = new Set<HorizontalCue>();
const listeners = new Set<() => void>();

/** Registers `cue` and returns the function that unregisters it — call that
 *  from the owning effect's cleanup. Two different sections' cues can be
 *  registered at once; this only ever removes the one it was handed back. */
export function setHorizontalCue(cue: HorizontalCue): () => void {
  registered.add(cue);
  listeners.forEach((fn) => fn());
  return () => {
    registered.delete(cue);
    listeners.forEach((fn) => fn());
  };
}

/** The registered cue whose `el` sits inside `container` — i.e. the one that
 *  actually belongs to the section currently active, not just whichever
 *  registered last. */
export function getHorizontalCueFor(container: HTMLElement | null | undefined): HorizontalCue | null {
  if (!container) return null;
  for (const cue of registered) {
    if (container.contains(cue.el)) return cue;
  }
  return null;
}

export function subscribeHorizontalCue(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
