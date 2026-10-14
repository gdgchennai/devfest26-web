"use client";
import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "@/components/games/useDialog";
import { formatSessionTime } from "@/lib/format";
import type { AgendaSession } from "@/lib/schemas";
import { hallZones, sessionsForHall } from "@/lib/hall-model";

export function HallSchedule({
  hall,
  agenda,
  now,
  onClose,
  onSession,
  restoreId,
}: {
  hall: string;
  agenda: AgendaSession[];
  now: number;
  onClose: () => void;
  onSession: (s: AgendaSession) => void;
  restoreId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, true, onClose);
  useEffect(() => {
    if (restoreId)
      ref.current
        ?.querySelector<HTMLButtonElement>(
          `[data-session="${CSS.escape(restoreId)}"]`,
        )
        ?.focus();
  }, [restoreId]);
  const sessions = sessionsForHall(agenda, hall);
  return createPortal(
    <div
      className="fixed inset-0 z-999 flex items-center justify-center bg-ink/80 p-3"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hall-schedule-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-paper/20 bg-surface-raised p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="hall-schedule-title" className="text-xl font-semibold">
              {hall}
            </h2>
            <p className="mt-1 text-sm text-paper/60">
              All sessions · Times in IST
            </p>
          </div>
          <button
            className="min-h-11 min-w-11"
            aria-label="Close hall schedule"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <ol className="mt-5 divide-y divide-paper/10">
          {sessions.map((s) => {
            const current =
                Date.parse(s.start) <= now && now < Date.parse(s.end),
              past = Date.parse(s.end) <= now;
            return (
              <li key={s.id} className={past ? "text-paper/60" : ""}>
                <button
                  data-session={s.id}
                  onClick={() => onSession(s)}
                  className="w-full py-4 text-left hover:bg-paper/5 focus-visible:outline-2 focus-visible:outline-blue"
                >
                  <span className="text-xs text-paper/70">
                    {formatSessionTime(s.start)}–{formatSessionTime(s.end)} ·{" "}
                    {hallZones.find((z) => z.id === s.track)?.name ?? "General"}
                  </span>
                  <span className="mt-1 block font-medium">{s.title} ↗</span>
                  {current && <span className="text-sm text-blue">On now</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>,
    document.body,
  );
}
