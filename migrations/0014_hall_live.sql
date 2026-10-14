-- One global revision makes snapshots, order edits and publication replay unambiguous.
CREATE TABLE hall_meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0, clock INTEGER);
INSERT INTO hall_meta(id) VALUES(1);
CREATE TABLE hall_occupancy (
 zone TEXT PRIMARY KEY, occupied INTEGER NOT NULL CHECK(typeof(occupied)='integer' AND occupied BETWEEN 0 AND 100),
 revision INTEGER NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL
);
CREATE TABLE hall_leads (user_id TEXT NOT NULL, zone TEXT NOT NULL, PRIMARY KEY(user_id,zone));
CREATE TABLE hall_promotions (session TEXT PRIMARY KEY, recommended INTEGER NOT NULL CHECK(recommended IN(0,1)), position INTEGER UNIQUE CHECK(position IS NULL OR position>=0));
CREATE TABLE hall_audit (revision INTEGER PRIMARY KEY, actor TEXT NOT NULL, changed_at INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE hall_outbox (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
-- Deliberately constraint-fails a batch on a stale global revision; D1 rolls back all statements.
CREATE TABLE hall_write_guard (value INTEGER NOT NULL CHECK(value=1));
