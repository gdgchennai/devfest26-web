-- Server-side record of each mini-game run (see docs/games.md).
-- The app also creates this lazily (CREATE TABLE IF NOT EXISTS), so this migration
-- is for keeping wrangler-managed databases in step. Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

CREATE TABLE IF NOT EXISTS game_sessions (
  id           TEXT PRIMARY KEY,
  game_id      TEXT NOT NULL,
  config       TEXT NOT NULL,
  state        TEXT NOT NULL,          -- what the server dealt (tiles / card layout / puzzle id / typing text)
  created_at   INTEGER NOT NULL,
  begun_at     INTEGER,                -- server clock; typing sets it on the first keystroke
  hints        INTEGER NOT NULL DEFAULT 0,
  checks       INTEGER NOT NULL DEFAULT 0,
  attempts     INTEGER NOT NULL DEFAULT 0,
  finished_at  INTEGER,
  result       TEXT,                   -- the server-scored GameResult (JSON)
  user_id      TEXT,
  published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_created ON game_sessions(created_at);
