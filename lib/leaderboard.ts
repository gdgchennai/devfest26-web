import "server-only";
import { getDb } from "@/lib/db";
import { newScoreId } from "@/lib/id";
import { getUserById } from "@/lib/users";

export type GameScoreRecord = {
  id: string;
  user_id: string;
  game_id: string;
  score: number;
  time_ms: number;
  moves: number;
  level_data: string | null;
  created_at: number;
};

export type LeaderboardEntry = {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  gameId: string;
  score: number;
  timeMs: number;
  moves: number;
  levelData?: string | null;
  createdAt: number;
  rank?: number;
};

export type OverallLeaderboardEntry = {
  userId: string;
  userName: string;
  userImage: string | null;
  totalScore: number;
  gamesPlayed: number;
  fastestTimeMs: number;
  lastPlayedAt: number;
  rank?: number;
};

// In-memory cache & fallback when D1 DB binding is unavailable in local dev/mock
const memoryScores: (GameScoreRecord & { userName: string; userImage: string | null })[] = [];

let tableEnsured = false;
async function ensureTable(db: D1Database): Promise<void> {
  if (tableEnsured) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS game_scores (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_id     TEXT NOT NULL,
        score       INTEGER NOT NULL,
        time_ms     INTEGER NOT NULL,
        moves       INTEGER NOT NULL DEFAULT 0,
        level_data  TEXT,
        created_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_game_scores_lookup ON game_scores(game_id, score DESC, time_ms ASC);
      CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id, game_id);
      CREATE INDEX IF NOT EXISTS idx_game_scores_created ON game_scores(created_at DESC);
    `);
    tableEnsured = true;
  } catch {
    tableEnsured = true;
  }
}

/**
 * Save a new game score for an authenticated user.
 */
export async function saveGameScore(params: {
  userId: string;
  gameId: string;
  score: number;
  timeMs: number;
  moves?: number;
  levelData?: string | null;
}): Promise<GameScoreRecord> {
  const record: GameScoreRecord = {
    id: newScoreId(),
    user_id: params.userId,
    game_id: params.gameId,
    score: Math.max(0, Math.floor(params.score)),
    time_ms: Math.max(0, Math.floor(params.timeMs)),
    moves: Math.max(0, Math.floor(params.moves ?? 0)),
    level_data: params.levelData ?? null,
    created_at: Date.now(),
  };

  try {
    const db = await getDb();
    await ensureTable(db);
    await db
      .prepare(
        `INSERT INTO game_scores (id, user_id, game_id, score, time_ms, moves, level_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.id,
        record.user_id,
        record.game_id,
        record.score,
        record.time_ms,
        record.moves,
        record.level_data,
        record.created_at,
      )
      .run();
  } catch (error) {
    console.warn("D1 write unavailable or not yet migrated, saving score in fallback memory store", error);
    const user = await getUserById(params.userId).catch(() => null);
    memoryScores.push({
      ...record,
      userName: user?.display_name || user?.name || "DevFest Player",
      userImage: user?.image || null,
    });
  }

  return record;
}

/**
 * Get top leaderboard scores for a specific game (e.g. 'jigsaw', 'crossword', 'memory').
 * Returns best entry per user to maintain fairness.
 */
export async function getGameLeaderboard(gameId: string, limit = 50): Promise<LeaderboardEntry[]> {
  try {
    const db = await getDb();
    await ensureTable(db);
    // Fetch best score per user for this game
    const { results } = await db
      .prepare(
        `SELECT
           s.id,
           s.user_id,
           s.game_id,
           s.score,
           s.time_ms,
           s.moves,
           s.level_data,
           s.created_at,
           COALESCE(u.display_name, u.name, 'DevFest Player') AS user_name,
           u.image AS user_image
         FROM game_scores s
         JOIN users u ON u.id = s.user_id
         WHERE s.game_id = ?
         ORDER BY s.score DESC, s.time_ms ASC, s.created_at ASC
         LIMIT ?`,
      )
      .bind(gameId, limit * 2)
      .all<{
        id: string;
        user_id: string;
        game_id: string;
        score: number;
        time_ms: number;
        moves: number;
        level_data: string | null;
        created_at: number;
        user_name: string;
        user_image: string | null;
      }>();

    // Deduplicate to show best score per user
    const seenUsers = new Set<string>();
    const deduplicated: LeaderboardEntry[] = [];

    for (const row of results) {
      if (!seenUsers.has(row.user_id)) {
        seenUsers.add(row.user_id);
        deduplicated.push({
          id: row.id,
          userId: row.user_id,
          userName: row.user_name || "DevFest Player",
          userImage: row.user_image,
          gameId: row.game_id,
          score: row.score,
          timeMs: row.time_ms,
          moves: row.moves,
          levelData: row.level_data,
          createdAt: row.created_at,
        });
      }
      if (deduplicated.length >= limit) break;
    }

    return deduplicated.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  } catch (error) {
    console.warn("D1 getGameLeaderboard fallback to memory store:", error);
    const filtered = memoryScores
      .filter((s) => s.game_id === gameId)
      .sort((a, b) => b.score - a.score || a.time_ms - b.time_ms);

    const seen = new Set<string>();
    const entries: LeaderboardEntry[] = [];

    for (const row of filtered) {
      if (!seen.has(row.user_id)) {
        seen.add(row.user_id);
        entries.push({
          id: row.id,
          userId: row.user_id,
          userName: row.userName || "DevFest Player",
          userImage: row.userImage,
          gameId: row.game_id,
          score: row.score,
          timeMs: row.time_ms,
          moves: row.moves,
          levelData: row.level_data,
          createdAt: row.created_at,
          rank: entries.length + 1,
        });
      }
      if (entries.length >= limit) break;
    }

    return entries;
  }
}

/**
 * Get overall leaderboard aggregating max scores from each game per user.
 */
export async function getOverallLeaderboard(limit = 50): Promise<OverallLeaderboardEntry[]> {
  try {
    const db = await getDb();
    await ensureTable(db);
    const { results } = await db
      .prepare(
        `SELECT
           u.id AS user_id,
           COALESCE(u.display_name, u.name, 'DevFest Player') AS user_name,
           u.image AS user_image,
           SUM(best_scores.max_score) AS total_score,
           COUNT(best_scores.game_id) AS games_played,
           MIN(best_scores.min_time) AS fastest_time,
           MAX(best_scores.latest_played) AS last_played
         FROM (
           SELECT user_id, game_id, MAX(score) AS max_score, MIN(time_ms) AS min_time, MAX(created_at) AS latest_played
           FROM game_scores
           GROUP BY user_id, game_id
         ) best_scores
         JOIN users u ON u.id = best_scores.user_id
         GROUP BY u.id, u.name, u.display_name, u.image
         ORDER BY total_score DESC, games_played DESC, fastest_time ASC
         LIMIT ?`,
      )
      .bind(limit)
      .all<{
        user_id: string;
        user_name: string;
        user_image: string | null;
        total_score: number;
        games_played: number;
        fastest_time: number;
        last_played: number;
      }>();

    return results.map((row, index) => ({
      userId: row.user_id,
      userName: row.user_name || "DevFest Player",
      userImage: row.user_image,
      totalScore: Number(row.total_score || 0),
      gamesPlayed: Number(row.games_played || 0),
      fastestTimeMs: Number(row.fastest_time || 0),
      lastPlayedAt: Number(row.last_played || Date.now()),
      rank: index + 1,
    }));
  } catch (error) {
    console.warn("D1 getOverallLeaderboard fallback to memory store:", error);
    const userMap = new Map<
      string,
      {
        userName: string;
        userImage: string | null;
        bestPerGame: Map<string, { score: number; timeMs: number; created: number }>;
      }
    >();

    for (const s of memoryScores) {
      if (!userMap.has(s.user_id)) {
        userMap.set(s.user_id, {
          userName: s.userName,
          userImage: s.userImage,
          bestPerGame: new Map(),
        });
      }
      const data = userMap.get(s.user_id)!;
      const existing = data.bestPerGame.get(s.game_id);
      if (!existing || s.score > existing.score) {
        data.bestPerGame.set(s.game_id, {
          score: s.score,
          timeMs: s.time_ms,
          created: s.created_at,
        });
      }
    }

    const aggregated: OverallLeaderboardEntry[] = [];
    for (const [userId, val] of userMap.entries()) {
      let totalScore = 0;
      let fastestTimeMs = Infinity;
      let lastPlayedAt = 0;
      for (const game of val.bestPerGame.values()) {
        totalScore += game.score;
        if (game.timeMs < fastestTimeMs) fastestTimeMs = game.timeMs;
        if (game.created > lastPlayedAt) lastPlayedAt = game.created;
      }
      aggregated.push({
        userId,
        userName: val.userName,
        userImage: val.userImage,
        totalScore,
        gamesPlayed: val.bestPerGame.size,
        fastestTimeMs: fastestTimeMs === Infinity ? 0 : fastestTimeMs,
        lastPlayedAt,
      });
    }

    return aggregated
      .sort((a, b) => b.totalScore - a.totalScore || b.gamesPlayed - a.gamesPlayed)
      .slice(0, limit)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }
}

/**
 * Get all scores by a specific user across all games.
 */
export async function getUserGameScores(userId: string): Promise<GameScoreRecord[]> {
  try {
    const db = await getDb();
    await ensureTable(db);
    const { results } = await db
      .prepare(
        `SELECT id, user_id, game_id, score, time_ms, moves, level_data, created_at
         FROM game_scores
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(userId)
      .all<GameScoreRecord>();
    return results;
  } catch (error) {
    console.warn("D1 getUserGameScores fallback:", error);
    return memoryScores.filter((s) => s.user_id === userId);
  }
}
