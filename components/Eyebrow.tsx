import type { ReactNode, Ref } from "react";

/**
 * The small coloured dot + mono label that sits above a heading. Written out by
 * hand in five places before this, at two dot sizes and two text opacities;
 * standardised here on the larger dot and the higher-contrast label.
 */
export type DotColor = "blue" | "red" | "yellow" | "green";

const DOT: Record<DotColor, string> = {
  blue: "bg-blue",
  red: "bg-red",
  yellow: "bg-yellow",
  green: "bg-green",
};

export function Eyebrow({
  children,
  dotColor = "blue",
  className = "",
  ref,
}: {
  children: ReactNode;
  dotColor?: DotColor;
  className?: string;
  /** The hero animates its eyebrow, so the row has to be reachable. */
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className={`flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-paper/70 ${className}`.trim()}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[dotColor]}`} />
      {children}
    </div>
  );
}
