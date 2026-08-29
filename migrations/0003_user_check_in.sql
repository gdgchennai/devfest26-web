-- On-site check-in state, set when the attendee is scanned in at the venue.
-- `checked_in` is 0/1 (SQLite has no boolean); `check_in_time` is unix epoch
-- milliseconds (same convention as users.created_at), null until checked in.
-- Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

ALTER TABLE users ADD COLUMN checked_in    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN check_in_time INTEGER;
