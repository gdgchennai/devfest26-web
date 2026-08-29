/**
 * All reads/writes to the `tickets` table (migrations 0004 + 0005). The app
 * only ever SELECTs from this table — every mutation goes through here.
 */

import type { Addon, ParsedEvent } from "./konfhub";
import { ADDON_TICKET_NAMES, isKnownTicketName } from "./constants";

interface TicketRow {
  email: string;
  booking_id: string | null;
  payment_id: string | null;
  ticket_url: string | null;
  invoice_url: string | null;
  ticket_name: string | null;
  addons: string | null;
  checked_in: number;
  check_in_time: number | null;
  created_at: number;
  updated_at: number;
}

function getByEmail(db: D1Database, email: string): Promise<TicketRow | null> {
  return db.prepare("SELECT * FROM tickets WHERE email = ?").bind(email).first<TicketRow>();
}

function decodeAddons(json: string | null): Addon[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Addon[]) : [];
  } catch {
    return [];
  }
}

function encodeAddons(addons: Addon[]): string | null {
  return addons.length > 0 ? JSON.stringify(addons) : null;
}

function warnUnknownNames(e: ParsedEvent): void {
  if (e.ticketName && !isKnownTicketName(e.ticketName)) {
    console.warn(`unrecognised ticket name "${e.ticketName}" (${e.email})`);
  }
  for (const a of e.addons) {
    if (a.ticket_name && !ADDON_TICKET_NAMES.has(a.ticket_name)) {
      console.warn(`unrecognised add-on name "${a.ticket_name}" (${e.email})`);
    }
  }
}

/**
 * registration — write the full ticket picture for this attendee, preserving
 * any existing check-in state. KonfHub doesn't allow a second live ticket per
 * attendee, so if we somehow see a different booking already stored we leave
 * it alone rather than clobber a (possibly hand-fixed) mapping.
 */
export async function applyRegistration(db: D1Database, e: ParsedEvent): Promise<string> {
  warnUnknownNames(e);
  const now = Date.now();
  const existing = await getByEmail(db, e.email);

  if (existing?.booking_id && e.bookingId && existing.booking_id !== e.bookingId) {
    return `ignored — ${e.email} already holds booking ${existing.booking_id}`;
  }

  const addons = encodeAddons(e.addons);

  if (existing) {
    await db
      .prepare(
        `UPDATE tickets
            SET booking_id = ?, payment_id = ?, ticket_url = ?, invoice_url = ?,
                ticket_name = ?, addons = ?, updated_at = ?
          WHERE email = ?`,
      )
      .bind(e.bookingId, e.paymentId, e.ticketUrl, e.invoiceUrl, e.ticketName, addons, now, e.email)
      .run();
    return `updated ${e.email}`;
  }

  await db
    .prepare(
      `INSERT INTO tickets
         (email, booking_id, payment_id, ticket_url, invoice_url, ticket_name,
          addons, checked_in, check_in_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    )
    .bind(e.email, e.bookingId, e.paymentId, e.ticketUrl, e.invoiceUrl, e.ticketName, addons, now, now)
    .run();
  return `created ${e.email}`;
}

/**
 * cancel — decision tree (spec):
 *   1. booking id == the stored main booking  → drop the whole row
 *      (add-ons and check-in go with it)
 *   2. else, ticket name == the stored ticket name → no-op: the row was
 *      mapped by hand, a mismatched-id cancel shouldn't touch it
 *   3. else, booking id is one of the stored add-ons → remove that add-on only
 *   4. else → no-op
 */
export async function applyCancel(db: D1Database, e: ParsedEvent): Promise<string> {
  const row = await getByEmail(db, e.email);
  if (!row) return `no ticket for ${e.email}`;

  if (e.bookingId && row.booking_id === e.bookingId) {
    await db.prepare("DELETE FROM tickets WHERE email = ?").bind(e.email).run();
    return `deleted ${e.email} — main booking ${e.bookingId} cancelled`;
  }

  if (e.ticketName && row.ticket_name && e.ticketName === row.ticket_name) {
    return `no-op ${e.email} — booking id mismatch, ticket name matches (manual mapping)`;
  }

  const addons = decodeAddons(row.addons);
  const idx = e.bookingId ? addons.findIndex((a) => a.booking_id === e.bookingId) : -1;
  if (idx !== -1) {
    const [removed] = addons.splice(idx, 1);
    await db
      .prepare("UPDATE tickets SET addons = ?, updated_at = ? WHERE email = ?")
      .bind(encodeAddons(addons), Date.now(), e.email)
      .run();
    return `removed add-on ${removed.booking_id} (${removed.ticket_name ?? "?"}) for ${e.email}`;
  }

  return `no-op ${e.email} — cancel ${e.bookingId ?? "?"} matched nothing`;
}

/** check_in — set the flag + time, creating a bare row if the attendee was
 *  scanned in without us ever seeing their registration. */
export async function applyCheckIn(db: D1Database, e: ParsedEvent): Promise<string> {
  const at = e.checkInTime ?? e.eventAt ?? Date.now();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO tickets (email, checked_in, check_in_time, created_at, updated_at)
       VALUES (?, 1, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE
         SET checked_in = 1, check_in_time = excluded.check_in_time, updated_at = excluded.updated_at`,
    )
    .bind(e.email, at, now, now)
    .run();
  return `checked in ${e.email} at ${new Date(at).toISOString()}`;
}

/** check_out — clear the flag + time. No-op if there's no row. */
export async function applyCheckOut(db: D1Database, e: ParsedEvent): Promise<string> {
  const res = await db
    .prepare("UPDATE tickets SET checked_in = 0, check_in_time = NULL, updated_at = ? WHERE email = ?")
    .bind(Date.now(), e.email)
    .run();
  return (res.meta.changes ?? 0) > 0 ? `checked out ${e.email}` : `no ticket for ${e.email}`;
}
