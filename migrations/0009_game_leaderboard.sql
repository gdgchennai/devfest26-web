-- Game scores and leaderboard submissions for the /games page.
-- Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

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
