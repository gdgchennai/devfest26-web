import "server-only";
import { getDb } from "@/lib/db";
import { siteConfig } from "@/site.config";
import { getAgenda, getSpeakers } from "@/lib/content";
import { getSessionStatuses } from "@/lib/session-status";
import { sessionKey } from "@/lib/session-key";
import { joinSpeakerNames, findSpeakers } from "@/lib/find-speaker";
import type { AgendaSession } from "@/lib/schemas";

export type OccupancyStatus = "available" | "filling_fast" | "houseful";

export type HallConfig = {
  track: string;
  trackName: string;
  hallName: string;
  floorName: string;
  defaultCapacity: number;
};

export const TRACK_HALL_CONFIGS: Record<string, HallConfig> = {
  "d7-auditorium": {
    track: "d7-auditorium",
    trackName: "Tech",
    hallName: "D7 Auditorium",
    floorName: "D block 7th floor",
    defaultCapacity: 500,
  },
  "d7-amphitheater": {
    track: "d7-amphitheater",
    trackName: "Deep tech",
    hallName: "D7 Amphitheater",
    floorName: "D block 7th floor",
    defaultCapacity: 250,
  },
  "agent-wars": {
    track: "agent-wars",
    trackName: "Agent Wars",
    hallName: "D6 Multi-purpose Hall",
    floorName: "D block 6th floor",
    defaultCapacity: 100,
  },
  lightning: {
    track: "lightning",
    trackName: "Lightning Talks",
    hallName: "D6 Multi-purpose Hall",
    floorName: "D block 6th floor",
    defaultCapacity: 100,
  },
  "vibe-coding": {
    track: "vibe-coding",
    trackName: "Vibe Lounge",
    hallName: "D6 Multi-purpose Hall",
    floorName: "D block 6th floor",
    defaultCapacity: 80,
  },
  "raman-hall": {
    track: "raman-hall",
    trackName: "Workshop",
    hallName: "Raman Hall",
    floorName: "E block Ground floor",
    defaultCapacity: 120,
  },
  "creators-lounge": {
    track: "creators-lounge",
    trackName: "Creators Lounge",
    hallName: "D7 Pre-Function Area",
    floorName: "D block 7th floor",
    defaultCapacity: 60,
  },
  "meetup-lounge": {
    track: "meetup-lounge",
    trackName: "Meetup Lounge",
    hallName: "D7 Pre-Function Area",
    floorName: "D block 7th floor",
    defaultCapacity: 60,
  },
};

export type CurrentSessionInfo = {
  id: string;
  title: string;
  start: string;
  end: string;
  speakerNames: string;
  type: string;
  isHappeningNow: boolean;
};

export type LiveHallData = {
  track: string;
  trackName: string;
  hallName: string;
  floorName: string;
  occupancyStatus: OccupancyStatus;
  headcount: number;
  capacity: number;
  percentage: number;
  announcement: string | null;
  updatedAt: number;
  currentSession: CurrentSessionInfo | null;
  nextSession: CurrentSessionInfo | null;
};

export type HallStatusRow = {
  track: string;
  occupancy_status: OccupancyStatus;
  headcount: number;
  capacity: number;
  announcement: string | null;
  updated_at: number;
  updated_by: string | null;
};

/**
 * Reads all live hall statuses from D1, falling back to defaults if uninitialized.
 */
export async function getHallStatusRows(): Promise<Map<string, HallStatusRow>> {
  const map = new Map<string, HallStatusRow>();
  try {
    const db = await getDb();
    const { results } = await db
      .prepare(
        "SELECT track, occupancy_status, headcount, capacity, announcement, updated_at, updated_by FROM hall_status",
      )
      .all<HallStatusRow>();

    for (const row of results) {
      map.set(row.track, row);
    }
  } catch {
    // If table does not exist or D1 query fails, Map remains empty and defaults will apply.
  }
  return map;
}

function toSessionInfo(
  session: AgendaSession,
  isHappeningNow: boolean,
  speakersList: Awaited<ReturnType<typeof getSpeakers>>,
): CurrentSessionInfo {
  const matchedSpeakers = findSpeakers(speakersList, session.speakerSlugs);
  return {
    id: session.id,
    title: session.title,
    start: session.start,
    end: session.end,
    speakerNames: joinSpeakerNames(matchedSpeakers),
    type: session.type,
    isHappeningNow,
  };
}

/**
 * Resolves both the currently active session and the upcoming session for a track.
 */
function resolveTrackSessions(
  trackSessions: AgendaSession[],
  statuses: Record<string, string>,
  nowMs: number,
  speakersList: Awaited<ReturnType<typeof getSpeakers>>,
): {
  currentSession: CurrentSessionInfo | null;
  nextSession: CurrentSessionInfo | null;
} {
  if (trackSessions.length === 0) {
    return { currentSession: null, nextSession: null };
  }

  // 1. Explicit organizer override: check if any session has been marked 'started'
  const explicitlyStartedIdx = trackSessions.findIndex((s) => statuses[sessionKey(s)] === "started");
  if (explicitlyStartedIdx !== -1) {
    const current = toSessionInfo(trackSessions[explicitlyStartedIdx], true, speakersList);
    const nextSessionObj = trackSessions
      .slice(explicitlyStartedIdx + 1)
      .find((s) => statuses[sessionKey(s)] !== "ended");
    const next = nextSessionObj ? toSessionInfo(nextSessionObj, false, speakersList) : null;
    return { currentSession: current, nextSession: next };
  }

  // 2. Real-time chronological match: is there a session whose interval includes now and is not 'ended'?
  const runningIdx = trackSessions.findIndex((s) => {
    if (statuses[sessionKey(s)] === "ended") return false;
    const startMs = Date.parse(s.start);
    const endMs = Date.parse(s.end);
    return nowMs >= startMs && nowMs <= endMs;
  });

  if (runningIdx !== -1) {
    const current = toSessionInfo(trackSessions[runningIdx], true, speakersList);
    const nextSessionObj = trackSessions
      .slice(runningIdx + 1)
      .find((s) => statuses[sessionKey(s)] !== "ended");
    const next = nextSessionObj ? toSessionInfo(nextSessionObj, false, speakersList) : null;
    return { currentSession: current, nextSession: next };
  }

  // 3. No session is actively running: find upcoming non-ended sessions
  const remaining = trackSessions.filter((s) => statuses[sessionKey(s)] !== "ended");
  if (remaining.length > 0) {
    const next = toSessionInfo(remaining[0], false, speakersList);
    return {
      currentSession: null,
      nextSession: next,
    };
  }

  return { currentSession: null, nextSession: null };
}

/**
 * Returns comprehensive live hall state for all tracks, sorted in floor order.
 */
export async function getAllLiveHalls(nowMs: number = Date.now()): Promise<LiveHallData[]> {
  const [statusRows, allSessions, statuses, speakersList] = await Promise.all([
    getHallStatusRows(),
    getAgenda(),
    getSessionStatuses(),
    getSpeakers(),
  ]);

  // Order tracks by siteConfig.floors sequence
  const trackOrder: string[] = [];
  for (const floor of siteConfig.floors) {
    for (const trk of floor.tracks) {
      if (TRACK_HALL_CONFIGS[trk] && !trackOrder.includes(trk)) {
        trackOrder.push(trk);
      }
    }
  }
  for (const trk of Object.keys(TRACK_HALL_CONFIGS)) {
    if (!trackOrder.includes(trk)) trackOrder.push(trk);
  }

  return trackOrder.map((trackSlug) => {
    const config = TRACK_HALL_CONFIGS[trackSlug] ?? {
      track: trackSlug,
      trackName: trackSlug,
      hallName: "Main Hall",
      floorName: "Main Floor",
      defaultCapacity: 100,
    };

    const row = statusRows.get(trackSlug);
    const capacity = row?.capacity ?? config.defaultCapacity;
    const headcount = Math.max(0, row?.headcount ?? 0);
    const percentage = capacity > 0 ? Math.min(100, Math.round((headcount / capacity) * 100)) : 0;
    const occupancyStatus: OccupancyStatus = row?.occupancy_status ?? "available";
    const announcement = row?.announcement?.trim() || null;
    const updatedAt = row?.updated_at ?? 0;

    const trackSessions = allSessions
      .filter((s) => s.track === trackSlug && s.type !== "break")
      .sort((a, b) => a.start.localeCompare(b.start));

    const { currentSession, nextSession } = resolveTrackSessions(trackSessions, statuses, nowMs, speakersList);

    return {
      track: trackSlug,
      trackName: config.trackName,
      hallName: config.hallName,
      floorName: config.floorName,
      occupancyStatus,
      headcount,
      capacity,
      percentage,
      announcement,
      updatedAt,
      currentSession,
      nextSession,
    };
  });
}

export type HallStatusUpdateInput = {
  occupancyStatus?: OccupancyStatus;
  headcount?: number;
  delta?: number;
  announcement?: string | null;
};

/**
 * Updates hall status, headcount, and announcement in D1.
 */
export async function updateHallStatus(
  track: string,
  input: HallStatusUpdateInput,
  userId: string | null,
): Promise<HallStatusRow> {
  const db = await getDb();
  const config = TRACK_HALL_CONFIGS[track];
  const defaultCap = config?.defaultCapacity ?? 100;

  // Read current row or initialize defaults
  const existing = await db
    .prepare("SELECT track, occupancy_status, headcount, capacity, announcement, updated_at FROM hall_status WHERE track = ?")
    .bind(track)
    .first<HallStatusRow>();

  const currentCapacity = existing?.capacity ?? defaultCap;
  let newHeadcount = existing?.headcount ?? 0;

  if (typeof input.delta === "number" && !Number.isNaN(input.delta)) {
    newHeadcount = Math.max(0, Math.min(currentCapacity, newHeadcount + input.delta));
  } else if (typeof input.headcount === "number" && !Number.isNaN(input.headcount)) {
    newHeadcount = Math.max(0, Math.min(currentCapacity, input.headcount));
  }

  const validStatuses: OccupancyStatus[] = ["available", "filling_fast", "houseful"];
  const newStatus: OccupancyStatus =
    input.occupancyStatus && validStatuses.includes(input.occupancyStatus)
      ? input.occupancyStatus
      : (existing?.occupancy_status ?? "available");

  let newAnnouncement = existing?.announcement ?? null;
  if (input.announcement !== undefined) {
    if (input.announcement === null || input.announcement.trim() === "") {
      newAnnouncement = null;
    } else {
      newAnnouncement = input.announcement.trim().slice(0, 80);
    }
  }

  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO hall_status (track, occupancy_status, headcount, capacity, announcement, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(track) DO UPDATE SET
         occupancy_status = excluded.occupancy_status,
         headcount = excluded.headcount,
         capacity = excluded.capacity,
         announcement = excluded.announcement,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`,
    )
    .bind(track, newStatus, newHeadcount, currentCapacity, newAnnouncement, now, userId)
    .run();

  return {
    track,
    occupancy_status: newStatus,
    headcount: newHeadcount,
    capacity: currentCapacity,
    announcement: newAnnouncement,
    updated_at: now,
    updated_by: userId,
  };
}
