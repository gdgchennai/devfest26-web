"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AgendaSession } from "@/lib/schemas";
import type { Track } from "@/site.config";
import { AgendaList } from "@/components/AgendaList";
import { AgendaBoard } from "@/components/AgendaBoard";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { uiCopy } from "@/site.config";

export function AgendaView({ sessions, tracks }: { sessions: AgendaSession[]; tracks: Track[] }) {
  const searchParams = useSearchParams();
  const requestedTrack = searchParams.get("track");
  const activeTrack = tracks.some((t) => t.slug === requestedTrack) ? requestedTrack! : "all";
  // Static baseline (reduced-motion or ?lite=1) gets the flat instant-paint
  // list below; everyone else gets the spatial board. Defaults to the safe
  // static list on the server/first paint, same convention as every other
  // lite-gated component (see MotionProvider.tsx and its siblings).
  const staticBaseline = useClientValue(shouldUseStaticBaseline, true);

  if (!staticBaseline) {
    return <AgendaBoard sessions={sessions} tracks={tracks} activeTrack={activeTrack} />;
  }

  const filtered = activeTrack === "all" ? sessions : sessions.filter((s) => s.track === activeTrack);
  const trackOptions = [{ slug: "all", name: uiCopy.agendaView.allTracksLabel }, ...tracks];

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        {trackOptions.map((t) => (
          <Link
            key={t.slug}
            href={t.slug === "all" ? "/agenda" : `/agenda?track=${t.slug}`}
            scroll={false}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeTrack === t.slug
                ? "bg-blue text-paper"
                : "bg-paper/10 text-paper/80 hover:bg-paper/20"
            }`}
          >
            {t.name}
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <AgendaList sessions={filtered} />
      </div>
    </>
  );
}
