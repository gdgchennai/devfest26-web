"use server";

import { auth } from "@/auth";
// import { setTicketFields } from "@/lib/users";

export type ClaimTicketState = { error?: string; ok?: boolean };

/**
 * Link a KonfHub booking to the signed-in account by its booking ID.
 *
 * STUB — no backend yet. When the KonfHub lookup exists, verify `bookingId`
 * belongs to this user's email and call `setTicketFields({ userId }, { … })`.
 */
export async function claimTicket(
  _prev: ClaimTicketState,
  formData: FormData,
): Promise<ClaimTicketState> {
  const session = await auth();
  if (!session?.user?.uid) return { error: "Not signed in." };

  const bookingId = String(formData.get("bookingId") ?? "").trim();
  if (!bookingId) return { error: "Enter your booking ID." };

  // STUB: no lookup yet — do nothing. Replace with a KonfHub lookup +
  // setTicketFields({ userId: session.user.uid }, { … }).
  return {};
}
