-- The invoice PDF carries the buyer's billing name / address / GST number.
-- We don't surface it in the profile, and don't want it sitting in our DB —
-- drop the column. The ticketing webhook no longer parses "Invoice URL".
--
-- Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

ALTER TABLE tickets DROP COLUMN invoice_url;
