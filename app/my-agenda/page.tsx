import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAgenda } from "@/lib/content";
import { listFavorites } from "@/lib/favorites";
import { sessionsForKeys } from "@/lib/session-key";
import { AGENDA_READY } from "@/lib/routes";
import { BracketsField } from "@/components/motion/BracketsField";
import { AgendaList } from "@/components/AgendaList";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "My agenda",
  description: "Sessions you've saved for DevFest Chennai.",
  path: "/my-agenda",
  index: false,
});
export const dynamic = "force-dynamic";

export default async function MyAgendaPage() {
  if (!AGENDA_READY) notFound();

  const session = await auth();
  if (!session?.user?.uid) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/my-agenda")}`);
  }

  const keys = await listFavorites(session.user.uid);
  const agenda = await getAgenda();
  const sessions = sessionsForKeys(agenda, keys).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <>
      <BracketsField mode="settled" />
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
        <p className="mb-8 text-center text-base text-paper/70 sm:text-lg">
          Sessions you&apos;ve saved for DevFest Chennai.
        </p>

        {sessions.length === 0 ? (
          <div className="rounded-lg border border-paper/10 p-8 text-center">
            <p className="text-paper/70">You haven&apos;t saved any sessions yet.</p>
            <Link
              href="/agenda"
              className="mt-4 inline-block rounded-full border border-paper/15 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-paper/40 hover:text-paper"
            >
              Browse the agenda →
            </Link>
          </div>
        ) : (
          <AgendaList sessions={sessions} showFavorite />
        )}
      </div>
    </>
  );
}
