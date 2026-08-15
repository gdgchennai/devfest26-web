import type { ReactNode } from "react";

/**
 * The site's one card surface. The homepage previously carried two treatments
 * at the same visual weight — `border border-paper/10` on the "What you'll
 * get" and Tracks grids, `bg-paper/5` with no border on "Why join us" — which
 * read as two different kinds of thing when they are not. Standardised on
 * hairline + a very faint wash: the border is what separates a card from the
 * ink page, the wash alone was too weak to do it.
 */
export function Card({
  children,
  className = "",
  /** Optional accent hairline along the top edge, e.g. a track's colour. */
  accentClass,
}: {
  children: ReactNode;
  className?: string;
  accentClass?: string;
}) {
  return (
    <div
      // bg-surface, not bg-paper/[0.03]: the old wash was 97% transparent, so
      // BracketsField's 3D brackets travelled straight through the card and
      // across its text. --surface holds back 92% of it — enough that a bracket
      // still reads as moving behind the card, not enough to pull the text
      // under AA. The ratios are worked out at the token.
      className={`relative overflow-hidden rounded-lg border border-paper/10 bg-surface p-5 ${className}`.trim()}
    >
      {accentClass && (
        <span aria-hidden className={`absolute inset-x-0 top-0 h-px ${accentClass}`} />
      )}
      {children}
    </div>
  );
}
