-- Ticket / payment details, populated by a webhook from the ticketing
-- provider (KonfHub) after a purchase. All nullable — most accounts won't
-- have a ticket. Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

ALTER TABLE users ADD COLUMN booking_id  TEXT;
ALTER TABLE users ADD COLUMN payment_id  TEXT;
ALTER TABLE users ADD COLUMN ticket_url  TEXT;
ALTER TABLE users ADD COLUMN invoice_url TEXT;
