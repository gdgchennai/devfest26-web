import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentAdminUser } from "@/lib/admin";
import { getAgenda } from "@/lib/content";
import { getSessionStatuses } from "@/lib/session-status";
import { sessionKey } from "@/lib/session-key";
import { siteConfig } from "@/site.config";
import { HeaderTitle } from "@/components/HeaderTitleContext";
import { AdminSessionRow } from "@/components/admin/AdminSessionRow";
import { AdminNav } from "@/components/admin/AdminNav";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Admin",
  description: "Mark agenda sessions started/ended.",
  path: "/admin",
  index: false,
});
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.uid) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/admin")}`);
  }
  if (!(await currentAdminUser(session.user.uid))) {
    redirect("/");
  }

  const [agenda, statuses] = await Promise.all([getAgenda(), getSessionStatuses()]);

  return (
    <>
      <HeaderTitle title="Admin" />
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
        <AdminNav active="/admin" />
        <h1 className="mt-4 text-xl font-bold text-paper sm:text-2xl">Session status</h1>
        <p className="mt-1 max-w-md text-sm text-paper/60">
          Marking a session started or ended notifies everyone who saved it and has push
          notifications on.
        </p>

        {[
          { slug: "general", name: "General (no track)", sessions: agenda.filter((s) => s.track === null) },
          ...siteConfig.tracks.map((track) => ({
            slug: track.slug,
            name: track.name,
            sessions: agenda.filter((s) => s.track === track.slug),
          })),
        ].map(({ slug, name, sessions: trackSessions }) => {
          const sessions = [...trackSessions].sort((a, b) => a.start.localeCompare(b.start));
          if (sessions.length === 0) return null;
          return (
            <section key={slug} className="mt-8 sm:mt-10">
              <h2 className="text-lg font-medium text-paper">{name}</h2>
              <div className="mt-2">
                {sessions.map((s) => {
                  const key = sessionKey(s);
                  return (
                    <AdminSessionRow
                      key={key}
                      sessionKey={key}
                      title={s.title}
                      hall={s.hall}
                      start={s.start}
                      end={s.end}
                      initialStatus={statuses[key] ?? "upcoming"}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
