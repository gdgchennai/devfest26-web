import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { agenda } from "@/lib/content";
import { siteConfig, uiCopy } from "@/site.config";
import { AgendaView } from "@/components/AgendaView";
import { BracketsField } from "@/components/motion/BracketsField";
import { AGENDA_READY } from "@/lib/routes";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  if (!AGENDA_READY) notFound();

  return (
    <>
      {/* Same 3D brand-shape backdrop the homepage/tickets pages use — see
          app/tickets/page.tsx's identical mount for why this is safe to add
          to any route (page-agnostic, drives off scroll + #footer-logo).
          mode="settled": no drift-then-land sequence to lead into here. */}
      <BracketsField mode="settled" />
      <div className="relative z-10 px-4 py-12 sm:px-8">
        <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">{uiCopy.agendaPage.heading}</h1>

        <Suspense fallback={null}>
          <AgendaView sessions={agenda} tracks={[...siteConfig.tracks]} />
        </Suspense>
      </div>
    </>
  );
}
