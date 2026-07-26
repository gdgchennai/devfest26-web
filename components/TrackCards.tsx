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
        <h3 className={`font-mono text-sm uppercase tracking-wide ${color.text}`}>{track.name}</h3>
        <p className="mt-2 text-sm text-paper/70">{track.description}</p>
      </Card>
    </div>
  );
}
