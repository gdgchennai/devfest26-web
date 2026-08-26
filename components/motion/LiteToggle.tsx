"use client";

import { useLiteModeToggle } from "@/lib/useLiteModeToggle";
import { uiCopy } from "@/site.config";

/**
 * The lite-mode switch, in the footer of every route.
 *
 * A toggle button (`aria-pressed`) rather than a link whose label flips between
 * "Lite version" and "Full version": that label told you what would happen if
 * you pressed it but never what state you were already in, which is the one
 * thing a preference control has to say.
 *
 * State is visible three ways so no single channel carries it alone — the
 * pressed state for assistive tech, the word on/off for everyone, and the brand
 * dot (the same dot-plus-label idiom as `Eyebrow`) as the at-a-glance cue.
 */
export function LiteToggle() {
  const { lite, setLite } = useLiteModeToggle();

  return (
    <button
      type="button"
      onClick={() => setLite(!lite)}
      aria-pressed={lite}
      className="inline-flex items-center gap-2 text-sm text-paper/70 underline-offset-4 hover:text-paper hover:underline"
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${lite ? "bg-green" : "bg-paper/30"}`}
      />
      {uiCopy.liteToggle.label}
      {/* Redundant with aria-pressed, so it is hidden from assistive tech to
          avoid "Lite version on, pressed". */}
      <span aria-hidden className="text-paper/50">
        {lite ? uiCopy.liteToggle.onLabel : uiCopy.liteToggle.offLabel}
      </span>
    </button>
  );
}
