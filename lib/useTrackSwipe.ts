"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Gesture tuning, in the same spirit as TicketsList's card deck (see its own
 * comments in TicketsList.tsx): decide the axis before acting, so a vertical
 * scroll that happens to carry some horizontal noise is never stolen from the
 * page.
 */
/** Movement before a drag is considered horizontal or vertical at all. */
const AXIS_LOCK_PX = 10;
/** A drag shorter than this is a tap, not a track switch. */
const SWIPE_COMMIT_PX = 72;
/** …unless it's a flick: px per ms, measured over the last move event. */
const FLICK_VELOCITY = 0.5;
/** Horizontal wheel distance (trackpad two-finger scroll) that is one step. */
const WHEEL_STEP_PX = 56;
/** Quiet period after which a new wheel gesture starts fresh. */
const WHEEL_IDLE_MS = 160;

/**
 * Swipes and horizontal trackpad scrolls over the agenda step through its
 * tracks, one per gesture, in both the spatial board and the static list.
 *
 * Three ways in, on purpose:
 *
 * - **Touch swipe** (phone, tablet, touchscreen) — the obvious one.
 * - **Horizontal wheel** — a laptop trackpad's two-finger scroll, which is
 *   what a desktop actually has available. This is why the whole gesture is
 *   worth having at all rather than being a mobile-only nicety.
 * - **Nothing, for a mouse** — a pointer drag is not a swipe, and pretending
 *   otherwise would fight text selection and card taps. Mouse users click a
 *   track tab, which is always there and does exactly the same thing.
 *
 * Vertical gestures are deliberately left alone — the axis lock below bails
 *  the moment a drag reads as vertical, and the wheel handler ignores
 *  anything it can't lock to X — so a vertical drag over the cards scrolls
 *  that track's own timeline (the page everywhere else) instead of switching
 *  track.
 */
export function useTrackSwipe({
  nodeRef,
  count,
  index,
  onStep,
}: {
  nodeRef: RefObject<HTMLElement | null>;
  /** How many tracks there are to step through. */
  count: number;
  /** Index of the active one right now. */
  index: number;
  /** Called with the step that was committed (-1 / 1), after clamping. */
  onStep: (direction: -1 | 1) => void;
}) {
  // Latest callback and bounds without re-attaching every listener on each
  // render — the board re-renders as its focused session changes.
  const onStepRef = useRef(onStep);
  useEffect(() => {
    onStepRef.current = onStep;
  });

  const boundsRef = useRef({ count, index });
  useEffect(() => {
    boundsRef.current = { count, index };
  });

  useEffect(() => {
    const element = nodeRef.current;
    if (!element) return;
    // A narrowed alias: the guard above narrows `element` for the rest of this
    // block, but not for the listener functions below it (TypeScript keeps
    // their view at the declared type), and every handler needs the node.
    const surface: HTMLElement = element;

    /** Clamped, then handed to the caller. Returns whether it went anywhere —
     *  at the ends of the row a swipe is simply a no-op. */
    function step(direction: -1 | 1): boolean {
      const { count, index } = boundsRef.current;
      const next = index + direction;
      if (count <= 1 || next < 0 || next >= count) return false;
      onStepRef.current(direction);
      return true;
    }

    // ── Touch drag ────────────────────────────────────────────────────
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let axis: "h" | "v" | null = null;
    let suppressClick = false;

    function onPointerDown(e: PointerEvent) {
      // A mouse drag isn't a swipe (see the doc comment) — leave it to text
      // selection and taps.
      if (e.pointerType === "mouse") return;
      if (pointerId !== null) return;
      pointerId = e.pointerId;
      startX = lastX = e.clientX;
      startY = e.clientY;
      lastT = e.timeStamp;
      velocity = 0;
      axis = null;
      // Capture keeps the events coming if the finger wanders off the strip
      // or the stage mid-gesture.
      surface.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (axis === null) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        // Vertical owns the gesture: drop it and let the page scroll. The
        // browser sends pointercancel here anyway (the element is
        // touch-pan-y), but releasing now is what makes the next drag work.
        axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        if (axis === "v") {
          pointerId = null;
          return;
        }
      }
      velocity = (e.clientX - lastX) / Math.max(1, e.timeStamp - lastT);
      lastX = e.clientX;
      lastT = e.timeStamp;
    }

    function endPointer(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      if (axis !== "h") return;
      axis = null;
      const dx = e.clientX - startX;
      const flick = Math.abs(velocity) > FLICK_VELOCITY ? (velocity < 0 ? 1 : -1) : 0;
      const direction = flick !== 0 ? flick : Math.abs(dx) > SWIPE_COMMIT_PX ? (dx < 0 ? 1 : -1) : 0;
      if (direction === 0) return;
      if (!step(direction)) return;
      // The browser still fires a click after this drag. A track switch
      // shouldn't also activate whatever card the swipe started on.
      suppressClick = true;
    }

    function onClickCapture(e: MouseEvent) {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }

    surface.addEventListener("pointerdown", onPointerDown);
    surface.addEventListener("pointermove", onPointerMove);
    surface.addEventListener("pointerup", endPointer);
    surface.addEventListener("pointercancel", endPointer);
    surface.addEventListener("click", onClickCapture, true);

    // ── Horizontal wheel (trackpad) ───────────────────────────────────
    // Same axis lock, and never stopPropagation: Lenis listens on window and
    // the page's vertical scroll must keep working untouched. preventDefault
    // only once the gesture has committed to X, where the only thing the
    // browser would otherwise do with it is overscroll (Chrome's back
    // gesture on some platforms).
    let wheelAxis: "h" | "v" | null = null;
    let wheelAxisTimer = 0;
    let wheelAccum = 0;

    function onWheel(e: WheelEvent) {
      let dx = e.deltaX;
      let dy = e.deltaY;
      // deltaMode 1 is lines rather than pixels.
      if (e.deltaMode === 1) {
        dx *= 16;
        dy *= 16;
      }
      window.clearTimeout(wheelAxisTimer);
      wheelAxisTimer = window.setTimeout(() => {
        wheelAxis = null;
      }, WHEEL_IDLE_MS);
      if (wheelAxis === null) {
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        // Strict: as much Y as X is the page scrolling, not the tracks.
        wheelAxis = Math.abs(dx) > Math.abs(dy) * 1.75 ? "h" : "v";
      }
      if (wheelAxis !== "h") return;
      e.preventDefault();
      wheelAccum += Math.abs(dx);
      if (wheelAccum < WHEEL_STEP_PX) return;
      wheelAccum = 0;
      step(dx < 0 ? 1 : -1);
    }

    surface.addEventListener("wheel", onWheel, { passive: false, capture: true });

    return () => {
      window.clearTimeout(wheelAxisTimer);
      surface.removeEventListener("pointerdown", onPointerDown);
      surface.removeEventListener("pointermove", onPointerMove);
      surface.removeEventListener("pointerup", endPointer);
      surface.removeEventListener("pointercancel", endPointer);
      surface.removeEventListener("click", onClickCapture, true);
      surface.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [nodeRef]);
}
