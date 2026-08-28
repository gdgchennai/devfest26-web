import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { agenda } from "@/lib/content";
import { listFavorites } from "@/lib/favorites";
import { sessionsForKeys } from "@/lib/session-key";
import { BracketsField } from "@/components/motion/BracketsField";
import { AgendaList } from "@/components/AgendaList";

export const metadata: Metadata = { title: "My agenda", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyAgendaPage() {
  const session = await auth();
  if (!session?.user?.uid) redirect("/signin?callbackUrl=/my-agenda");

  const keys = await listFavorites(session.user.uid);
  const sessions = sessionsForKeys(agenda, keys).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <>
      <BracketsField mode="settled" />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">My agenda</h1>

        {sessions.length === 0 ? (
          <div className="mt-10 rounded-lg border border-paper/10 p-8 text-center">
            <p className="text-paper/70">You haven&apos;t saved any sessions yet.</p>
            <Link
              href="/agenda"
              className="mt-4 inline-block rounded-full border border-paper/15 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-paper/40 hover:text-paper"
            >
              Browse the agenda →
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <AgendaList sessions={sessions} showFavorite />
          </div>
        )}
      </div>
    </>
  );
}
