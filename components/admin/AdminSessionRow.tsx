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
  initialRecommended = false,
}: {
  sessionKey: string;
  title: string;
  hall: string;
  start: string;
  end: string;
  initialStatus: SessionStatus;
  initialRecommended?: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [recommended, setRecommended] = useState(initialRecommended);
  const [pending, setPending] = useState(false);
  const [recommendPending, setRecommendPending] = useState(false);
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

  async function toggleRecommend() {
    if (recommendPending) return;
    setRecommendPending(true);
    setError(false);
    const previous = recommended;
    const next = !recommended;
    setRecommended(next);
    try {
      const res = await fetch("/api/admin/session-recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionKey, recommended: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setRecommended(previous);
      setError(true);
    } finally {
      setRecommendPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper/10 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-paper">{title}</p>
          {recommended && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-yellow/40 bg-yellow/10 px-2 py-0.5 text-[10px] font-bold text-yellow">
              <span>⭐</span>
              Recommended
            </span>
          )}
        </div>
        <p className="text-xs text-paper/50">
          {formatSessionTime(start)}–{formatSessionTime(end)} · {hall}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {error && <span className="text-xs text-red">Failed, try again</span>}

        {/* Status buttons */}
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

        {/* Recommend toggle button */}
        <button
          type="button"
          disabled={recommendPending}
          onClick={toggleRecommend}
          aria-pressed={recommended}
          title={recommended ? "Remove organizer recommendation" : "Recommend this session on live board"}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 ${
            recommended
              ? "border-yellow bg-yellow text-ink shadow-sm shadow-yellow/20"
              : "border-paper/20 text-paper/70 hover:border-yellow/50 hover:bg-yellow/10 hover:text-paper"
          }`}
        >
          <span>⭐</span>
          <span>{recommended ? "Recommended" : "Recommend"}</span>
        </button>
      </div>
    </div>
  );
}
