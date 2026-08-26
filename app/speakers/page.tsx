import type { Metadata } from "next";
import { speakers } from "@/lib/content";
import { SpeakerWall } from "@/components/SpeakerWall";
import { uiCopy } from "@/site.config";

export const metadata: Metadata = { title: "Speakers" };

export default function SpeakersPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{uiCopy.speakersPage.heading}</h1>
      <p className="mt-3 max-w-xl text-paper/70">
        {speakers.length === 0 ? uiCopy.speakersPage.cfpOpenBody : uiCopy.speakersPage.moreToComeBody}
      </p>

      {/* Same roster component as the homepage — showing every confirmed
          speaker rather than a preview, so the open places and the CFP
          invitation read identically on both surfaces. Replaces a lone
          EmptyState that said the same thing with none of the affordance. */}
      <div className="mt-8">
        <SpeakerWall limit={Math.max(6, speakers.length + 1)} />
      </div>
    </div>
  );
}
