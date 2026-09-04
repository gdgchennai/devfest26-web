"use client";

import { useState } from "react";
import { GlowButton } from "@/components/GlowButton";
import type { TicketAddon } from "@/lib/tickets";

/**
 * Add-on tickets (T-shirt, parking, …) for the main ticket on /profile.
 * Renders nothing unless the account has at least one add-on.
 *
 * A `<select>` labelled "View add-on tickets" lists them by name; picking one
 * reveals a "View add-on ticket →" GlowButton that opens that add-on's PDF.
 * An add-on with no stored attachment link stays selectable but shows a short
 * "not available yet" note instead of a button.
 */
export function AddonTickets({ addons }: { addons: TicketAddon[] }) {
  const [selectedId, setSelectedId] = useState("");

  if (addons.length === 0) return null;

  const selected = addons.find((a) => a.booking_id === selectedId) ?? null;
  const label = (a: TicketAddon) => a.ticket_name ?? `Add-on ${a.booking_id.slice(0, 8)}`;

  return (
    <div className="mt-4">
      <p className="font-mono text-xs uppercase tracking-wide text-paper/50">Add-on tickets</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <select
          aria-label="View add-on tickets"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-md border border-paper/10 bg-paper/5 px-2.5 py-2 text-sm text-paper/80 transition-colors hover:bg-paper/10 focus:outline-none focus:ring-1 focus:ring-paper/30 [&>option]:bg-neutral-900 [&>option]:text-paper"
        >
          <option value="">View add-on tickets…</option>
          {addons.map((a) => (
            <option key={a.booking_id} value={a.booking_id}>
              {label(a)}
            </option>
          ))}
        </select>

        {selected &&
          (selected.attachment_link ? (
            <GlowButton
              href={selected.attachment_link}
              target="_blank"
              rel="noreferrer"
              shape="pill"
              size="md"
            >
              View add-on ticket →
            </GlowButton>
          ) : (
            <p className="text-sm text-paper/50">Ticket not available yet</p>
          ))}
      </div>
    </div>
  );
}
