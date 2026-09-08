import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAgenda, getSpeakers } from "@/lib/content";
import { siteConfig } from "@/site.config";
import { AgendaView } from "@/components/AgendaView";
import { BracketsField } from "@/components/motion/BracketsField";
import { AGENDA_READY } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Agenda",
  description: `Full session schedule for ${siteConfig.name} at ${siteConfig.venue.name} — talks, workshops and lounges across every track.`,
  path: "/agenda",
});
export const revalidate = 300;

export default async function AgendaPage() {
  if (!AGENDA_READY) notFound();
  const [agenda, speakers] = await Promise.all([getAgenda(), getSpeakers()]);

  return (
    <>
      {/* Same 3D brand-shape backdrop the homepage/tickets pages use — see
          app/tickets/page.tsx's identical mount for why this is safe to add
          to any route (page-agnostic, drives off scroll + #footer-logo).
          mode="settled": no drift-then-land sequence to lead into here. */}
      <BracketsField mode="settled" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
        <Suspense fallback={null}>
          <AgendaView sessions={agenda} speakers={speakers} tracks={[...siteConfig.tracks]} />
        </Suspense>
      </div>
    </>
  );
}
