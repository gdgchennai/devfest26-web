/**
 * The rule between sections: a hairline that draws itself rightward as the
 * section enters.
 *
 * It carried a coloured dot and a chapter number until both turned out to be
 * redundant. The dot repeated the one in the SectionHeading's eyebrow two rows
 * below it — same colour, same size, no new information. The number was worse
 * than redundant: the first homepage section sits directly under the hero and
 * has no divider, so the first index a reader ever saw was "02", and the only
 * way to fix that was to put a rule in the one place it doesn't belong.
 *
 * What's left is the part that was doing the work. Deliberately has no
 * JavaScript — the draw is a CSS scroll-driven animation
 * (`animation-timeline: view()`), so there is no observer to hydrate and
 * nothing to flash before the first frame. Browsers without support get the
 * finished rule, which is the correct fallback for something decorative.
 */
export function SectionDivider() {
  return <div className="section-divider" aria-hidden />;
}
