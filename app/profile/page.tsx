import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { countFavorites } from "@/lib/favorites";
import { BracketsField } from "@/components/motion/BracketsField";
import { DisplayNameForm } from "@/components/auth/DisplayNameForm";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { CopyField } from "@/components/auth/CopyField";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.uid) redirect("/signin?callbackUrl=/profile");

  const user = await getUserById(session.user.uid);
  if (!user) redirect("/signin?callbackUrl=/profile");

  const saved = await countFavorites(user.id);
  const displayName = user.display_name || user.name || "there";
  const memberSince = new Date(user.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <BracketsField mode="settled" />
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-12 sm:px-8">
        <div className="flex items-center gap-4">
          {user.image && (
            // Plain img: the avatar is a Google-hosted URL, outside the
            // ImageKit loader next/image uses in production.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              width={64}
              height={64}
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-full border border-paper/10"
            />
          )}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{displayName}</h1>
            {user.email && <p className="text-paper/60">{user.email}</p>}
          </div>
        </div>

        <dl className="mt-10 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-xs uppercase tracking-wide text-paper/50">User ID</dt>
            <dd className="mt-1">
              <CopyField value={user.id} />
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-wide text-paper/50">Member since</dt>
            <dd className="mt-1 text-paper/80">{memberSince}</dd>
          </div>
        </dl>

        <div className="mt-10">
          <h2 className="font-mono text-xs uppercase tracking-wide text-paper/50">Display name</h2>
          <p className="mt-1 text-sm text-paper/60">
            Shown here instead of your Google name. Leave blank to use your Google name.
          </p>
          <div className="mt-3">
            <DisplayNameForm current={user.display_name ?? ""} />
          </div>
        </div>

        <div className="mt-10 rounded-lg border border-paper/10 p-5">
          <p className="text-lg font-medium">
            {saved === 0 ? "No saved sessions yet" : `${saved} saved session${saved === 1 ? "" : "s"}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/my-agenda"
              className="rounded-full border border-paper/15 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-paper/40 hover:text-paper"
            >
              View my agenda →
            </Link>
            <Link
              href="/agenda"
              className="rounded-full border border-paper/15 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-paper/40 hover:text-paper"
            >
              Browse the agenda →
            </Link>
          </div>
        </div>

        <div className="mt-10">
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
