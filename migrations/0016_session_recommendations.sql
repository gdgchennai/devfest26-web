-- Session recommendations curated by event organizers
-- Recommended sessions receive priority placement in the "Find me a session" finder on /live

CREATE TABLE IF NOT EXISTS session_recommendations (
  session_key TEXT PRIMARY KEY,
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT
);
