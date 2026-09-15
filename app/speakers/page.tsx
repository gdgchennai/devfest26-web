import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSpeakers } from "@/lib/content";
import { SpeakerWall } from "@/components/SpeakerWall";
import { siteConfig, uiCopy } from "@/site.config";
import { AGENDA_READY } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Speakers",
  description: `Speakers at ${siteConfig.name} — talks, workshops and the call for proposals from ${siteConfig.chapter}.`,
  path: "/speakers",
});
export const revalidate = 300;

export default async function SpeakersPage() {
  if (!AGENDA_READY) notFound();
  const speakers = await getSpeakers();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
      <p className="mb-8 text-center text-base text-paper/70 sm:text-lg">
        {speakers.length === 0 ? uiCopy.speakersPage.cfpOpenBody : uiCopy.speakersPage.moreToComeBody}
      </p>

      <SpeakerWall speakers={speakers} limit={Math.max(6, speakers.length + 1)} />
    </div>
  );
}
