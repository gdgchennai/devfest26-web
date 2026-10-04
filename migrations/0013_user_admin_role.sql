-- DB-managed admin role, set from the /admin/users portal. ADMIN_EMAILS (env)
-- remains the bootstrap allow-list — it always grants admin regardless of
-- this column, so whoever owns the deploy can never lock themselves out.
-- Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
