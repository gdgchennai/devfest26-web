import "server-only";
import { getDb } from "@/lib/db";

/**
 * A row in the `tickets` table (migrations 0004 + 0005), keyed by buyer email.
 * Written by the standalone ticketing Worker (workers/ticketing) from provider
 * webhooks and the on-site check-in flow; the app only reads it.
 */
export type TicketRecord = {
  email: string;
  booking_id: string | null;
  payment_id: string | null;
  ticket_url: string | null;
  /** Main ticket name, e.g. "Professional". */
  ticket_name: string | null;
  /** JSON array of `{ booking_id, ticket_name, attachment_link }` add-ons, or null. */
  addons: string | null;
  checked_in: number;
  check_in_time: number | null;
  created_at: number;
  updated_at: number;
};

async function getTicketByEmail(email: string): Promise<TicketRecord | null> {
  const db = await getDb();
  return db.prepare("SELECT * FROM tickets WHERE email = ?").bind(email).first<TicketRecord>();
}

/**
 * The ticket to show a signed-in account:
 *   1. an explicit `ticket_claims` link (booked under a different email) wins,
 *   2. else a direct match on the account's own email,
 *   3. else none.
 */
export async function getTicketForUser(user: {
  id: string;
  email: string | null;
}): Promise<TicketRecord | null> {
  const db = await getDb();

  const claim = await db
    .prepare("SELECT ticket_email FROM ticket_claims WHERE user_id = ?")
    .bind(user.id)
    .first<{ ticket_email: string }>();
  if (claim) {
    const linked = await getTicketByEmail(claim.ticket_email);
    if (linked) return linked;
  }

  return user.email ? getTicketByEmail(user.email) : null;
}

export type ClaimResult = "linked" | "unlinked" | "not-found" | "taken";

/**
 * Link the signed-in account to the ticket identified by `bookingId` +
 * `purchaseEmail` (both must match the same `tickets` row). Never mutates
 * `tickets`.
 *
 *  - "linked"   — a `ticket_claims` row was written/updated
 *  - "unlinked" — the ticket's email IS the login email, so any existing claim
 *                 was removed and the direct match takes over
 *  - "not-found" — no `tickets` row matches both values
 *  - "taken"    — that ticket is already claimed by another account
 */
export async function claimTicketForUser(args: {
  userId: string;
  loginEmail: string;
  bookingId: string;
  purchaseEmail: string;
}): Promise<ClaimResult> {
  const db = await getDb();

  const row = await db
    .prepare("SELECT email FROM tickets WHERE booking_id = ? AND email = ?")
    .bind(args.bookingId, args.purchaseEmail)
    .first<{ email: string }>();
  if (!row) return "not-found";

  if (row.email.toLowerCase() === args.loginEmail.toLowerCase()) {
    await db.prepare("DELETE FROM ticket_claims WHERE user_id = ?").bind(args.userId).run();
    return "unlinked";
  }

  const taken = await db
    .prepare("SELECT user_id FROM ticket_claims WHERE ticket_email = ?")
    .bind(row.email)
    .first<{ user_id: string }>();
  if (taken && taken.user_id !== args.userId) return "taken";

  try {
    await db
      .prepare(
        `INSERT INTO ticket_claims (user_id, ticket_email, booking_id, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE
           SET ticket_email = excluded.ticket_email,
               booking_id = excluded.booking_id,
               created_at = excluded.created_at`,
      )
      .bind(args.userId, row.email, args.bookingId, Date.now())
      .run();
  } catch {
    // UNIQUE(ticket_email) — lost a race to another account.
    return "taken";
  }
  return "linked";
}
