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
  attempt_number?: number;
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
  attemptNumber?: number;
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
    // Ensure users table exists first so queries joining on users succeed in local dev & prod
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS users (
          id           TEXT PRIMARY KEY,
          google_sub   TEXT NOT NULL UNIQUE,
          email        TEXT NOT NULL,
          name         TEXT,
          image        TEXT,
          created_at   INTEGER NOT NULL,
          display_name TEXT
        )`,
      )
      .run();

    // Ensure game_scores table exists
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS game_scores (
          id          TEXT PRIMARY KEY,
          user_id     TEXT NOT NULL,
          game_id     TEXT NOT NULL,
          score       INTEGER NOT NULL,
          time_ms     INTEGER NOT NULL,
          moves       INTEGER NOT NULL DEFAULT 0,
          level_data  TEXT,
          created_at  INTEGER NOT NULL
        )`,
      )
      .run();

    // Ensure indices
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_game_scores_lookup ON game_scores(game_id, score DESC, time_ms ASC)`,
      )
      .run()
      .catch(() => {});
    await db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id, game_id)`)
      .run()
      .catch(() => {});
    await db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_game_scores_created ON game_scores(created_at DESC)`)
      .run()
      .catch(() => {});

    // Ensure attempt_number column exists dynamically for backwards-compatibility
    await db
      .prepare(`ALTER TABLE game_scores ADD COLUMN attempt_number INTEGER DEFAULT 1`)
      .run()
      .catch(() => {
        // Safe to ignore if column already exists
      });

    tableEnsured = true;
  } catch (err) {
    console.warn("D1 game_scores table initialization fallback:", err);
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
  let attemptNumber = 1;
  try {
    const db = await getDb();
    await ensureTable(db);
    const countResult = await db
      .prepare(`SELECT COUNT(*) AS count FROM game_scores WHERE user_id = ? AND game_id = ?`)
      .bind(params.userId, params.gameId)
      .first<{ count: number }>();
    if (countResult) {
      attemptNumber = countResult.count + 1;
    }
  } catch {
    attemptNumber = memoryScores.filter(s => s.user_id === params.userId && s.game_id === params.gameId).length + 1;
  }

  const record: GameScoreRecord = {
    id: newScoreId(),
    user_id: params.userId,
    game_id: params.gameId,
    score: Math.max(0, Math.floor(params.score)),
    time_ms: Math.max(0, Math.floor(params.timeMs)),
    moves: Math.max(0, Math.floor(params.moves ?? 0)),
    level_data: params.levelData ?? null,
    created_at: Date.now(),
    attempt_number: attemptNumber,
  };

  try {
    const db = await getDb();
    await ensureTable(db);
    await db
      .prepare(
        `INSERT INTO game_scores (id, user_id, game_id, score, time_ms, moves, level_data, created_at, attempt_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        record.attempt_number,
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
 * Returns the best attempt per user directly via SQLite Window Functions.
 */
export async function getGameLeaderboard(gameId: string, limit = 50): Promise<LeaderboardEntry[]> {
  try {
    const db = await getDb();
    await ensureTable(db);
    // Fetch best score per user for this game using D1 window functions
    const { results } = await db
      .prepare(
        `SELECT
           best_attempts.id,
           best_attempts.user_id,
           best_attempts.game_id,
           best_attempts.score,
           best_attempts.time_ms,
           best_attempts.moves,
           best_attempts.level_data,
           best_attempts.created_at,
           best_attempts.attempt_number,
           COALESCE(u.display_name, u.name, 'DevFest Player') AS user_name,
           u.image AS user_image
         FROM (
           SELECT 
             id,
             user_id,
             game_id,
             score,
             time_ms,
             moves,
             level_data,
             created_at,
             attempt_number,
             ROW_NUMBER() OVER (
               PARTITION BY user_id 
               ORDER BY score DESC, time_ms ASC, created_at ASC
             ) as rn
           FROM game_scores
           WHERE game_id = ?
         ) best_attempts
         LEFT JOIN users u ON u.id = best_attempts.user_id
         WHERE best_attempts.rn = 1
         ORDER BY best_attempts.score DESC, best_attempts.time_ms ASC, best_attempts.created_at ASC
         LIMIT ?`,
      )
      .bind(gameId, limit)
      .all<{
        id: string;
        user_id: string;
        game_id: string;
        score: number;
        time_ms: number;
        moves: number;
        level_data: string | null;
        created_at: number;
        attempt_number: number | null;
        user_name: string;
        user_image: string | null;
      }>();

    return results.map((row, index) => ({
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
      attemptNumber: row.attempt_number || 1,
      rank: index + 1,
    }));
  } catch (error) {
    console.warn("D1 getGameLeaderboard fallback to memory store:", error);
    const filtered = memoryScores
      .filter((s) => s.game_id === gameId)
      .sort((a, b) => b.score - a.score || a.time_ms - b.time_ms || a.created_at - b.created_at);

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
          attemptNumber: row.attempt_number || 1,
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
    // Fetch aggregated best score per user per game cleanly using nested D1 window functions
    const { results } = await db
      .prepare(
        `SELECT
           u.id AS user_id,
           COALESCE(u.display_name, u.name, 'DevFest Player') AS user_name,
           u.image AS user_image,
           SUM(best_scores.score) AS total_score,
           COUNT(best_scores.game_id) AS games_played,
           MIN(best_scores.time_ms) AS fastest_time,
           MAX(best_scores.created_at) AS last_played
         FROM (
           SELECT user_id, game_id, score, time_ms, created_at
           FROM (
             SELECT 
               user_id, 
               game_id, 
               score, 
               time_ms, 
               created_at,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, game_id 
                 ORDER BY score DESC, time_ms ASC, created_at ASC
               ) as rn
             FROM game_scores
           )
           WHERE rn = 1
         ) best_scores
         LEFT JOIN users u ON u.id = best_scores.user_id
         GROUP BY best_scores.user_id, u.name, u.display_name, u.image
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
      if (!existing || s.score > existing.score || (s.score === existing.score && s.time_ms < existing.timeMs)) {
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
        `SELECT id, user_id, game_id, score, time_ms, moves, level_data, created_at, attempt_number
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
