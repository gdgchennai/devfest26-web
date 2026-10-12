import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSpeakers } from "@/lib/content";
import { SpeakerWall } from "@/components/SpeakerWall";
import { siteConfig } from "@/site.config";
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
      <SpeakerWall speakers={speakers} limit={speakers.length} />
    </div>
  );
}
