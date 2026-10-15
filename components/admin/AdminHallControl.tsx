"use client";

import { useState } from "react";
import type { LiveHallData, OccupancyStatus } from "@/lib/hall-status";
import type { SessionStatus } from "@/lib/session-status";
import { formatSessionTime } from "@/lib/format";
import { trackColor } from "@/lib/track-color";

export type AdminHallSessionItem = {
  sessionKey: string;
  id: string;
  title: string;
  start: string;
  end: string;
  hall: string;
  speakerNames: string;
  status: SessionStatus;
};

export function AdminHallControl({
  initialHall,
  initialSessions = [],
}: {
  initialHall: LiveHallData;
  initialSessions?: AdminHallSessionItem[];
}) {
  const [hall, setHall] = useState<LiveHallData>(initialHall);
  const [sessions, setSessions] = useState<AdminHallSessionItem[]>(initialSessions);
  const [announcementText, setAnnouncementText] = useState<string>(initialHall.announcement ?? "");
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Session status controls
  const [sessionPendingKey, setSessionPendingKey] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  // Helper to find initial active session or first non-ended session
  function findDefaultCurrentKey(): string {
    const started = initialSessions.find((s) => s.status === "started");
    if (started) return started.sessionKey;
    const firstNonEnded = initialSessions.find((s) => s.status !== "ended");
    return firstNonEnded?.sessionKey ?? initialSessions[0]?.sessionKey ?? "";
  }

  // Helper to find upcoming session relative to current key
  function findDefaultUpcomingKey(currKey: string): string {
    const currIdx = initialSessions.findIndex((s) => s.sessionKey === currKey);
    if (currIdx !== -1) {
      const nextNonEnded = initialSessions.slice(currIdx + 1).find((s) => s.status !== "ended");
      if (nextNonEnded) return nextNonEnded.sessionKey;
    }
    const nonEnded = initialSessions.filter((s) => s.sessionKey !== currKey && s.status !== "ended");
    return nonEnded[0]?.sessionKey ?? "";
  }

  const [currentPickerKey, setCurrentPickerKey] = useState<string>(findDefaultCurrentKey);
  const [upcomingPickerKey, setUpcomingPickerKey] = useState<string>(() =>
    findDefaultUpcomingKey(findDefaultCurrentKey()),
  );

  const palette = trackColor(hall.track);

  function hallApiEndpoint() {
    if (
      typeof window !== "undefined" &&
      (window.location.search.includes("dev_admin=true") || window.location.search.includes("dev=1"))
    ) {
      return "/api/admin/hall-status?dev_admin=true";
    }
    return "/api/admin/hall-status";
  }

  function sessionApiEndpoint() {
    if (
      typeof window !== "undefined" &&
      (window.location.search.includes("dev_admin=true") || window.location.search.includes("dev=1"))
    ) {
      return "/api/admin/session-status?dev_admin=true";
    }
    return "/api/admin/session-status";
  }

  async function updateOccupancyStatus(newStatus: OccupancyStatus) {
    setHall((prev) => ({ ...prev, occupancyStatus: newStatus }));
    setStatusMessage("Saving...");

    try {
      const res = await fetch(hallApiEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track: hall.track, occupancyStatus: newStatus }),
      });

      if (!res.ok) throw new Error("Update failed");
      setStatusMessage("Status updated!");
      setTimeout(() => setStatusMessage(null), 2000);
    } catch {
      setStatusMessage("Failed to update status");
      setHall((prev) => ({ ...prev, occupancyStatus: initialHall.occupancyStatus }));
    }
  }

  async function updateSessionStatus(targetKey: string, newStatus: SessionStatus) {
    if (sessionPendingKey) return;
    setSessionPendingKey(targetKey);
    setSessionMessage(null);

    const prevSessions = [...sessions];

    // Optimistic update
    setSessions((prev) =>
      prev.map((s) => {
        if (s.sessionKey === targetKey) {
          return { ...s, status: newStatus };
        }
        // If starting a session, ensure previous started session in this track is marked ended
        if (newStatus === "started" && s.status === "started") {
          return { ...s, status: "ended" };
        }
        return s;
      }),
    );

    try {
      const activeStarted = sessions.find((s) => s.status === "started" && s.sessionKey !== targetKey);
      if (newStatus === "started" && activeStarted) {
        fetch(sessionApiEndpoint(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey: activeStarted.sessionKey, status: "ended" }),
        }).catch(() => {});
      }

      const res = await fetch(sessionApiEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: targetKey, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update session");

      const targetSession = sessions.find((s) => s.sessionKey === targetKey);
      const label =
        newStatus === "started"
          ? "Started (Push alert sent!)"
          : newStatus === "ended"
            ? "Ended"
            : "Reset to Upcoming";
      setSessionMessage(`"${targetSession?.title ?? "Session"}" ${label}`);
      setTimeout(() => setSessionMessage(null), 3000);

      // Auto-advance pickers
      if (newStatus === "started") {
        setCurrentPickerKey(targetKey);
        const targetIdx = sessions.findIndex((s) => s.sessionKey === targetKey);
        const nextSession = sessions.slice(targetIdx + 1).find((s) => s.status !== "ended");
        if (nextSession) {
          setUpcomingPickerKey(nextSession.sessionKey);
        }
      } else if (newStatus === "ended" && targetKey === currentPickerKey) {
        const targetIdx = sessions.findIndex((s) => s.sessionKey === targetKey);
        const nextSession = sessions.slice(targetIdx + 1).find((s) => s.status !== "ended");
        if (nextSession) {
          setCurrentPickerKey(nextSession.sessionKey);
          const following = sessions
            .slice(sessions.findIndex((s) => s.sessionKey === nextSession.sessionKey) + 1)
            .find((s) => s.status !== "ended");
          if (following) {
            setUpcomingPickerKey(following.sessionKey);
          }
        }
      }
    } catch {
      setSessions(prevSessions);
      setSessionMessage("Error updating session status");
      setTimeout(() => setSessionMessage(null), 3000);
    } finally {
      setSessionPendingKey(null);
    }
  }

  function handleCurrentPickerChange(newKey: string) {
    setCurrentPickerKey(newKey);
    const newIdx = sessions.findIndex((s) => s.sessionKey === newKey);
    if (newIdx !== -1) {
      const nextNonEnded = sessions.slice(newIdx + 1).find((s) => s.status !== "ended");
      if (nextNonEnded) {
        setUpcomingPickerKey(nextNonEnded.sessionKey);
      }
    }
  }

  async function handleAnnouncementSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSavingNote(true);
    setNoteMessage(null);

    const trimmed = announcementText.trim().slice(0, 80);

    try {
      const res = await fetch(hallApiEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track: hall.track, announcement: trimmed || null }),
      });

      if (!res.ok) throw new Error("Failed to update note");
      setHall((prev) => ({ ...prev, announcement: trimmed || null }));
      setNoteMessage("Note broadcasted to live board!");
      setTimeout(() => setNoteMessage(null), 3000);
    } catch {
      setNoteMessage("Error broadcasting note");
    } finally {
      setSavingNote(false);
    }
  }

  const currentSessionObj =
    sessions.find((s) => s.sessionKey === currentPickerKey) ?? sessions[0];
  const upcomingSessionObj =
    sessions.find((s) => s.sessionKey === upcomingPickerKey) ??
    sessions.find((s) => s.sessionKey !== currentPickerKey && s.status !== "ended") ??
    null;

  return (
    <div className="overflow-hidden rounded-3xl border border-paper/15 bg-ink/90 p-5 sm:p-7 backdrop-blur-md">
      {/* Hall & Track Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${palette.border} ${palette.text}`}
              style={{ backgroundColor: `color-mix(in srgb, ${palette.cssVar} 12%, transparent)` }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${palette.bg}`} />
              {hall.trackName}
            </span>
            <span className="text-xs text-paper/50">{hall.floorName}</span>
          </div>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-paper sm:text-3xl">
            {hall.hallName}
          </h2>
        </div>

        {statusMessage && (
          <span className="rounded-full bg-paper/10 px-3 py-1 text-xs text-paper/80">
            {statusMessage}
          </span>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {/* 1. Quick Occupancy Status Tap */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-paper/60">
              Hall Occupancy Status
            </label>
            <span className="text-xs text-paper/40">Tap to broadcast live status</span>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Available (Green) */}
            <button
              type="button"
              onClick={() => updateOccupancyStatus("available")}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                hall.occupancyStatus === "available"
                  ? "border-green bg-green/15 text-paper ring-2 ring-green shadow-lg shadow-green/10"
                  : "border-paper/15 bg-paper/5 text-paper/70 hover:border-green/40 hover:bg-green/5 hover:text-paper"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-bold text-green">
                <span className="h-2.5 w-2.5 rounded-full bg-green" />
                Available
              </div>
              <span className="text-xs text-paper/50">Plenty of seats available</span>
            </button>

            {/* Filling Fast (Yellow) */}
            <button
              type="button"
              onClick={() => updateOccupancyStatus("filling_fast")}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                hall.occupancyStatus === "filling_fast"
                  ? "border-yellow bg-yellow/15 text-paper ring-2 ring-yellow shadow-lg shadow-yellow/10"
                  : "border-paper/15 bg-paper/5 text-paper/70 hover:border-yellow/40 hover:bg-yellow/5 hover:text-paper"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-bold text-yellow">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow" />
                Filling fast
              </div>
              <span className="text-xs text-paper/50">Seats filling up quickly</span>
            </button>

            {/* Houseful (Red) */}
            <button
              type="button"
              onClick={() => updateOccupancyStatus("houseful")}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                hall.occupancyStatus === "houseful"
                  ? "border-red bg-red/15 text-paper ring-2 ring-red shadow-lg shadow-red/10"
                  : "border-paper/15 bg-paper/5 text-paper/70 hover:border-red/40 hover:bg-red/5 hover:text-paper"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-bold text-red">
                <span className="h-2.5 w-2.5 rounded-full bg-red" />
                Houseful
              </div>
              <span className="text-xs text-paper/50">At maximum room capacity</span>
            </button>
          </div>
        </div>

        {/* 2. Session Status & Live Board Queue */}
        <div className="rounded-2xl border border-paper/10 bg-paper/5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-paper/60">
              Live Session Status & Queue
            </label>
            {sessionMessage && (
              <span className="text-xs font-medium text-green animate-pulse">
                {sessionMessage}
              </span>
            )}
          </div>

          {sessions.length === 0 ? (
            <p className="mt-3 text-xs text-paper/40 italic">
              No scheduled sessions configured for this track.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {/* ── CURRENT SESSION PICKER ── */}
              <div className="rounded-2xl border border-paper/10 bg-ink/60 p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green">
                    <span className="h-2 w-2 rounded-full bg-green animate-pulse" />
                    Current Session (Now Happening)
                  </div>
                  {currentSessionObj?.status === "started" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-green/30 bg-green/10 px-2 py-0.5 text-[10px] font-bold text-green">
                      LIVE ON BOARD
                    </span>
                  )}
                </div>

                {/* Current Picker Dropdown */}
                <div className="mt-2.5">
                  <select
                    value={currentPickerKey}
                    onChange={(e) => handleCurrentPickerChange(e.target.value)}
                    className="w-full rounded-xl border border-paper/20 bg-ink px-3 py-2 text-xs text-paper focus:border-paper/60 focus:outline-none"
                  >
                    {sessions.map((s) => {
                      const tag =
                        s.status === "started"
                          ? "🟢 Started"
                          : s.status === "ended"
                            ? "⬛ Ended"
                            : "⚪ Upcoming";
                      return (
                        <option key={s.sessionKey} value={s.sessionKey}>
                          [{formatSessionTime(s.start)} – {formatSessionTime(s.end)}] {s.title} ({tag})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Selected Current Session Details & Action Buttons */}
                {currentSessionObj && (
                  <div className="mt-3 flex flex-col gap-3 rounded-xl border border-paper/10 bg-paper/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold text-paper">
                        {currentSessionObj.title}
                      </p>
                      <p className="mt-0.5 text-xs text-paper/50">
                        {formatSessionTime(currentSessionObj.start)} – {formatSessionTime(currentSessionObj.end)}
                        {currentSessionObj.speakerNames ? ` · ${currentSessionObj.speakerNames}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={sessionPendingKey === currentSessionObj.sessionKey}
                        onClick={() => updateSessionStatus(currentSessionObj.sessionKey, "started")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                          currentSessionObj.status === "started"
                            ? "border-green bg-green text-ink font-bold shadow-sm shadow-green/20"
                            : "border-paper/20 text-paper/80 hover:border-green/50 hover:bg-green/10 hover:text-paper"
                        }`}
                      >
                        {currentSessionObj.status === "started" ? "● Started" : "Mark Started"}
                      </button>

                      <button
                        type="button"
                        disabled={sessionPendingKey === currentSessionObj.sessionKey}
                        onClick={() => updateSessionStatus(currentSessionObj.sessionKey, "ended")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                          currentSessionObj.status === "ended"
                            ? "border-paper/40 bg-paper/20 text-paper font-bold"
                            : "border-paper/20 text-paper/80 hover:border-red/40 hover:bg-red/10 hover:text-paper"
                        }`}
                      >
                        {currentSessionObj.status === "ended" ? "✓ Ended" : "Mark Ended"}
                      </button>

                      {currentSessionObj.status !== "upcoming" && (
                        <button
                          type="button"
                          disabled={sessionPendingKey === currentSessionObj.sessionKey}
                          onClick={() => updateSessionStatus(currentSessionObj.sessionKey, "upcoming")}
                          title="Reset status back to upcoming"
                          className="rounded-full border border-paper/15 px-2.5 py-1 text-[11px] text-paper/50 hover:border-paper/30 hover:text-paper"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── UPCOMING SESSION PICKER ── */}
              <div className="rounded-2xl border border-paper/10 bg-ink/60 p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-yellow">
                    <span className="h-2 w-2 rounded-full bg-yellow" />
                    Upcoming Session (Up Next)
                  </div>
                  <span className="text-[10px] text-paper/40">Auto-sequenced · Manual override supported</span>
                </div>

                {/* Upcoming Picker Dropdown */}
                <div className="mt-2.5">
                  <select
                    value={upcomingPickerKey}
                    onChange={(e) => setUpcomingPickerKey(e.target.value)}
                    className="w-full rounded-xl border border-paper/20 bg-ink px-3 py-2 text-xs text-paper focus:border-paper/60 focus:outline-none"
                  >
                    {sessions
                      .filter((s) => s.sessionKey !== currentPickerKey || sessions.length === 1)
                      .map((s) => (
                        <option key={s.sessionKey} value={s.sessionKey}>
                          [{formatSessionTime(s.start)} – {formatSessionTime(s.end)}] {s.title}
                          {s.status === "ended" ? " (Ended)" : s.status === "started" ? " (Started)" : ""}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Selected Upcoming Session Details & Quick Start Button */}
                {upcomingSessionObj && (
                  <div className="mt-3 flex flex-col gap-3 rounded-xl border border-paper/10 bg-paper/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold text-paper">
                        {upcomingSessionObj.title}
                      </p>
                      <p className="mt-0.5 text-xs text-paper/50">
                        {formatSessionTime(upcomingSessionObj.start)} – {formatSessionTime(upcomingSessionObj.end)}
                        {upcomingSessionObj.speakerNames ? ` · ${upcomingSessionObj.speakerNames}` : ""}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        disabled={sessionPendingKey === upcomingSessionObj.sessionKey || upcomingSessionObj.status === "started"}
                        onClick={() => updateSessionStatus(upcomingSessionObj.sessionKey, "started")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-paper/20 bg-paper px-3.5 py-1.5 text-xs font-bold text-ink transition-all hover:bg-paper/90 active:scale-95 disabled:opacity-50"
                      >
                        <span>▶ Start Next Session</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. In-Hall Announcement */}
        <div className="rounded-2xl border border-paper/10 bg-paper/5 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <label htmlFor={`announcement-${hall.track}`} className="text-xs font-semibold uppercase tracking-wider text-paper/60">
              In-Hall Announcement (Max 80 chars)
            </label>
            <span
              className={`text-xs tabular-nums ${
                announcementText.length >= 75
                  ? "text-red"
                  : announcementText.length >= 60
                    ? "text-yellow"
                    : "text-paper/40"
              }`}
            >
              {announcementText.length}/80
            </span>
          </div>

          <form onSubmit={handleAnnouncementSubmit} className="mt-2.5 flex flex-col gap-2.5 sm:flex-row">
            <input
              id={`announcement-${hall.track}`}
              type="text"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              maxLength={80}
              placeholder="e.g. Q&A started, session beginning in 2 minutes"
              className="min-w-0 flex-1 rounded-2xl border border-paper/20 bg-paper/5 px-4 py-2.5 text-sm text-paper placeholder:text-paper/30 focus:border-paper/60 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingNote}
                className="rounded-2xl bg-paper px-4 py-2.5 text-xs font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {savingNote ? "Saving..." : "Update note"}
              </button>
              {announcementText && (
                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementText("");
                    setSavingNote(true);
                    fetch(hallApiEndpoint(), {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ track: hall.track, announcement: null }),
                    }).finally(() => {
                      setSavingNote(false);
                      setHall((prev) => ({ ...prev, announcement: null }));
                      setNoteMessage("Note cleared");
                      setTimeout(() => setNoteMessage(null), 2000);
                    });
                  }}
                  className="rounded-2xl border border-paper/20 px-3 py-2.5 text-xs text-paper/60 hover:border-paper/40 hover:text-paper"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {noteMessage && (
            <p className="mt-2 text-xs font-medium text-green">{noteMessage}</p>
          )}

          {hall.announcement && (
            <div className="mt-3 rounded-2xl border border-yellow/20 bg-yellow/5 p-3 text-xs text-paper/80">
              <span className="font-semibold text-yellow">Currently broadcasted: </span>
              &ldquo;{hall.announcement}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
