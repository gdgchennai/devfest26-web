-- Ticket / check-in data moves to its own table, keyed by buyer email — the
-- one identifier both the ticketing provider (KonfHub) and a Google sign-in
-- share. This decouples it from account creation entirely: the webhook does a
-- plain upsert by email whether or not the person has ever signed in, and the
-- app reads `tickets` by the signed-in user's email.
--
-- Replaces the users.booking_id/payment_id/ticket_url/invoice_url columns
-- (migration 0002) and users.checked_in/check_in_time (0003), which are
-- dropped below.
--
-- Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

CREATE TABLE tickets (
  -- COLLATE NOCASE: the provider and Google may disagree on casing.
  email         TEXT PRIMARY KEY COLLATE NOCASE,
  booking_id    TEXT,
  payment_id    TEXT,
  ticket_url    TEXT,
  invoice_url   TEXT,
  checked_in    INTEGER NOT NULL DEFAULT 0,
  check_in_time INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

ALTER TABLE users DROP COLUMN booking_id;
ALTER TABLE users DROP COLUMN payment_id;
ALTER TABLE users DROP COLUMN ticket_url;
ALTER TABLE users DROP COLUMN invoice_url;
ALTER TABLE users DROP COLUMN checked_in;
ALTER TABLE users DROP COLUMN check_in_time;
