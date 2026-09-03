import type { Metadata } from "next";
import { BracketsField } from "@/components/motion/BracketsField";
import { TicketsList } from "@/components/TicketsList";

export const metadata: Metadata = { title: "Tickets" };
export const dynamic = "force-static";

export default function TicketsPage() {
  return (
    <>
      {/* Same 3D brand-shape backdrop the homepage uses — it's what the
          footer's 3D DevFest logo settle (see FooterLogo.tsx's `field3D`
          check) depends on, and it's page-agnostic (drives off scroll
          position + a generic #footer-logo lookup, nothing homepage-specific).
          mode="settled": this page has no long drift-then-land choreography
          to lead into, so the brackets stay pinned onto the footer logo the
          whole time instead of orbiting/drifting first. */}
      <BracketsField mode="settled" />
      <div className="relative z-10">
        <TicketsList />
      </div>
    </>
  );
}
