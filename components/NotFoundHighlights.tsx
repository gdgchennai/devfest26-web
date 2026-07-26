import Link from "next/link";
import { Card } from "@/components/Card";
import { ticketCta, speakerCta } from "@/lib/cta";

/**
 * The three things someone actually came to this site for: when it is, how to
 * get in, and how to get on stage.
 *
 * The 404's full route index answers "what exists" but not "where should I
 * go", and a flat list of nine links is a lot to read when you are annoyed.
 * These sit above it and carry the weight.
 *
 * Ticketing goes through `ticketCta()` for the same reason it does in the
 * header: while `siteConfig.ticketing.url` is null there is nowhere to buy, so
 * this renders as a dashed non-link that says so rather than a card that
 * pretends to be a destination.
 */
type Highlight = {
  eyebrow: string;
  title: string;
  description: string;
  href: string | null;
  external?: boolean;
  note?: string;
};

export function NotFoundHighlights() {
  const tickets = ticketCta();
  const speaking = speakerCta();

  const highlights: Highlight[] = [
    {
      eyebrow: "The day",
      title: "Agenda",
      description: "Four tracks, one day. The full schedule as it firms up.",
      href: "/agenda",
    },
    tickets.available
      ? {
          eyebrow: "Get in",
          title: tickets.label,
          description: "Book your place at DevFest Chennai 2026.",
          href: tickets.href,
          external: true,
        }
      : {
          eyebrow: "Get in",
          title: tickets.label,
          description: "No link to give you yet — it goes live here the moment there is one.",
          href: null,
          note: tickets.note,
        },
    {
      eyebrow: "Get on stage",
      title: "Speak at DevFest",
      description: "First-time speakers as welcome as conference regulars.",
      href: speaking.available ? speaking.href : "/cfp",
      external: speaking.available && speaking.external,
    },
  ];

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {highlights.map((item) => (
        <li key={item.title}>
          <HighlightCard item={item} />
        </li>
      ))}
    </ul>
  );
}

function HighlightCard({ item }: { item: Highlight }) {
  const body = (
    <>
      <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-paper/60">
        {item.eyebrow}
      </span>
      <span className="mt-2 block text-lg font-semibold">
        {item.title}
        {item.href && <span aria-hidden> →</span>}
      </span>
      <span className="mt-1 block text-sm text-paper/70">{item.description}</span>
      {item.note && (
        <span className="mt-2 block font-mono text-[0.6875rem] text-paper/60">{item.note}</span>
      )}
    </>
  );

  if (!item.href) {
    return (
      <div className="h-full rounded-lg border border-dashed border-paper/20 bg-paper/[0.015] p-5">
        {body}
      </div>
    );
  }

  const className = "block h-full";
  const card = (
    <Card className="h-full transition-colors hover:border-paper/25 hover:bg-paper/[0.06]">
      {body}
    </Card>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={className}>
        {card}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {card}
    </Link>
  );
}
