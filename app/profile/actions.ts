"use server";

import { auth } from "@/auth";

export type ClaimTicketState = { error?: string; ok?: boolean };

/**
 * Link a KonfHub booking to the signed-in account by its booking ID — the
 * fallback for when the buyer used a different email than their Google login,
 * so the ticketing webhook wrote a `tickets` row under an email we can't
 * match.
 *
 * STUB — no backend yet. When implemented: verify `bookingId` against KonfHub,
 * then upsert a `tickets` row for `session.user.email` (or re-key the existing
 * row). Consider routing this through the ticketing Worker instead so all
 * writes to `tickets` go through one place.
 */
export async function claimTicket(
  _prev: ClaimTicketState,
  formData: FormData,
): Promise<ClaimTicketState> {
  const session = await auth();
  if (!session?.user?.uid) return { error: "Not signed in." };

  const bookingId = String(formData.get("bookingId") ?? "").trim();
  if (!bookingId) return { error: "Enter your booking ID." };

  return {};
}
