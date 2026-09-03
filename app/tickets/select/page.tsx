import type { Metadata } from "next";
import { BracketsField } from "@/components/motion/BracketsField";
import { TicketSelector } from "@/components/TicketSelector";

export const metadata: Metadata = { title: "Get Tickets" };
export const dynamic = "force-static";

export default function TicketSelectPage() {
  return (
    <>
      <BracketsField mode="settled" />
      {/* z-10 lifts this above BracketsField's fixed 3D backdrop (z-0), but
          that also makes it a stacking context capped at z-10 — below the
          fixed header's z-50. The Buy-ticket tear/flip needs to rise above
          the header too, so `ticket-select-lift` gives
          useTicketTearTransition a stable selector to bump this specific
          ancestor's z-index at click time (see TicketSelector.tsx). */}
      <div className="ticket-select-lift relative z-10">
        <TicketSelector />
      </div>
    </>
  );
}
