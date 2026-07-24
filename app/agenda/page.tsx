import { Suspense } from "react";
import type { Metadata } from "next";
import { agenda } from "@/lib/content";
import { siteConfig, formatEventDate } from "@/site.config";
import { AgendaView } from "@/components/AgendaView";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  return (
    <div className="px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Agenda</h1>
      <p className="mt-2 font-mono text-sm tabular-nums text-paper/70">
        {formatEventDate(siteConfig.date)} · {siteConfig.venue.line2}
      </p>
      <p className="mt-2 max-w-xl text-sm text-paper/60">
        Sessions and speakers below are a placeholder shape of the day — the final schedule will
        replace this closer to the event.
      </p>

      <Suspense fallback={null}>
        <AgendaView sessions={agenda} tracks={[...siteConfig.tracks]} />
      </Suspense>
    </div>
  );
}
