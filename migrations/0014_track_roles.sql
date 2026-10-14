-- Track-scoped admin roles. Replaces users.is_admin (migration 0013) as the
-- way a DB-granted organizer gets access: every grant now names a track.
--
--   admin       manages that track's sessions, and can grant admin / track_lead
--               on that track to others
--   track_lead  marks that track's sessions started/ended, nothing else
--
-- ADMIN_EMAILS (env) stays the super admin and is not stored here. The old
-- users.is_admin column is left in place but no longer read — existing
-- DB-granted admins must be re-granted a track from /admin/users.
--
-- Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

CREATE TABLE user_track_roles (
  user_id    TEXT NOT NULL,                    -- users.id
  track      TEXT NOT NULL,                    -- a site.config track slug
  role       TEXT NOT NULL CHECK (role IN ('admin', 'track_lead')),
  granted_by TEXT,                             -- users.id of the granter; NULL = super admin
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, track)
);
