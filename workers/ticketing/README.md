# devfest-ticketing Worker

A standalone Cloudflare Worker in this repo but **not** part of the Next.js
site — own `wrangler.jsonc`, own deploy, never bundled into the app (nothing
under `app/` imports it; the root `tsconfig.json` + `eslint.config.mjs`
exclude `workers/`).

## What it does

KonfHub posts every attendee event to **one URL** with **no authentication**.
The Worker parses the payload (`src/konfhub.ts`) and applies it to the
`tickets` table in the shared D1 database (`src/store.ts`). The app only reads
that table (`../../lib/tickets.ts`).

| `Event Type` | Effect on the `tickets` row (keyed by attendee email) |
| --- | --- |
| `registration` (main) | Write `booking_id`, `payment_id`, `ticket_url` (only if `https://`), `ticket_name`, `addons`. Keeps check-in state and merges existing add-ons. If a *different* booking is already stored, leaves it (KonfHub won't sell a 2nd live ticket per attendee). |
| `registration` (add-on) | Payload carries `Parent Booking Id`. Never touches the main row's `booking_id` / `ticket_url` / `ticket_name` — upserts `{ booking_id, ticket_name, attachment_link }` into the `addons` array by booking id. Stashes a bare row if the add-on webhook beats the main registration. |
| `cancel` | `booking_id` matches the stored main booking → delete the whole row (and any `ticket_claims` pointing at it). Else ticket name matches → no-op (hand-mapped). Else the id is a stored add-on → drop that add-on only. Else no-op. |
| `check_in` | `checked_in = 1`, `check_in_time` from the payload's `CheckIn Time` (UTC). Creates a bare row if the attendee was never registered with us. |
| `check_out` | `checked_in = 0`, `check_in_time = NULL`. |

### Access control

There is none beyond the URL. It lives on the `workers.dev` subdomain at the
path segment in the `WEBHOOK_PATH` secret; every other path 404s — and if the
secret is unset, **every** request 404s. Set a long random value in
production:

```bash
npx wrangler secret put WEBHOOK_PATH -c workers/ticketing/wrangler.jsonc
```

KonfHub's webhook URL is then
`https://devfest-ticketing.<subdomain>.workers.dev/<WEBHOOK_PATH>`.

### Response codes

KonfHub retries 3× on `429/500/502/503/504` only. So: `500` on a genuine
internal failure (to get the retry), `200` for processed *or* safely-skipped
events, `4xx` for a structurally bad request.

## Commands (from repo root)

```bash
npm run worker:ticketing:dev      # local dev server
npm run worker:ticketing:deploy   # deploy
npm run worker:ticketing:types    # regenerate worker-configuration.d.ts
npm run worker:ticketing:check    # tsc -p workers/ticketing/tsconfig.json
```

## Local testing

> **Run only one Miniflare at a time.** `npm run worker:ticketing:dev` shares
> the app's local D1 (`--persist-to .wrangler/state`), and Miniflare doesn't
> support two live instances on one state dir. **Stop `npm run dev` first.**
> If the Next dev server starts throwing `Attempted to use poisoned stub` from
> `lib/db.ts`, that's this — restart `npm run dev`.

Copy `.dev.vars.example` → `.dev.vars` first (`WEBHOOK_PATH` is required — the
example sets it to `webhook`). `samples/` holds one payload per event type
(plus `registration_addon.json` — an add-on's own registration webhook):

```bash
curl -X POST http://localhost:8787/webhook \
  -H 'content-type: application/json' \
  --data @workers/ticketing/samples/registration.json
```

The dev server uses the same local D1 as `npm run dev`, so the row shows up on
`/profile` when signed in as the matching email.
