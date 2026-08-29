"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { claimTicketForUser } from "@/lib/tickets";

export type ClaimTicketState = { error?: string; ok?: boolean };

/**
 * Link the signed-in account to a ticket booked under a different email, by
 * matching `bookingId` + `purchaseEmail` against a `tickets` row. Never
 * touches `tickets` — writes a `ticket_claims` row (see lib/tickets.ts).
 */
export async function claimTicket(
  _prev: ClaimTicketState,
  formData: FormData,
): Promise<ClaimTicketState> {
  const session = await auth();
  if (!session?.user?.uid || !session.user.email) {
    return { error: "You need to be signed in." };
  }

  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const purchaseEmail = String(formData.get("purchaseEmail") ?? "").trim().toLowerCase();
  if (!bookingId || !purchaseEmail) {
    return { error: "Enter both your booking ID and the email you used on KonfHub." };
  }

  const result = await claimTicketForUser({
    userId: session.user.uid,
    loginEmail: session.user.email,
    bookingId,
    purchaseEmail,
  });

  switch (result) {
    case "not-found":
      return {
        error:
          "We couldn't match that booking ID and email. If you just bought your ticket, try again in a few minutes.",
      };
    case "taken":
      return { error: "That ticket is already linked to another account." };
    case "linked":
    case "unlinked":
      revalidatePath("/profile");
      return { ok: true };
  }
}
