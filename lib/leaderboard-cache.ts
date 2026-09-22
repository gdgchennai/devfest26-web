import "server-only";
import { getGameLeaderboard, getOverallLeaderboard, type LeaderboardEntry, type OverallLeaderboardEntry } from "@/lib/leaderboard";
import { GAME_IDS, defaultVariant, isVariant, type GameId } from "@/lib/game-rules";

export type BoardRow = LeaderboardEntry | OverallLeaderboardEntry;

/**
 * How deep a board is read. `GET /api/games/scores` serves the top of it, and
 * `/api/games/scores/me` finds a signed-in player's rank in it, so both come from one read.
 * A player ranked past this gets no rank, only "outside the top N".
 */
export const BOARD_DEPTH = 1000;

const TTL_MS = 20_000;
const MAX_BOARDS = 60;
const boards = new Map<string, { at: number; rows: BoardRow[] }>();

/**
 * A board's ranked rows, kept for a few seconds per Worker isolate. The ranking is the same
 * for everyone, and it's the busiest read on the site once a crowd is playing, so a burst of
 * people opening the leaderboard costs one D1 query instead of one each. A publish clears it.
 */
export async function getBoard(gameId: string, variant: string): Promise<BoardRow[]> {
  const key = `${gameId}|${variant}`;
  const hit = boards.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;

  const rows: BoardRow[] =
    gameId === "all" ? await getOverallLeaderboard(BOARD_DEPTH) : await getGameLeaderboard(gameId, variant, BOARD_DEPTH);
  if (boards.size >= MAX_BOARDS) boards.clear();
  boards.set(key, { at: Date.now(), rows });
  return rows;
}

export function clearBoards() {
  boards.clear();
}

/** Reads `gameId` and `variant` from a query string: "all" (no variant), or a game and one of its boards. */
export function parseBoard(
  params: URLSearchParams,
): { ok: true; gameId: string; variant: string } | { ok: false; error: string } {
  const gameId = params.get("gameId") || "all";
  if (gameId === "all") return { ok: true, gameId, variant: "" };
  if (!GAME_IDS.includes(gameId as GameId)) return { ok: false, error: "Invalid gameId" };
  const variant = params.get("variant") ?? defaultVariant(gameId as GameId);
  if (!isVariant(gameId as GameId, variant)) return { ok: false, error: "Invalid variant" };
  return { ok: true, gameId, variant };
}
