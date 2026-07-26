"use client";

import { useEffect } from "react";

/**
 * Browse controls for the settled photo stack.
 *
 * Deliberately does NOT capture scroll. The hallway releases its pin as normal
 * and the page keeps scrolling past at any moment — advancing the stack is an
 * explicit action, so a visitor heading for the agenda is never held through a
 * dozen photos they did not ask for.
 *
 * Real buttons rather than click handlers on the cards: that gives keyboard and
 * screen-reader users the same affordance, and the arrow keys below are a
 * shortcut on top of it rather than the only way in.
 */
export function StackControls({
  active,
  count,
  onCycle,
  className = "",
}: {
  /** True once the stack has formed. Controls are inert and hidden before that. */
  active: boolean;
  count: number;
  onCycle: (delta: number) => void;
  className?: string;
}) {
  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      // Leave modified presses alone — those are browser shortcuts.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onCycle(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onCycle(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onCycle]);

  if (count < 2) return null;

  return (
    <div
      className={`absolute inset-x-0 bottom-6 z-[400] flex items-center justify-center gap-3 transition-opacity duration-300 ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      } ${className}`.trim()}
      aria-hidden={!active}
    >
      <button
        type="button"
        onClick={() => onCycle(-1)}
        disabled={!active}
        aria-label="Previous photo"
        className="rounded-full border border-paper/30 bg-ink/70 px-4 py-2 font-mono text-xs uppercase tracking-wide text-paper hover:bg-paper/10"
      >
        Prev
      </button>
      <span className="font-mono text-xs uppercase tracking-wide text-paper/60">
        {count} photos
      </span>
      <button
        type="button"
        onClick={() => onCycle(1)}
        disabled={!active}
        aria-label="Next photo"
        className="rounded-full border border-paper/30 bg-ink/70 px-4 py-2 font-mono text-xs uppercase tracking-wide text-paper hover:bg-paper/10"
      >
        Next
      </button>
    </div>
  );
}
