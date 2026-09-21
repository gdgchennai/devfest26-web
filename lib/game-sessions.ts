import "server-only";
import { getDb } from "@/lib/db";
import type { GameId, GameResult } from "@/lib/game-rules";

/**
 * Server-side record of one game run.
 *
 * A row is created when a run starts and holds everything the server needs to
 * judge it later — the layout it dealt, when the run began by ITS clock, how many
 * crossword hints/checks were spent — so none of that has to be trusted from the
 * browser. `finish` moves it to a scored result exactly once; `publish` then
 * binds that result to a signed-in user exactly once. Both are single atomic
 * UPDATEs guarded by their own "not yet" condition, which is what makes replaying
 * a request useless.
 *
 * D1 in production. Without a `DB` binding, LOCAL DEV ONLY falls back to an
 * in-memory map. In production a D1 problem is thrown, not papered over: a
 * per-isolate map would let a run start on one Worker and be "unknown" on the next.
 */

export type GameSession = {
  id: string;
  gameId: GameId;
  config: Record<string, unknown>;
  /** What the server dealt: tiles, card layout, puzzle id, or the typing text. */
  state: Record<string, unknown>;
  createdAt: number;
  /** When play began (server clock). Typing sets it on the first keystroke. */
  begunAt: number | null;
  hints: number;
  checks: number;
  /** Failed finish attempts (crossword sends the grid to find out if it's right). */
  attempts: number;
  finishedAt: number | null;
  result: GameResult | null;
  /** Set when a signed-in user publishes the result. */
  userId: string | null;
  publishedAt: number | null;
};

type Row = {
  id: string;
  game_id: string;
  config: string;
  state: string;
  created_at: number;
  begun_at: number | null;
  hints: number;
  checks: number;
  attempts: number;
  finished_at: number | null;
  result: string | null;
  user_id: string | null;
  published_at: number | null;
};

const fromRow = (r: Row): GameSession => ({
  id: r.id,
  gameId: r.game_id as GameId,
  config: JSON.parse(r.config),
  state: JSON.parse(r.state),
  createdAt: r.created_at,
  begunAt: r.begun_at,
  hints: r.hints,
  checks: r.checks,
  attempts: r.attempts,
  finishedAt: r.finished_at,
  result: r.result ? (JSON.parse(r.result) as GameResult) : null,
  userId: r.user_id,
  publishedAt: r.published_at,
});

/** Unfinished runs and unpublished results are dropped after this. */
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const memory = new Map<string, GameSession>();

async function db(): Promise<D1Database | null> {
  try {
    const d1 = await getDb();
    await ensureTable(d1);
    return d1;
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return null;
  }
}

let ensured = false;
async function ensureTable(d1: D1Database): Promise<void> {
  if (ensured) return;
  await d1
    .prepare(
      `CREATE TABLE IF NOT EXISTS game_sessions (
        id           TEXT PRIMARY KEY,
        game_id      TEXT NOT NULL,
        config       TEXT NOT NULL,
        state        TEXT NOT NULL,
        created_at   INTEGER NOT NULL,
        begun_at     INTEGER,
        hints        INTEGER NOT NULL DEFAULT 0,
        checks       INTEGER NOT NULL DEFAULT 0,
        attempts     INTEGER NOT NULL DEFAULT 0,
        finished_at  INTEGER,
        result       TEXT,
        user_id      TEXT,
        published_at INTEGER
      )`,
    )
    .run();
  await d1.prepare(`CREATE INDEX IF NOT EXISTS idx_game_sessions_created ON game_sessions(created_at)`).run().catch(() => {});
  ensured = true;
}

export async function createSession(
  s: Pick<GameSession, "id" | "gameId" | "config" | "state" | "begunAt">,
  now = Date.now(),
): Promise<void> {
  const d1 = await db();
  if (!d1) {
    for (const [id, v] of memory) if (now - v.createdAt > RETENTION_MS) memory.delete(id);
    memory.set(s.id, { ...s, createdAt: now, hints: 0, checks: 0, attempts: 0, finishedAt: null, result: null, userId: null, publishedAt: null });
    return;
  }
  // Cheap housekeeping on the write path: no cron needed for a table this small.
  if (Math.random() < 0.05) {
    await d1.prepare(`DELETE FROM game_sessions WHERE created_at < ?`).bind(now - RETENTION_MS).run().catch(() => {});
  }
  await d1
    .prepare(`INSERT INTO game_sessions (id, game_id, config, state, created_at, begun_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(s.id, s.gameId, JSON.stringify(s.config), JSON.stringify(s.state), now, s.begunAt)
    .run();
}

export async function getSession(id: string): Promise<GameSession | null> {
  const d1 = await db();
  if (!d1) return memory.get(id) ?? null;
  const row = await d1.prepare(`SELECT * FROM game_sessions WHERE id = ?`).bind(id).first<Row>();
  return row ? fromRow(row) : null;
}

const changed = (r: D1Result) => (r.meta?.changes ?? 0) > 0;

/** Sets `begun_at` once (typing: first keystroke). False if it was already set. */
export async function markBegun(id: string, now = Date.now()): Promise<boolean> {
  const d1 = await db();
  if (!d1) {
    const s = memory.get(id);
    if (!s || s.begunAt !== null) return false;
    s.begunAt = now;
    return true;
  }
  return changed(await d1.prepare(`UPDATE game_sessions SET begun_at = ? WHERE id = ? AND begun_at IS NULL AND finished_at IS NULL`).bind(now, id).run());
}

/** Spends one unit of a per-session counter, refusing past `cap`. Returns the new total, or null at the cap. */
export async function spend(id: string, counter: "hints" | "checks" | "attempts", cap: number): Promise<number | null> {
  const d1 = await db();
  if (!d1) {
    const s = memory.get(id);
    if (!s || s.finishedAt !== null || s[counter] >= cap) return null;
    return ++s[counter];
  }
  // `counter` is one of three literals (typed above), never user input.
  const ok = changed(
    await d1.prepare(`UPDATE game_sessions SET ${counter} = ${counter} + 1 WHERE id = ? AND finished_at IS NULL AND ${counter} < ?`).bind(id, cap).run(),
  );
  if (!ok) return null;
  const row = await d1.prepare(`SELECT ${counter} AS n FROM game_sessions WHERE id = ?`).bind(id).first<{ n: number }>();
  return row?.n ?? null;
}

/** Records the scored result — once. False if the run was already finished. */
export async function finishSession(id: string, result: GameResult, now = Date.now()): Promise<boolean> {
  const d1 = await db();
  if (!d1) {
    const s = memory.get(id);
    if (!s || s.finishedAt !== null) return false;
    s.finishedAt = now;
    s.result = result;
    return true;
  }
  return changed(
    await d1.prepare(`UPDATE game_sessions SET finished_at = ?, result = ? WHERE id = ? AND finished_at IS NULL`).bind(now, JSON.stringify(result), id).run(),
  );
}

/**
 * Claims a finished result for `userId` — once. Returns the result to write to the
 * leaderboard, or the reason it can't be claimed. Calling again as the same user
 * reports `already_published` rather than double-counting.
 */
export async function claimForUser(
  id: string,
  userId: string,
  now = Date.now(),
): Promise<{ ok: true; result: GameResult } | { ok: false; reason: "unknown_session" | "not_finished" | "already_published" }> {
  const s = await getSession(id);
  if (!s) return { ok: false, reason: "unknown_session" };
  if (!s.result || s.finishedAt === null) return { ok: false, reason: "not_finished" };
  if (s.publishedAt !== null) return { ok: false, reason: "already_published" };

  const d1 = await db();
  if (!d1) {
    const m = memory.get(id)!;
    m.userId = userId;
    m.publishedAt = now;
    return { ok: true, result: s.result };
  }
  const won = changed(
    await d1
      .prepare(`UPDATE game_sessions SET user_id = ?, published_at = ? WHERE id = ? AND finished_at IS NOT NULL AND published_at IS NULL`)
      .bind(userId, now, id)
      .run(),
  );
  return won ? { ok: true, result: s.result } : { ok: false, reason: "already_published" };
}

/** Undo a claim when writing the score failed, so the player can retry. */
export async function releaseClaim(id: string): Promise<void> {
  const d1 = await db();
  if (!d1) {
    const m = memory.get(id);
    if (m) {
      m.userId = null;
      m.publishedAt = null;
    }
    return;
  }
  await d1.prepare(`UPDATE game_sessions SET user_id = NULL, published_at = NULL WHERE id = ?`).bind(id).run().catch(() => {});
}
