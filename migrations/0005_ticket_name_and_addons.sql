-- Ticketing webhook (workers/ticketing) also stores the ticket name and the
-- add-on bookings, so the cancel decision tree can tell a main-ticket cancel
-- from an add-on cancel.
--
--   ticket_name  the main ticket's name, e.g. "Professional"
--   addons       JSON array: [{"booking_id":"…","ticket_name":"…"}], or NULL
--
-- Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

ALTER TABLE tickets ADD COLUMN ticket_name TEXT;
ALTER TABLE tickets ADD COLUMN addons      TEXT;
