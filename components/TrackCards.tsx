"use client";

import { useRef } from "react";
import { Card } from "@/components/Card";
import { trackColor } from "@/lib/track-color";
import type { Track } from "@/site.config";

/**
 * The four tracks, each in its own Google colour, with a soft spotlight that
 * follows the pointer inside the card.
 *
 * All four rendered in `text-blue` before this, which wasted the one place on
 * the site where the palette maps perfectly onto the content: four tracks,
 * four core colours. Colour comes from lib/track-color so the agenda and the
 * homepage can never disagree about which colour "cloud" is.
 *
 * The spotlight writes CSS custom properties directly on the node rather than
 * going through state — this fires on every pointermove, and a re-render per
 * frame for a decorative gradient is not a trade worth making.
 */
export function TrackCards({ tracks }: { tracks: readonly Track[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {tracks.map((track) => (
        <TrackCard key={track.slug} track={track} />
      ))}
    </div>
  );
}

function TrackCard({ track }: { track: Track }) {
  const ref = useRef<HTMLDivElement>(null);
  const color = trackColor(track.slug);

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
        el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
        el.style.setProperty("--spot-on", "1");
      }}
      onPointerLeave={() => ref.current?.style.setProperty("--spot-on", "0")}
      className="track-card h-full"
      style={{ "--spot-color": color.cssVar } as React.CSSProperties}
    >
      <Card accentClass={color.bg} className="h-full">
        {/*
         * The track's colour lives on the accent hairline above (accentClass),
         * not on this text. It was `color.text`, and that one choice was what
         * capped how much of the 3D backdrop these cards could let through:
         * #ea4335 is the weakest brand colour at 5.35:1 on black, so a bracket
         * drifting behind a red track card dragged its heading toward AA and
         * held every card on the page to 8% bleed. On --paper the same cards
         * clear 29%. Nothing is lost — the track is named in the text itself,
         * and the hairline still carries the colour, which is the more correct
         * place for it anyway (WCAG 1.4.1: colour shouldn't be doing
         * identification work on its own).
         *
         * Deliberately not changed in lib/track-color.ts — AgendaTimeline still
         * uses color.text, and /agenda has no BracketsField behind it.
         */}
        <h3 className="font-mono text-sm uppercase tracking-wide text-paper">{track.name}</h3>
        <p className="mt-2 text-sm text-paper/70">{track.description}</p>
      </Card>
    </div>
  );
}
