"use client";

import { useState } from "react";
import { ClaimTicketForm } from "@/components/auth/ClaimTicketForm";

/** "Not seeing the right ticket? Edit" — reveals the booking-ID form for an
 *  account that already has a ticket linked. */
export function EditTicket() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <p className="mt-4 text-sm text-paper/60">
        Not seeing the right ticket?{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-paper underline underline-offset-2 hover:text-paper/80"
        >
          Edit
        </button>
      </p>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-paper/60">Enter your booking ID from KonfHub.</p>
      <div className="mt-2">
        <ClaimTicketForm />
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-sm text-paper/60 underline underline-offset-2 hover:text-paper"
      >
        Cancel
      </button>
    </div>
  );
}
