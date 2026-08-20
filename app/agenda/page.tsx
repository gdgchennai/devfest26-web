import { Suspense } from "react";
import type { Metadata } from "next";
import { agenda } from "@/lib/content";
import { siteConfig } from "@/site.config";
import { AgendaView } from "@/components/AgendaView";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  return (
    <div className="px-4 py-12 sm:px-8">
      <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">Agenda</h1>

      <Suspense fallback={null}>
        <AgendaView sessions={agenda} tracks={[...siteConfig.tracks]} />
      </Suspense>
    </div>
  );
}
