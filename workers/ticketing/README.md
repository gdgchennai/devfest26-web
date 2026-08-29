# devfest-ticketing Worker

A standalone Cloudflare Worker that lives in this repo but is **not** part of
the Next.js site. It is never bundled into the app build (nothing under `app/`
imports it; the root `tsconfig.json` and `eslint.config.mjs` exclude
`workers/`). It deploys on its own.

## What it does

Writes the ticketing / check-in columns on the `users` table in the **same
D1 database** the site reads:

| Column | Migration |
| --- | --- |
| `booking_id`, `payment_id`, `ticket_url`, `invoice_url` | `../../migrations/0002_user_ticket_fields.sql` |
| `checked_in`, `check_in_time` | `../../migrations/0003_user_check_in.sql` |

The app only reads these (`../../lib/users.ts`). This Worker is the writer —
fed by the ticketing provider's webhooks and the on-site check-in flow.

Migrations stay owned by the app's `wrangler.jsonc` + `../../migrations/`.
This Worker's `wrangler.jsonc` only *binds* the DB.

## Commands

Run from the repo root (they point Wrangler at this folder's config):

```bash
npm run worker:ticketing:dev      # local dev server
npm run worker:ticketing:deploy   # deploy
npm run worker:ticketing:types    # regenerate worker-configuration.d.ts
```

## Secrets

```bash
npx wrangler secret put KONFHUB_WEBHOOK_SECRET -c workers/ticketing/wrangler.jsonc
```

## Status

Scaffold only — `src/index.ts` returns 501.
