"use client";

import { useSearchParams } from "next/navigation";
import type { AgendaSession, Speaker } from "@/lib/schemas";
import { siteConfig, type Track } from "@/site.config";
import { AgendaList } from "@/components/AgendaList";
import { AgendaBoard } from "@/components/AgendaBoard";
import { AgendaControls } from "@/components/AgendaControls";
import { floorTracks, resolveFloor } from "@/lib/agenda-floors";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";

export function AgendaView({
  sessions,
  speakers,
  tracks,
}: {
  sessions: AgendaSession[];
  speakers: Speaker[];
  tracks: Track[];
}) {
  const searchParams = useSearchParams();
  const requestedTrack = searchParams.get("track");
  // Nothing is hidden per floor: every track and session stays in play, with
  // tracks ordered floor by floor. The floor/track dropdowns only jump to one.
  const floors = siteConfig.floors;
  const orderedTracks = floors.flatMap((f) => floorTracks(f, tracks));
  const floor = resolveFloor(floors, searchParams.get("floor"), requestedTrack);
  const activeTrack = orderedTracks.some((t) => t.slug === requestedTrack) ? requestedTrack! : "all";
  // Static baseline (reduced-motion or ?lite=1) gets the flat instant-paint
  // list below; everyone else gets the spatial board. Defaults to the safe
  // static list on the server/first paint, same convention as every other
  // lite-gated component (see MotionProvider.tsx and its siblings).
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);
  // "Simple view" is the user's own switch (?view=simple). It shows the same
  // flat table lite mode does, but never flips lite mode itself.
  const simpleRequested = searchParams.get("view") === "simple";

  if (!staticBaseline && !simpleRequested) {
    return (
      <AgendaBoard
        sessions={sessions}
        speakers={speakers}
        tracks={orderedTracks}
        activeTrack={activeTrack}
        floors={floors}
      />
    );
  }

  const filtered = activeTrack === "all" ? sessions : sessions.filter((s) => s.track === activeTrack);

  return (
    <>
      <div className="mt-6">
        <AgendaControls
          floors={floors}
          floor={floor.slug}
          tracks={floorTracks(floor, tracks)}
          value={activeTrack}
          simple
          simpleLocked={staticBaseline}
          allowAll
        />
      </div>

      <div className="mt-8">
        <AgendaList sessions={filtered} showFavorite />
      </div>
    </>
  );
}
