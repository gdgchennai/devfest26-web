import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgenda, getSpeakers } from "@/lib/content";
import { SpeakerWall } from "@/components/SpeakerWall";
import { sortSpeakersByAgenda } from "@/lib/find-speaker";
import { siteConfig } from "@/site.config";
import { AGENDA_READY } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Speakers",
  description: `Speakers at ${siteConfig.name} — talks, workshops and the call for proposals from ${siteConfig.chapter}.`,
  path: "/speakers",
});
export const revalidate = 300;

/** The keynote duo open the roster regardless of where their own talk falls
 *  in the day — everyone else follows in the order their talk happens. */
const PINNED_SPEAKER_SLUGS = ["swaathi-kakarla", "karthik-kamalakannan"];

export default async function SpeakersPage() {
  if (!AGENDA_READY) notFound();
  const [speakers, agenda] = await Promise.all([getSpeakers(), getAgenda()]);
  const ordered = sortSpeakersByAgenda(speakers, agenda, PINNED_SPEAKER_SLUGS);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
      <SpeakerWall speakers={ordered} limit={ordered.length} />
    </div>
  );
}
