"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AgendaSession } from "@/lib/schemas";
import type { Track } from "@/site.config";
import { AgendaList } from "@/components/AgendaList";

export function AgendaView({ sessions, tracks }: { sessions: AgendaSession[]; tracks: Track[] }) {
  const searchParams = useSearchParams();
  const requestedTrack = searchParams.get("track");
  const activeTrack = tracks.some((t) => t.slug === requestedTrack) ? requestedTrack! : "all";

  const filtered = activeTrack === "all" ? sessions : sessions.filter((s) => s.track === activeTrack);
  const trackOptions = [{ slug: "all", name: "All" }, ...tracks];

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
