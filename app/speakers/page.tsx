import type { Metadata } from "next";
import Link from "next/link";
import { speakers } from "@/lib/content";
import { Frame } from "@/components/Frame";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "Speakers" };

export default function SpeakersPage() {
  return (
    <div className="px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Speakers</h1>

      {speakers.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            message="The 2026 speaker lineup is being finalised. Want to speak at DevFest Chennai?"
            linkHref="/cfp"
            linkLabel="Submit a talk via the CFP"
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {speakers.map((speaker) => (
            <Link
              key={speaker.slug}
              href={`/speakers/${speaker.slug}`}
              className="rounded-lg border border-paper/10 p-4 hover:bg-paper/5"
            >
              <Frame
                src={speaker.photo}
                alt={`Portrait of ${speaker.name}`}
                title={speaker.name}
                aspectRatio="1 / 1"
              />
              <h3 className="mt-3 font-semibold">{speaker.name}</h3>
              <p className="text-sm text-paper/70">
                {speaker.title} · {speaker.company}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
