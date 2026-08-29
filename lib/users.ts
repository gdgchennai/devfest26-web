import "server-only";
import { getDb } from "@/lib/db";
import { newUserId } from "@/lib/id";

export type UserRecord = {
  id: string;
  google_sub: string;
  email: string | null;
  name: string | null;
  image: string | null;
  display_name: string | null;
  created_at: number;
  // Ticket / payment details — written by the ticketing webhook, not here.
  booking_id: string | null;
  payment_id: string | null;
  ticket_url: string | null;
  invoice_url: string | null;
};

export type TicketFields = Pick<
  UserRecord,
  "booking_id" | "payment_id" | "ticket_url" | "invoice_url"
>;

/**
 * Find the account for a Google `sub`, creating one on first sign-in. Returns
 * the row so the caller can stamp our own `id` onto the session token.
 */
export async function upsertUserByGoogle(profile: {
  sub: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}): Promise<UserRecord> {
  const db = await getDb();

  const existing = await db
    .prepare("SELECT * FROM users WHERE google_sub = ?")
    .bind(profile.sub)
    .first<UserRecord>();

  if (existing) {
    // Keep the Google-sourced fields fresh, but never touch display_name.
    await db
      .prepare("UPDATE users SET email = ?, name = ?, image = ? WHERE id = ?")
      .bind(profile.email ?? null, profile.name ?? null, profile.image ?? null, existing.id)
      .run();
    return {
      ...existing,
      email: profile.email ?? null,
      name: profile.name ?? null,
      image: profile.image ?? null,
    };
  }

  const row: UserRecord = {
    id: newUserId(),
    google_sub: profile.sub,
    email: profile.email ?? null,
    name: profile.name ?? null,
    image: profile.image ?? null,
    display_name: null,
    created_at: Date.now(),
    booking_id: null,
    payment_id: null,
    ticket_url: null,
    invoice_url: null,
  };

  await db
    .prepare(
      "INSERT INTO users (id, google_sub, email, name, image, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(row.id, row.google_sub, row.email, row.name, row.image, row.display_name, row.created_at)
    .run();

  return row;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const db = await getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRecord>();
}

/**
 * Set the ticket / payment details for an account. Intended for the ticketing
 * webhook. Matches by our own `id` or by `email` (the webhook knows the
 * buyer's email, not our id) — email match only fills a row that has no
 * booking yet, so a re-delivered webhook can't clobber a different purchase.
 * Returns true if a row was updated.
 */
export async function setTicketFields(
  match: { userId: string } | { email: string },
  fields: Partial<TicketFields>,
): Promise<boolean> {
  const db = await getDb();
  const cols = ["booking_id", "payment_id", "ticket_url", "invoice_url"] as const;
  const set = cols
    .filter((c) => fields[c] !== undefined)
    .map((c) => `${c} = ?`);
  if (set.length === 0) return false;
  const values = cols.filter((c) => fields[c] !== undefined).map((c) => fields[c] ?? null);

  const where =
    "userId" in match
      ? { clause: "id = ?", arg: match.userId }
      : { clause: "email = ? AND booking_id IS NULL", arg: match.email };

  const result = await db
    .prepare(`UPDATE users SET ${set.join(", ")} WHERE ${where.clause}`)
    .bind(...values, where.arg)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
