import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAccess, manageableTracks, canViewPeople } from "@/lib/admin";
import { getAgenda, getSpeakers } from "@/lib/content";
import { getSessionStatuses, type SessionStatus } from "@/lib/session-status";
import { sessionKey } from "@/lib/session-key";
import { findSpeakers, joinSpeakerNames } from "@/lib/find-speaker";
import { getAllLiveHalls } from "@/lib/hall-status";
import { getRecommendedSessionKeys } from "@/lib/recommendations";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminHallControl, type AdminHallSessionItem } from "@/components/admin/AdminHallControl";
import { HeaderTitle } from "@/components/HeaderTitleContext";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Admin — Live Hall",
  description: "Update live hall occupancy, headcount, and in-hall announcements.",
  path: "/admin/halls",
  index: false,
  });

export const dynamic = "force-dynamic";

export default async function AdminHallsPage() {
  const session = await auth();
  if (!session?.user?.uid) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/admin/halls")}`);
  }

  const access = await getAccess(session.user.uid);
  if (!access) {
    redirect("/");
  }

  const allowedTracks = manageableTracks(access);
  if (allowedTracks.length === 0) {
    redirect("/");
  }

  const [allHalls, allSessions, statuses, speakers, recommendedKeys] = await Promise.all([
    getAllLiveHalls(),
    getAgenda(),
    getSessionStatuses(),
    getSpeakers(),
    getRecommendedSessionKeys(),
  ]);
  const myHalls = allHalls.filter((h) => allowedTracks.includes(h.track));

  return (
    <>
      <HeaderTitle title="Admin — Live Hall" />
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-20 pt-24 sm:px-8 sm:pt-28">
        <AdminNav active="/admin/halls" showPeople={canViewPeople(access)} />

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-paper sm:text-2xl">Live Hall Control</h1>
            <p className="mt-1 text-sm text-paper/60">
              Update room occupancy status and broadcast announcements to the public board.
            </p>
          </div>
          <Link
            href="/live"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-full border border-paper/20 px-3 py-1 text-xs text-paper/80 transition-colors hover:border-paper/50 hover:text-paper"
          >
            <span>Preview live board</span>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="mt-8 space-y-6">
          {myHalls.map((hall) => {
            const trackSessions: AdminHallSessionItem[] = allSessions
              .filter((s) => s.track === hall.track && s.type !== "break")
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((s) => {
                const key = sessionKey(s);
                const matchedSpeakers = findSpeakers(speakers, s.speakerSlugs);
                return {
                  sessionKey: key,
                  id: s.id,
                  title: s.title,
                  start: s.start,
                  end: s.end,
                  hall: s.hall,
                  speakerNames: joinSpeakerNames(matchedSpeakers),
                  status: (statuses[key] ?? "upcoming") as SessionStatus,
                  isRecommended: recommendedKeys.has(key),
                };
              });

            return (
              <AdminHallControl
                key={hall.track}
                initialHall={hall}
                initialSessions={trackSessions}
              />
            );
          })}

          {myHalls.length === 0 && (
            <div className="rounded-3xl border border-dashed border-paper/20 p-8 text-center text-paper/60">
              You are not currently assigned to any active tracks.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
