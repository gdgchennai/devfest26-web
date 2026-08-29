import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getTicketByEmail, type TicketRecord } from "@/lib/tickets";
import { countFavorites } from "@/lib/favorites";
import { AGENDA_READY } from "@/lib/routes";
import { EVENT_TIME_ZONE } from "@/lib/format";
import { BracketsField } from "@/components/motion/BracketsField";
import { GlowButton } from "@/components/GlowButton";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { CopyField } from "@/components/auth/CopyField";
import { ClaimTicketForm } from "@/components/auth/ClaimTicketForm";
import { EditTicket } from "@/components/auth/EditTicket";

export const metadata: Metadata = { title: "My profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.uid) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/profile")}`);
  }

  const user = await getUserById(session.user.uid);
  if (!user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/profile")}`);
  }

  const ticket = user.email ? await getTicketByEmail(user.email) : null;

  return (
    <>
      <BracketsField mode="settled" />
      <div className="relative z-10 mx-auto max-w-2xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
        <ProfileContent user={user} ticket={ticket} saved={await countFavorites(user.id)} />
      </div>
    </>
  );
}

/** "17 October 2026, 9:30 AM" in venue time. */
function formatCheckIn(ms: number): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: EVENT_TIME_ZONE,
  });
  return `${date}, ${time}`;
}

function ProfileContent({
  user,
  ticket,
  saved,
}: {
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>;
  ticket: TicketRecord | null;
  saved: number;
}) {
  return (
    <>
      <div className="flex items-center gap-3 sm:gap-4">
        {user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            width={64}
            height={64}
            referrerPolicy="no-referrer"
            className="h-14 w-14 shrink-0 rounded-full border border-paper/10 sm:h-16 sm:w-16"
          />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {user.name ?? "My profile"}
          </h1>
          {user.email && <p className="truncate text-sm text-paper/60 sm:text-base">{user.email}</p>}
        </div>
      </div>

      {ticket?.checked_in === 1 && (
        <div className="mt-8 sm:mt-10">
          <p className="text-lg font-semibold">
            You&apos;re in now. Welcome to DevFest. We hope you have a great day!
          </p>
          <p className="mt-2 max-w-md text-sm text-paper/70">
            Don&apos;t feel shy to talk, take pictures, socialize. Reach out to us if you need anything
            at all today!
          </p>
          {ticket.check_in_time && (
            <p className="mt-3 font-mono text-xs uppercase tracking-wide text-paper/50">
              Checked in at {formatCheckIn(ticket.check_in_time)}
            </p>
          )}
        </div>
      )}

      {AGENDA_READY && (
        <div className="mt-8 sm:mt-10">
          <p className="text-lg font-medium">
            {saved === 0
              ? "You have not saved any sessions yet"
              : `You have ${saved} saved session${saved === 1 ? "" : "s"}`}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {saved > 0 && (
              <GlowButton href="/my-agenda" shape="pill" size="md">
                View my agenda →
              </GlowButton>
            )}
            <GlowButton href="/agenda" shape="pill" size="md">
              {saved === 0 ? "Build my agenda →" : "Browse the agenda →"}
            </GlowButton>
          </div>
        </div>
      )}

      {!ticket?.booking_id && !ticket?.ticket_url && !ticket?.invoice_url ? (
        <div className="mt-8 sm:mt-10">
          <p className="text-lg font-medium">Already booked your DevFest ticket but can&apos;t see it here?</p>
          <p className="mt-1 max-w-md text-sm text-paper/60">Enter your booking ID from KonfHub.</p>
          <div className="mt-3">
            <ClaimTicketForm />
          </div>
        </div>
      ) : (
        <div className="mt-8 sm:mt-10">
          <p className="text-lg font-medium">Your DevFest ticket</p>
          <p className="mt-1 max-w-md text-sm text-paper/60">
            Only the main event ticket is shown here. For roadshows and meetups, please refer to the
            respective event pages.
          </p>
          {ticket.booking_id && (
            <div className="mt-3">
              <p className="font-mono text-xs uppercase tracking-wide text-paper/50">Booking ID</p>
              <div className="mt-2">
                <CopyField value={ticket.booking_id} />
              </div>
            </div>
          )}
          {(ticket.ticket_url || ticket.invoice_url) && (
            <div className="mt-4 flex flex-wrap gap-3">
              {ticket.ticket_url && (
                <GlowButton href={ticket.ticket_url} target="_blank" rel="noreferrer" shape="pill" size="md">
                  View ticket →
                </GlowButton>
              )}
              {ticket.invoice_url && (
                <GlowButton href={ticket.invoice_url} target="_blank" rel="noreferrer" shape="pill" size="md">
                  Invoice →
                </GlowButton>
              )}
            </div>
          )}
          <EditTicket />
        </div>
      )}

      <div className="mt-8 sm:mt-10">
        <SignOutButton />
      </div>
    </>
  );
}
