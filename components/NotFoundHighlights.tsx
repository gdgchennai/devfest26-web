import Link from "next/link";
import { Card } from "@/components/Card";
import { ticketCta, speakerCta } from "@/lib/cta";
import { uiCopy } from "@/site.config";
import { AGENDA_READY } from "@/lib/routes";

/**
 * The three things someone actually came to this site for: when it is, how to
 * get in, and how to get on stage.
 *
 * The 404's full route index answers "what exists" but not "where should I
 * go", and a flat list of nine links is a lot to read when you are annoyed.
 * These sit above it and carry the weight.
 *
 * Ticketing goes through `ticketCta()` for the same reason it does in the
 * header: every "Get Tickets" CTA site-wide reads from the one place, so
 * it can't drift out of sync with where tickets are actually sold.
 */
type Highlight = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
};

export function NotFoundHighlights() {
  const tickets = ticketCta();
  const speaking = speakerCta();

  const { highlights: copy } = uiCopy.notFoundPage;
  const highlights: Highlight[] = [
    ...(AGENDA_READY
      ? [
          {
            eyebrow: copy.agendaEyebrow,
            title: copy.agendaTitle,
            description: copy.agendaDescription,
            href: "/agenda",
          },
        ]
      : []),
    {
      eyebrow: copy.ticketsEyebrow,
      title: tickets.label,
      description: copy.ticketsDescription,
      href: tickets.href,
      external: tickets.external,
    },
    {
      eyebrow: copy.speakingEyebrow,
      title: copy.speakingTitle,
      description: copy.speakingDescription,
      href: speaking.href,
      external: speaking.external,
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
        <span aria-hidden> →</span>
      </span>
      <span className="mt-1 block text-sm text-paper/70">{item.description}</span>
    </>
  );

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
