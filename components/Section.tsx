import type { ReactNode } from "react";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionDivider } from "@/components/SectionDivider";
import type { DotColor } from "@/components/Eyebrow";

/**
 * A homepage section: the shared container, the drawn divider above it, and
 * its heading.
 *
 * The container is the point. Every other route wraps its content in
 * `mx-auto max-w-2xl`, but the homepage had no max-width at all, so its
 * four-column grids and agenda rows ran the full width of the display. It is
 * wider than the prose routes (`max-w-6xl`) because it is the only page laying
 * out four cards across.
 */
export function Section({
  id,
  index,
  eyebrow,
  title,
  dotColor = "blue",
  children,
  /** The first section sits directly under the hero, which is its own boundary. */
  divider = true,
}: {
  id?: string;
  index: number;
  eyebrow: string;
  title: string;
  dotColor?: DotColor;
  children: ReactNode;
  divider?: boolean;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8">
      {divider && <SectionDivider index={index} dotColor={dotColor} />}
      <div className={divider ? "pt-10" : ""}>
        <SectionHeading eyebrow={eyebrow} title={title} dotColor={dotColor} />
        {children}
      </div>
    </section>
  );
}
