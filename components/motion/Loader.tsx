import { forwardRef } from "react";
import { siteConfig } from "@/site.config";
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
  showEscapeHatch: boolean;
};

export const Loader = forwardRef<HTMLDivElement, LoaderProps>(function Loader(
  { progress, dotColor, showEscapeHatch },
  maskRef,
) {
  return (
    <div className="pointer-events-auto flex h-full flex-col justify-end p-6 sm:p-10">
      <span className="sr-only" role="status">
        Loading
      </span>

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

      {showEscapeHatch && (
        <div className="mt-6 flex gap-4 font-mono text-[0.8rem] text-paper/70">
          <a href="/agenda" className="hover:text-paper">
            Agenda
          </a>
          <span>·</span>
          <a href={siteConfig.ticketing.url ?? "/agenda"} className="hover:text-paper">
            Tickets
          </a>
          <span>·</span>
          <a href="#main" className="hover:text-paper">
            Skip
          </a>
        </div>
      )}
    </div>
  );
});
