"use client";

import { useState } from "react";
import type { LiveHallData, OccupancyStatus } from "@/lib/hall-status";
import { trackColor } from "@/lib/track-color";

export function AdminHallControl({
  initialHall,
}: {
  initialHall: LiveHallData;
}) {
  const [hall, setHall] = useState<LiveHallData>(initialHall);
  const [announcementText, setAnnouncementText] = useState<string>(initialHall.announcement ?? "");
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const palette = trackColor(hall.track);

  async function updateStatus(newStatus: OccupancyStatus) {
    setHall((prev) => ({ ...prev, occupancyStatus: newStatus }));
    setStatusMessage("Saving...");

    try {
      const res = await fetch("/api/admin/hall-status", {
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

  async function handleAnnouncementSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSavingNote(true);
    setNoteMessage(null);

    const trimmed = announcementText.trim().slice(0, 80);

    try {
      const res = await fetch("/api/admin/hall-status", {
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
              onClick={() => updateStatus("available")}
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
              onClick={() => updateStatus("filling_fast")}
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
              onClick={() => updateStatus("houseful")}
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

        {/* 2. In-Hall Announcement */}
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
                    fetch("/api/admin/hall-status", {
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
