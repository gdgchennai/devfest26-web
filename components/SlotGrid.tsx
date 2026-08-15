import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A grid of fixed slots that are mostly empty on purpose.
 *
 * The speaker lineup is a list whose content has not landed yet, and it was
 * rendering a single apologetic EmptyState. A roster with visible unfilled
 * slots reads as an open call instead: you can see how many places there are,
 * how many are taken, and one of the gaps is a live invitation to take one.
 *
 * Generic rather than folded into SpeakerWall because it was written for the
 * sponsor wall as well; 2026 then dropped sponsorship, so there is one
 * consumer today. Kept general — this is the shape any "roster with open
 * places" needs, and the sponsor tiers may come back.
 *
 * The three slot states share one footprint so the grid never reflows as
 * content arrives — the caller passes a single `slotClassName` that sizes all
 * of them.
 */

export type FilledSlot = {
  key: string;
  content: ReactNode;
  /** Makes the slot a link. External URLs open in a new tab. */
  href?: string | null;
  external?: boolean;
};

export type InviteSlot = {
  href: string;
  external?: boolean;
  label: string;
  /** Appended to the label for screen readers, e.g. the tier being offered. */
  srLabel?: string;
  /** Optional mark above the label — a silhouette, an icon. */
  ornament?: ReactNode;
};

export function SlotGrid({
  cols,
  slotClassName,
  slots,
  filled,
  invite,
}: {
  /** Tailwind grid-template-columns utilities. */
  cols: string;
  /** Applied to every slot, filled or not. Sizes the row. */
  slotClassName: string;
  /** Total places in this row, including the ones already taken. */
  slots: number;
  filled: FilledSlot[];
  invite: InviteSlot;
}) {
  // One invite always shows while there is room; the rest of the gap is quiet.
  const remaining = Math.max(0, slots - filled.length);
  const ghosts = Math.max(0, remaining - 1);

  return (
    <ul className={`grid gap-3 ${cols}`}>
      {filled.map((slot) => (
        <li key={slot.key}>
          <Filled slot={slot} slotClassName={slotClassName} />
        </li>
      ))}

      {remaining > 0 && (
        <li>
          <Invite invite={invite} slotClassName={slotClassName} />
        </li>
      )}

      {Array.from({ length: ghosts }, (_, i) => (
        <li key={`ghost-${i}`}>
          <div
            aria-hidden
            className={`rounded-lg border border-dashed border-paper/10 bg-surface ${slotClassName}`}
          />
        </li>
      ))}
    </ul>
  );
}

/*
 * No centring or padding here on purpose: a speaker card stacks a portrait
 * over two lines of text, where a logo plinth would centre a single mark. The
 * shell owns the footprint and the border; the caller owns the arrangement
 * inside it.
 */
const FILLED_BASE =
  "relative block overflow-hidden rounded-lg border border-paper/10 bg-surface transition-colors";

function Filled({ slot, slotClassName }: { slot: FilledSlot; slotClassName: string }) {
  const classes = `${FILLED_BASE} ${slotClassName}`;
  if (!slot.href) return <div className={classes}>{slot.content}</div>;

  const interactive = `${classes} hover:border-paper/25`;
  if (slot.external) {
    return (
      <a href={slot.href} target="_blank" rel="noreferrer" className={interactive}>
        {slot.content}
      </a>
    );
  }
  return (
    <Link href={slot.href} className={interactive}>
      {slot.content}
    </Link>
  );
}

function Invite({ invite, slotClassName }: { invite: InviteSlot; slotClassName: string }) {
  const classes = `group flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-blue/40 px-2 text-center transition-colors hover:border-blue hover:bg-blue/10 ${slotClassName}`;

  const inner = (
    <>
      {invite.ornament}
      <span className="font-mono text-xs uppercase tracking-wide text-blue">
        {invite.label} <span aria-hidden>→</span>
        {invite.srLabel && <span className="sr-only"> — {invite.srLabel}</span>}
      </span>
    </>
  );

  if (invite.external) {
    return (
      <a href={invite.href} target="_blank" rel="noreferrer" className={classes}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={invite.href} className={classes}>
      {inner}
    </Link>
  );
}
