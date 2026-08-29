/**
 * Parsing for KonfHub attendee webhooks. We keep almost nothing from the
 * payload — see `ParsedEvent`. Fields we don't need (T-shirt size, UTM, tax
 * breakup, buyer details, …) are ignored.
 *
 * The `Data` wrapper key differs by event type:
 *   registration / cancel -> "Attendee Details"
 *   check_in              -> "Check In Updates"
 *   check_out             -> "Check Out Updates"
 */

export type EventType = "registration" | "cancel" | "check_in" | "check_out";

export interface Addon {
  booking_id: string;
  ticket_name: string | null;
}

export interface ParsedEvent {
  eventType: EventType;
  /** KonfHub's webhook id (top-level "Id"), for log correlation. */
  eventId: string | null;
  eventAt: number | null;
  /** Attendee email, lowercased — the key we match a user account on. */
  email: string;
  bookingId: string | null;
  ticketName: string | null;
  addons: Addon[];
  ticketUrl: string | null;
  invoiceUrl: string | null;
  paymentId: string | null;
  /** unix ms from "CheckIn Time" (UTC). null unless check_in / present on check_out. */
  checkInTime: number | null;
}

export type ParseResult =
  | { ok: true; event: ParsedEvent }
  | { ok: false; status: number; message: string };

// The attendee-email question has a very long custom label. Match by prefix so
// a wording tweak on KonfHub doesn't break us — and never pick up "Buyer Email".
const EMAIL_KEY_PREFIX = "Email Address(";
const DETAIL_KEYS = ["Attendee Details", "Check In Updates", "Check Out Updates"];

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function detailsOf(data: Record<string, unknown>): Record<string, unknown> | null {
  for (const key of DETAIL_KEYS) {
    const rec = asRecord(data[key]);
    if (rec) return rec;
  }
  for (const value of Object.values(data)) {
    const rec = asRecord(value);
    if (rec) return rec;
  }
  return null;
}

function attendeeEmail(d: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(d)) {
    if (key.startsWith(EMAIL_KEY_PREFIX)) {
      const email = str(value);
      if (email) return email.toLowerCase();
    }
  }
  return null;
}

function ticketNameOf(d: Record<string, unknown>): string | null {
  const td = asRecord(d["Ticket Details"]);
  return td ? str(td["Ticket Name"]) : null;
}

function parseAddons(d: Record<string, unknown>): Addon[] {
  const list = d["Addon Details"];
  if (!Array.isArray(list)) return [];
  const out: Addon[] = [];
  for (const entry of list) {
    const rec = asRecord(entry);
    if (!rec) continue;
    const bookingId = str(rec["Booking Id"]);
    if (!bookingId) continue;
    const td = asRecord(rec["Ticket Details"]);
    out.push({ booking_id: bookingId, ticket_name: td ? str(td["Ticket Name"]) : null });
  }
  return out;
}

/** "2026-08-29 07:53:22" → unix ms. The string carries no zone and lines up
 *  with the event's "Event At" when read as UTC. */
function parseCheckInTime(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const ms = Date.parse(`${v.trim().replace(" ", "T")}Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function parseWebhook(body: unknown): ParseResult {
  const wh = asRecord(body);
  if (!wh) return { ok: false, status: 400, message: "body is not a JSON object" };

  const eventType = wh["Event Type"];
  if (
    eventType !== "registration" &&
    eventType !== "cancel" &&
    eventType !== "check_in" &&
    eventType !== "check_out"
  ) {
    // A type we don't handle (or a new one KonfHub added) — accept and drop.
    return { ok: false, status: 200, message: `unhandled Event Type: ${String(eventType)}` };
  }

  const data = asRecord(wh["Data"]);
  if (!data) return { ok: false, status: 400, message: "missing Data" };

  const d = detailsOf(data);
  if (!d) return { ok: false, status: 400, message: "missing attendee details" };

  const email = attendeeEmail(d);
  if (!email) return { ok: false, status: 400, message: "missing attendee email" };

  return {
    ok: true,
    event: {
      eventType,
      eventId: str(wh["Id"]),
      eventAt: typeof wh["Event At"] === "number" ? (wh["Event At"] as number) : null,
      email,
      bookingId: str(d["Booking Id"]),
      ticketName: ticketNameOf(d),
      addons: parseAddons(d),
      ticketUrl: str(d["Ticket URL"]),
      invoiceUrl: str(d["Invoice URL"]),
      paymentId: str(d["payment_id"]),
      checkInTime: parseCheckInTime(d["CheckIn Time"]),
    },
  };
}
