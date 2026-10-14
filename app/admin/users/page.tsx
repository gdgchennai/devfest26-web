import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentAdminUser, isAdminEmail } from "@/lib/admin";
import { listUsersWithTicketNames } from "@/lib/users";
import { HeaderTitle } from "@/components/HeaderTitleContext";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminUserRow } from "@/components/admin/AdminUserRow";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Admin — People",
  description: "Accounts, ticket names, and admin access.",
  path: "/admin/users",
  index: false,
});
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function hrefFor(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const session = await auth();
  if (!session?.user?.uid) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/admin/users")}`);
  }
  const me = await currentAdminUser(session.user.uid);
  if (!me) {
    redirect("/");
  }

  const all = await listUsersWithTicketNames();
  const needle = q.toLowerCase();
  const matches = needle
    ? all.filter((u) =>
        [u.display_name, u.name, u.email, u.ticket_name].some((v) => v?.toLowerCase().includes(needle)),
      )
    : all;
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(first(sp.page), 10) || 1), pageCount);
  const users = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <HeaderTitle title="Admin — People" />
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
        <AdminNav active="/admin/users" />
        <h1 className="mt-4 text-xl font-bold text-paper sm:text-2xl">People</h1>
        <p className="mt-1 max-w-md text-sm text-paper/60">
          Every signed-in account, with the ticket name resolved the same way the profile
          page shows it (so &quot;Volunteer&quot; or &quot;Core Team&quot; shows up here if
          that&apos;s the ticket name KonfHub gave them). Grant admin access from here.
        </p>

        <form action="/admin/users" method="get" role="search" className="mt-6 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, email or ticket"
            aria-label="Search people"
            className="min-w-0 flex-1 rounded-full border border-paper/20 bg-transparent px-4 py-2 text-sm text-paper placeholder:text-paper/40 focus:border-paper/50 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-paper px-4 py-2 text-xs font-medium text-ink transition-opacity hover:opacity-90"
          >
            Search
          </button>
        </form>
        <p className="mt-3 text-xs text-paper/50">
          {matches.length === all.length
            ? `${all.length} people`
            : `${matches.length} of ${all.length} people`}
          {q && (
            <>
              {" · "}
              <Link href="/admin/users" className="underline hover:text-paper">
                Clear search
              </Link>
            </>
          )}
        </p>

        <div className="mt-2">
          {users.length === 0 && <p className="py-6 text-sm text-paper/60">No one matches that search.</p>}
          {await Promise.all(
            users.map(async (user) => (
              <AdminUserRow
                key={user.id}
                userId={user.id}
                name={user.display_name ?? user.name}
                email={user.email}
                ticketName={user.ticket_name}
                initialIsAdmin={user.is_admin === 1}
                envManaged={await isAdminEmail(user.email)}
                isSelf={user.id === me.id}
              />
            )),
          )}
        </div>

        {pageCount > 1 && (
          <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm text-paper">
            {page > 1 ? (
              <Link href={hrefFor(q, page - 1)} className="rounded-full border border-paper/20 px-4 py-1.5 hover:border-paper/40">
                ← Previous
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            <span className="text-xs text-paper/50">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={hrefFor(q, page + 1)} className="rounded-full border border-paper/20 px-4 py-1.5 hover:border-paper/40">
                Next →
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        )}
      </div>
    </>
  );
}
