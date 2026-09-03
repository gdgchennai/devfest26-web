import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { speakers } from "@/lib/content";
import { SpeakerWall } from "@/components/SpeakerWall";
import { uiCopy } from "@/site.config";
import { AGENDA_READY } from "@/lib/routes";

export const metadata: Metadata = { title: "Speakers" };
export const dynamic = "force-static";

export default function SpeakersPage() {
  if (!AGENDA_READY) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{uiCopy.speakersPage.heading}</h1>
      <p className="mt-3 max-w-xl text-paper/70">
        {speakers.length === 0 ? uiCopy.speakersPage.cfpOpenBody : uiCopy.speakersPage.moreToComeBody}
      </p>

      <div className="mt-8">
        <SpeakerWall limit={Math.max(6, speakers.length + 1)} />
      </div>
    </div>
  );
}
