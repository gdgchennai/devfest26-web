-- Per-session live status for the organizer portal (/admin), plus the
-- reverse-lookup index favorites never needed before: "who favorited this
-- session" (for notifying them when it starts/ends).
-- Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

CREATE TABLE IF NOT EXISTS session_status (
  session_key TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('upcoming', 'started', 'ended')),
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_favorites_session ON favorites(session_key);
