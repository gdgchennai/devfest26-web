"use client";

import { useState } from "react";
import { formatSessionTime } from "@/lib/format";
import type { SessionStatus } from "@/lib/session-status";

const LABEL: Record<SessionStatus, string> = {
  upcoming: "Upcoming",
  started: "Started",
  ended: "Ended",
};

export function AdminSessionRow({
  sessionKey,
  title,
  hall,
  start,
  end,
  initialStatus,
}: {
  sessionKey: string;
  title: string;
  hall: string;
  start: string;
  end: string;
  initialStatus: SessionStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function setTo(next: SessionStatus) {
    if (next === status || pending) return;
    setPending(true);
    setError(false);
    const previous = status;
    setStatus(next);
    try {
      const res = await fetch("/api/admin/session-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionKey, status: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setStatus(previous);
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper/10 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-paper">{title}</p>
        <p className="text-xs text-paper/50">
          {formatSessionTime(start)}–{formatSessionTime(end)} · {hall}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red">Failed, try again</span>}
        {(["upcoming", "started", "ended"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={pending}
            onClick={() => setTo(option)}
            aria-pressed={status === option}
            className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
              status === option
                ? "border-paper bg-paper text-ink"
                : "border-paper/20 text-paper/70 hover:border-paper/40"
            }`}
          >
            {LABEL[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
