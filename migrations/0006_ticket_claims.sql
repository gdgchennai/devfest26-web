-- Links a user account to a `tickets` row that was booked under a *different*
-- email than the one they sign in with. `tickets` stays keyed by the KonfHub
-- buyer email (so the webhook keeps working); this table is the override the
-- profile page checks first.
--
-- A claim is created via the "enter your booking ID" form after matching
-- `tickets.booking_id` + `tickets.email` (see app/profile/actions.ts). The
-- ticketing Worker deletes the claim if that ticket is later cancelled.
--
-- Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

CREATE TABLE ticket_claims (
  user_id      TEXT PRIMARY KEY,             -- users.id — one claimed ticket per account
  ticket_email TEXT NOT NULL COLLATE NOCASE, -- tickets.email it points at
  booking_id   TEXT NOT NULL,                -- what they entered, for audit
  created_at   INTEGER NOT NULL
);

-- One ticket can be claimed by at most one account.
CREATE UNIQUE INDEX ticket_claims_email ON ticket_claims (ticket_email);
