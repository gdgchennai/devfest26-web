import type { Metadata } from "next";
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

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user?.uid) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/admin/users")}`);
  }
  const me = await currentAdminUser(session.user.uid);
  if (!me) {
    redirect("/");
  }

  const users = await listUsersWithTicketNames();

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

        <div className="mt-6">
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
      </div>
    </>
  );
}
