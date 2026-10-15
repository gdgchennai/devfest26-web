-- Live Hall Occupancy and Status Tracking
-- Track leads and admins update headcount, occupancy status, and announcements
-- per track/hall, which is displayed on /live in a real-time bento grid.

CREATE TABLE IF NOT EXISTS hall_status (
  track            TEXT PRIMARY KEY,              -- track slug from site.config.ts (e.g. 'd7-auditorium')
  occupancy_status TEXT NOT NULL DEFAULT 'available' CHECK (occupancy_status IN ('available', 'filling_fast', 'houseful')),
  headcount        INTEGER NOT NULL DEFAULT 0 CHECK (headcount >= 0),
  capacity         INTEGER NOT NULL DEFAULT 100 CHECK (capacity > 0),
  announcement     TEXT,                          -- Max 80 characters note
  updated_at       INTEGER NOT NULL,              -- Timestamp in epoch ms
  updated_by       TEXT                           -- users.id of the updater
);

INSERT OR IGNORE INTO hall_status (track, occupancy_status, headcount, capacity, announcement, updated_at, updated_by)
VALUES
  ('d7-auditorium', 'available', 0, 500, NULL, 0, NULL),
  ('d7-amphitheater', 'available', 0, 250, NULL, 0, NULL),
  ('agent-wars', 'available', 0, 100, NULL, 0, NULL),
  ('lightning', 'available', 0, 100, NULL, 0, NULL),
  ('vibe-coding', 'available', 0, 80, NULL, 0, NULL),
  ('raman-hall', 'available', 0, 120, NULL, 0, NULL),
  ('creators-lounge', 'available', 0, 60, NULL, 0, NULL),
  ('meetup-lounge', 'available', 0, 60, NULL, 0, NULL);
