-- Manual lifecycle keyed by stable agenda IDs. Occupancy survives transitions.
CREATE TABLE hall_sessions (
 session TEXT PRIMARY KEY,
 status TEXT NOT NULL CHECK(status IN ('started','ended')),
 updated_at INTEGER NOT NULL,
 updated_by TEXT NOT NULL
);
