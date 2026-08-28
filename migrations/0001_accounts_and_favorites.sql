-- Accounts and saved sessions for the "sign in with Google, save your agenda"
-- feature. Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

-- One row per person who has ever signed in. `id` is our own opaque handle
-- (see lib/id.ts) — never Google's `sub`, which stays internal to `google_sub`
-- and is only used to match a returning login back to their row.
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  google_sub   TEXT NOT NULL UNIQUE,
  email        TEXT,
  name         TEXT,
  image        TEXT,
  -- Optional user-chosen name shown on the profile; falls back to `name`.
  display_name TEXT,
  created_at   INTEGER NOT NULL
);

-- One row per (user, session) the user has starred. `session_key` is the
-- stable key derived in lib/session-key.ts from an agenda entry's track +
-- start time (agenda.json has no ids of its own).
CREATE TABLE favorites (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, session_key)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
