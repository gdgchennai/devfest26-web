import "server-only";
import { getDb } from "@/lib/db";

/**
 * A row in the `tickets` table (migration 0004), keyed by buyer email. Written
 * by the standalone ticketing Worker (workers/ticketing) from provider
 * webhooks and the on-site check-in flow; the app only reads it.
 */
export type TicketRecord = {
  email: string;
  booking_id: string | null;
  payment_id: string | null;
  ticket_url: string | null;
  invoice_url: string | null;
  /** Main ticket name, e.g. "Professional". */
  ticket_name: string | null;
  /** JSON array of `{ booking_id, ticket_name }` add-ons, or null. */
  addons: string | null;
  checked_in: number;
  check_in_time: number | null;
  created_at: number;
  updated_at: number;
};

/** The ticket for a signed-in account, matched on the account's email
 *  (case-insensitive — the column is COLLATE NOCASE). */
export async function getTicketByEmail(email: string): Promise<TicketRecord | null> {
  const db = await getDb();
  return db.prepare("SELECT * FROM tickets WHERE email = ?").bind(email).first<TicketRecord>();
}
