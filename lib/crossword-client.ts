"use client";

import type { PublicCrosswordPuzzle } from "@/lib/game-rules";

const STORAGE_KEY = "devfest_daily_crossword";

export type CachedCrossword = {
  date: string;
  expiresAt: number;
  data: PublicCrosswordPuzzle[];
};

/** Calculates milliseconds timestamp for next IST midnight (24-hour cycle boundary). */
export function getNextCycleExpiration(nowMs = Date.now()): number {
  const istOffsetMs = 330 * 60_000;
  const istNow = new Date(nowMs + istOffsetMs);
  const nextMidnight = new Date(istNow);
  nextMidnight.setUTCHours(24, 0, 0, 0);
  return nextMidnight.getTime() - istOffsetMs;
}

/** Formats today's date in IST as YYYY-MM-DD. */
export function getClientDateKey(nowMs = Date.now()): string {
  const istOffsetMs = 330 * 60_000;
  const istDate = new Date(nowMs + istOffsetMs);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(istDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Retrieves the daily crossword puzzle from browser localStorage cache.
 * If expired or missing, fetches from API and caches it for 24 hours.
 */
export async function getOrFetchDailyCrossword(): Promise<PublicCrosswordPuzzle[]> {
  const now = Date.now();
  const dateKey = getClientDateKey(now);

  // 1. Try reading valid cache from localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedCrossword;
      if (
        parsed &&
        parsed.date === dateKey &&
        typeof parsed.expiresAt === "number" &&
        parsed.expiresAt > now &&
        Array.isArray(parsed.data) &&
        parsed.data.length > 0
      ) {
        return parsed.data;
      }
    }
  } catch (err) {
    console.warn("Could not read crossword from localStorage cache:", err);
  }

  // 2. Fetch fresh puzzle from server API
  try {
    const res = await fetch("/api/games/content?kind=crosswords");
    if (!res.ok) throw new Error(`Crossword API returned ${res.status}`);

    const payload = (await res.json()) as { data?: PublicCrosswordPuzzle[] };
    if (payload?.data && Array.isArray(payload.data) && payload.data.length > 0) {
      const expiresAt = getNextCycleExpiration(now);
      const cacheObj: CachedCrossword = {
        date: dateKey,
        expiresAt,
        data: payload.data,
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheObj));
      } catch (e) {
        console.warn("Could not write crossword to localStorage:", e);
      }

      return payload.data;
    }
  } catch (error) {
    console.warn("Failed fetching daily crossword:", error);
  }

  return [];
}

/**
 * Preloads the daily crossword puzzle silently into the user's browser cache.
 */
export function prefetchDailyCrossword(): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const dateKey = getClientDateKey(now);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedCrossword;
      if (parsed && parsed.date === dateKey && parsed.expiresAt > now && parsed.data?.length) {
        // Cache is already warm and valid for today
        return;
      }
    }
  } catch {
    // Continue to fetch
  }

  // Background fetch to avoid competing with critical first-paint resources
  const schedule = window.requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 1000));
  schedule(() => {
    getOrFetchDailyCrossword().catch(() => {});
  });
}
