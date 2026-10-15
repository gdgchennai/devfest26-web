"use client";
import { useState } from "react";
import { hallTestIdentities } from "@/lib/hall-test-identities";
import type { HallSnapshot } from "@/lib/hall-model";
export function LocalHallTools({
  snapshot,
}: {
  snapshot: HallSnapshot | null;
}) {
  const [message, setMessage] = useState(""),
    [time, setTime] = useState("2026-10-17T11:00");
  if (process.env.NEXT_PUBLIC_HALL_ISOLATED !== "1") return null;
  async function role(value: string) {
    const r = await fetch("/api/halls/dev", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: value }),
    });
    if (r.ok) location.reload();
    else setMessage(`Role selection failed (${r.status})`);
  }
  async function clock(now: number | null) {
    const r = await fetch("/api/admin/halls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "clock",
        now,
        expected: snapshot?.revision,
      }),
    });
    setMessage(
      r.ok ? "Clock updated" : ((await r.json()) as { error: string }).error,
    );
  }
  return (
    <aside className="mb-6 rounded-xl border border-yellow/50 bg-yellow/5 p-4 text-sm">
      <p className="font-semibold text-yellow">
        Local test environment · clock affects measurement age only
      </p>
      <p className="my-2">
        {snapshot?.clock != null
          ? new Date(snapshot.clock).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            }) + " IST (frozen)"
          : "Real clock"}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label>
          Identity{" "}
          <select
            aria-label="Test identity"
            defaultValue=""
            onChange={(e) => role(e.target.value)}
            className="min-h-11 rounded border border-paper/20 bg-surface p-2"
          >
            <option value="" disabled>
              Switch identity
            </option>
            {hallTestIdentities.map((identity) => (
              <option key={identity.value} value={identity.value}>
                {identity.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          IST{" "}
          <input
            aria-label="Simulated IST time"
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="min-h-11 max-w-full rounded border border-paper/20 p-2"
          />
        </label>
        <button
          onClick={() => clock(Date.parse(`${time}:00+05:30`))}
          className="min-h-11 rounded border border-paper/20 px-3"
        >
          Set clock (super admin)
        </button>
        <button onClick={() => clock(null)} className="min-h-11 px-3">
          Real time
        </button>
        <a href="/admin/halls" className="text-blue underline">
          Hall controls
        </a>
        <a href="/live" className="text-blue underline">
          Public page
        </a>
      </div>
      <p role="status">{message}</p>
    </aside>
  );
}
