"use client";

import { useEffect, useState, useTransition } from "react";
import type { LiveHallData } from "@/lib/hall-status";
import { LiveHallCard } from "@/components/live/LiveHallCard";
import { SessionFinderBanner } from "@/components/live/SessionFinderBanner";

type FloorFilter = {
  id: string;
  label: string;
  match?: string;
};

const FLOORS: readonly FloorFilter[] = [
  { id: "all", label: "All Floors" },
  { id: "d7", label: "7th Floor (D7)", match: "7th floor" },
  { id: "d6", label: "6th Floor (D6)", match: "6th floor" },
  { id: "e", label: "Ground Floor (E)", match: "Ground floor" },
];

export function LiveHallBoard({ initialHalls }: { initialHalls: LiveHallData[] }) {
  const [halls, setHalls] = useState<LiveHallData[]>(initialHalls);
  const [selectedFloor, setSelectedFloor] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  async function refreshData() {
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; halls: LiveHallData[] };
      if (data.ok && Array.isArray(data.halls)) {
        startTransition(() => {
          setHalls(data.halls);
          setLastRefreshed(new Date());
        });
      }
    } catch (err) {
      console.error("Failed to poll live hall data:", err);
    }
  }

  // Auto-poll every 3 minutes, only when tab is actively visible to save battery & Cloudflare resources
  useEffect(() => {
    void refreshData();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshData();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshData();
      }
    }, 180000); // 3 minutes

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const filteredHalls = halls.filter((h) => {
    if (selectedFloor === "all") return true;
    const f = FLOORS.find((fl) => fl.id === selectedFloor);
    return f?.match ? h.floorName.toLowerCase().includes(f.match.toLowerCase()) : true;
  });

  return (
    <div>
      {/* Interactive Session Finder Banner */}
      <SessionFinderBanner halls={halls} />

      {/* Controls Bar: Floor Pills + Live Polling Indicator & Manual Refresh */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Floor selector pills */}
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter halls by floor">
          {FLOORS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={selectedFloor === f.id}
              onClick={() => setSelectedFloor(f.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                selectedFloor === f.id
                  ? "border border-paper bg-paper text-ink"
                  : "border border-paper/15 text-paper/70 hover:border-paper/40 hover:text-paper"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Live status badge & Refresh button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-paper/60">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
            </span>
            <span>Live updates</span>
            <span className="hidden sm:inline text-paper/40">
              · {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => refreshData()}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-full border border-paper/20 px-3 py-1 text-xs text-paper/80 transition-colors hover:border-paper/50 hover:text-paper disabled:opacity-50"
            aria-label="Refresh hall data"
          >
            <svg
              className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            <span>{isPending ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filteredHalls.map((hall, idx) => (
          <LiveHallCard
            key={hall.track}
            hall={hall}
            featured={idx === 0 && selectedFloor === "all"}
          />
        ))}
      </div>

      {filteredHalls.length === 0 && (
        <div className="mt-12 rounded-3xl border border-dashed border-paper/20 p-12 text-center text-paper/60">
          No halls found on this floor.
        </div>
      )}
    </div>
  );
}
