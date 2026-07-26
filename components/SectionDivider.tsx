import { DOT, type DotColor } from "@/components/Eyebrow";

/**
 * The rule between homepage sections: the section's colour dot, its index, and
 * a hairline that draws itself rightward as the section enters the viewport.
 *
 * Deliberately has no JavaScript. The draw is a CSS scroll-driven animation
 * (`animation-timeline: view()`), so there is no observer to hydrate, nothing
 * to flash before the first frame, and browsers without support simply get the
 * finished rule — see the @supports block in globals.css. That also means it
 * cannot read the lite-mode flag, which is in localStorage; acceptable here,
 * because prefers-reduced-motion is honoured in CSS and a 1px scaleX is
 * compositor-only work either way.
 */
export function SectionDivider({
  index,
  dotColor,
}: {
  /** Omit outside the numbered homepage run — a "01" on the 404 means nothing. */
  index?: number;
  dotColor: DotColor;
}) {
  return (
    <div className="section-divider" aria-hidden>
      <span className={`section-divider__dot ${DOT[dotColor]}`} />
      {index !== undefined && (
        <span className="section-divider__index">{String(index).padStart(2, "0")}</span>
      )}
      <span className="section-divider__rule" />
    </div>
  );
}
