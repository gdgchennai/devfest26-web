import { forwardRef } from "react";
import type { FallbackColor } from "@/lib/fallback-color";

const DOT_COLOR_VAR: Record<FallbackColor, string> = {
  blue: "var(--blue)",
  red: "var(--red)",
  yellow: "var(--yellow)",
  green: "var(--green)",
};

type LoaderProps = {
  progress: number;
  dotColor: FallbackColor;
};

/**
 * The counter only. This renders inside the curtain, which is aria-hidden — so
 * nothing here reaches assistive tech and nothing focusable may live here. The
 * loading announcement and the way out are in <IntroEscape>, which is portalled
 * to document.body precisely so it sits outside this subtree.
 */
export const Loader = forwardRef<HTMLDivElement, LoaderProps>(function Loader(
  { progress, dotColor },
  maskRef,
) {
  return (
    <div className="pointer-events-none flex h-full flex-col justify-end p-6 sm:p-10">
      <div ref={maskRef} className="overflow-hidden">
        <div className="flex items-baseline gap-[1ch]" aria-hidden="true">
          <span
            className="inline-block h-[10px] w-[10px] rounded-full"
            style={{ background: DOT_COLOR_VAR[dotColor] }}
          />
          <span
            className="font-mono tabular-nums text-paper"
            style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
          >
            {Math.floor(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
});
