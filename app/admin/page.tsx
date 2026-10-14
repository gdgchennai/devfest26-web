import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAccess, canManageSession, canViewPeople } from "@/lib/admin";
import { getAgenda } from "@/lib/content";
import { getSessionStatuses } from "@/lib/session-status";
import { sessionKey } from "@/lib/session-key";
import { siteConfig } from "@/site.config";
import { HeaderTitle } from "@/components/HeaderTitleContext";
import { AdminSessionRow } from "@/components/admin/AdminSessionRow";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminTrackTabs } from "@/components/admin/AdminTrackTabs";
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
  const access = await getAccess(session.user.uid);
  if (!access) {
    redirect("/");
  }

  const [allSessions, statuses] = await Promise.all([getAgenda(), getSessionStatuses()]);
  // Each person only sees (and can change) the tracks they hold a role on.
  const agenda = allSessions.filter((s) => canManageSession(access, s.track));
  const groups = [
    { slug: "general", name: "General (no track)", track: null as string | null },
    ...siteConfig.tracks.map((t) => ({ slug: t.slug, name: t.name, track: t.slug as string | null })),
  ]
    .map(({ slug, name, track }) => ({
      slug,
      name,
      sessions: agenda.filter((s) => s.track === track).sort((a, b) => a.start.localeCompare(b.start)),
    }))
    .filter((g) => g.sessions.length > 0);

  return (
    <>
      <HeaderTitle title="Admin" />
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
        <AdminNav active="/admin" showPeople={canViewPeople(access)} />
        <h1 className="mt-4 text-xl font-bold text-paper sm:text-2xl">Session status</h1>
        <p className="mt-1 max-w-md text-sm text-paper/60">
          Marking a session started or ended notifies everyone who saved it and has push
          notifications on.
        </p>

        <AdminTrackTabs
          tabs={groups.map(({ slug, name }) => ({ slug, name }))}
          panels={Object.fromEntries(
            groups.map(({ slug, sessions }) => [
              slug,
              sessions.map((s) => {
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
              }),
            ]),
          )}
        />
      </div>
    </>
  );
}
