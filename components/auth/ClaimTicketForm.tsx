"use client";

import { useActionState } from "react";
import { claimTicket, type ClaimTicketState } from "@/app/profile/actions";

export function ClaimTicketForm() {
  const [state, action, pending] = useActionState<ClaimTicketState, FormData>(claimTicket, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="bookingId" className="sr-only">
        KonfHub booking ID
      </label>
      <input
        id="bookingId"
        name="bookingId"
        type="text"
        required
        maxLength={64}
        placeholder="KonfHub booking ID"
        className="w-full rounded-full border border-paper/15 bg-transparent px-4 py-2 text-sm text-paper placeholder:text-paper/40 focus:border-paper/40 focus:outline-none sm:w-72"
      />
      <label htmlFor="purchaseEmail" className="sr-only">
        Email used on KonfHub
      </label>
      <input
        id="purchaseEmail"
        name="purchaseEmail"
        type="email"
        required
        maxLength={254}
        placeholder="Email used on KonfHub"
        className="w-full rounded-full border border-paper/15 bg-transparent px-4 py-2 text-sm text-paper placeholder:text-paper/40 focus:border-paper/40 focus:outline-none sm:w-72"
      />
      <div className="mt-1 flex items-center gap-3">
        {/* Glow-btn shell around a real submit button (GlowButton itself only
            renders type="button"). */}
        <span className="glow-btn rounded-full" data-shape="pill">
          <span className="glow-btn__corners" aria-hidden="true" />
          <button
            type="submit"
            disabled={pending}
            className="glow-btn__surface inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-medium text-paper disabled:opacity-50"
          >
            {pending ? "Checking…" : "Find my ticket"}
          </button>
        </span>
        {state.error && <span className="text-sm text-paper/60">{state.error}</span>}
        {state.ok && <span className="text-sm text-green-400">Linked to your account.</span>}
      </div>
    </form>
  );
}
