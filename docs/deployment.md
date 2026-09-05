# Deployment

How the site and its companion Worker get onto Cloudflare, what infrastructure
they need, and where every secret and environment variable lives.

- Env-var reference (types, which file, examples): [`environment.md`](./environment.md)
- Accounts / Google sign-in internals: [`accounts-and-favorites.md`](./accounts-and-favorites.md)
- Ticketing Worker behaviour: [`../workers/ticketing/README.md`](../workers/ticketing/README.md)

There is **no CI**. Deployment is `npm run deploy` from a machine with the
Wrangler CLI logged in to the Cloudflare account.

---

## Architecture

```
                    ┌─────────────────────────────────────────────┐
   devfest.         │  Worker: devfest-chennai-2026               │
   gdgchennai.in ──▶│  (Next.js via @opennextjs/cloudflare)       │
   (custom domain)  │                                             │
                    │  bindings:                                  │
                    │   DB           → D1  devfest-chennai-2026 ──┐│
                    │   NEXT_INC_...  → R2  ...-opennext-cache     ││
                    │   ASSETS        → static assets             ││
                    │   IMAGES        → Cloudflare image resizing ││
                    │   WORKER_SELF_REFERENCE → itself (cache ops) ││
                    └─────────────────────────────────────────────┘│
                                                                   │  shared
   KonfHub  ─POST─▶ ┌─────────────────────────────────────────────┐│  D1
   (webhook,        │  Worker: devfest-ticketing                  ││
    no auth)        │  (standalone, workers/ticketing/)           ││
                    │                                             ││
                    │  bindings:  DB → same D1 ───────────────────┘│
                    │  secret:    WEBHOOK_PATH (the only auth)     │
                    └─────────────────────────────────────────────┘
```

### Two Workers, one repo, one database

| | **`devfest-chennai-2026`** (the site) | **`devfest-ticketing`** |
|---|---|---|
| Source | `app/`, `components/`, `lib/`, … | `workers/ticketing/` only |
| Config | `wrangler.jsonc` (root) | `workers/ticketing/wrangler.jsonc` |
| Build | `opennextjs-cloudflare build` (runs `next build`) | none — Wrangler bundles `src/index.ts` |
| Deploy | `npm run deploy` | `npm run worker:ticketing:deploy` |
| URL | `devfest.gdgchennai.in` (custom domain) | `devfest-ticketing.<subdomain>.workers.dev` |
| Owns in D1 | `users`, `favorites`, `ticket_claims`, migrations | writes to `tickets` (app only reads it) |

The ticketing Worker is **not bundled into the site** — nothing under `app/`
imports it, and the root `tsconfig.json` / `eslint.config.mjs` exclude
`workers/`. It shares only the repo and the D1 database. Deploy them
independently; a site deploy never touches the ticketing Worker and vice versa.

**Migrations are owned by the site's `wrangler.jsonc`** (`migrations_dir:
"migrations"`). The ticketing Worker's config binds the same DB but declares no
`migrations_dir`, so `wrangler d1 migrations apply` is always run against the
root config. `migrations/0004_tickets_table.sql` creates the table the
ticketing Worker writes to.

---

## Prerequisites

- A Cloudflare account with Workers, D1 and R2 enabled (the Workers Paid plan is
  the safe choice for production traffic and cache writes).
- The `gdgchennai.in` zone on that account (for the custom domain route and the
  `/about` + `/privacy` rewrite rules).
- Node 20+, and the repo installed: `npm install`.
- Wrangler logged in:

  ```bash
  npx wrangler login
  npx wrangler whoami   # confirm the right account
  ```

- A Google Cloud project for the OAuth client (see [Google auth](#google-auth-setup)).
- An ImageKit account/endpoint for production image resizing (optional but
  recommended — without it images fall back to raw `/public` paths).

---

## One-time infrastructure setup

### 1. D1 database

```bash
npx wrangler d1 create devfest-chennai-2026
```

Paste the printed `database_id` into **`wrangler.jsonc`** `d1_databases[0]` and
into **`workers/ticketing/wrangler.jsonc`** `d1_databases[0]` (both must match).
Then apply migrations:

```bash
npx wrangler d1 migrations apply devfest-chennai-2026 --local     # local dev D1
npx wrangler d1 migrations apply devfest-chennai-2026 --remote    # production D1
```

Re-run the `--remote` command after every new file in `migrations/`.

Then seed public content (agenda, speakers, archive photos) from `content/*.json`:

```bash
npm run content:sync            # local D1 used by `npm run dev`
npm run content:sync -- --remote
```

Edit the JSON by hand (or `npm run archive` for photos), then sync again. Pages
read D1 through `lib/content.ts` with a 5-minute ISR window (`revalidate = 300`);
clients can also hit `GET /api/content` and `GET /api/content/{agenda|speakers|archive}`.
`next build` falls back to the JSON files when D1 is empty or unbound.

Images stay in `public/` (and ImageKit in production). The Worker cache headers
in `public/_headers` mark `/archive`, `/banner`, `/fonts`, and `/brand-shapes`
immutable so the edge keeps them.

### 2. R2 bucket (ISR / incremental cache)

```bash
npx wrangler r2 bucket create devfest-chennai-2026-opennext-cache
```

Name must match `wrangler.jsonc` → `r2_buckets[0].bucket_name`. This backs
Next's incremental cache and `revalidateTag`; `open-next.config.ts` wires it via
`r2IncrementalCache`.

### 3. Custom domain

`wrangler.jsonc` already declares:

```jsonc
"routes": [{ "pattern": "devfest.gdgchennai.in", "custom_domain": true }]
```

Keeping this line in the config is what stops each `wrangler deploy` from
detaching the domain (it was first attached via the dashboard). The
`gdgchennai.in` zone must be on the same Cloudflare account. `IMAGES`,
`ASSETS`, and `WORKER_SELF_REFERENCE` are OpenNext defaults and need no manual
setup beyond being present in `wrangler.jsonc`.

> **`/about` and `/privacy`** are served by a **Cloudflare rewrite rule**, not
> by this Worker or the Next app — configure those in the dashboard
> (Rules → Transform/Redirect) against the `gdgchennai.in` zone. The app links
> them as absolute URLs and keeps them out of `lib/routes.ts`.

### 4. Google OAuth client

See [Google auth setup](#google-auth-setup) below.

---

## Environment & secrets

Three categories, three homes. Full table in [`environment.md`](./environment.md).

### Build-time variables

Read during `next build` (invoked by `opennextjs-cloudflare build`). Inlined
into the bundle — **changing one requires a rebuild + redeploy**.

| Var | Purpose | Required |
|---|---|---|
| `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` | Production `next/image` loader endpoint | prod only |
| `AGENDA_READY` | `"true"` brings `/agenda` + `/speakers` + `/md` twins online | no (default off) |
| `HERO_BUTTONS` | comma-separated allow-list `tickets,cfp,volunteer,agenda` for the hero CTA row | no (default: all) |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` / `NEXT_PUBLIC_POSTHOG_KEY` | Override the committed PostHog project token | no (defaults to `siteConfig.analytics.posthogKey`) |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog ingestion host | no (defaults to `https://us.i.posthog.com`) |
| `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_API_KEY` | Personal API key (`phx_…`) so `@posthog/nextjs-config` can upload error-tracking sourcemaps | no (plugin skipped if unset) |
| `POSTHOG_PROJECT_ID` / `POSTHOG_ENV_ID` | Numeric PostHog project id for sourcemap upload | with the personal API key |

`AGENDA_READY` / `HERO_BUTTONS` are re-exposed unprefixed via `next.config.ts`
`env` because client components read them.

**Where they come from at deploy time:** `next build` loads `.env.production`
and `.env.local` (both git-ignored; `.env.local` and the shell environment win
over `.env.production`). For a manual `npm run deploy` from a laptop, put them
in `.env.local` or export them in the shell first:

```bash
AGENDA_READY=true HERO_BUTTONS=tickets,cfp npm run deploy
```

If you later connect the repo to **Cloudflare Workers Builds** (git-triggered
deploys), these instead go in the Cloudflare dashboard → the Worker → Settings →
*Build* → environment variables, and `npm run deploy` is no longer run by hand.

### Runtime secrets — site Worker

Read at request time by Auth.js (`auth.ts`). **Not** in `wrangler.jsonc` or any
`.env` file that ships.

| Secret | Generate / source |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` (rotating logs everyone out) |
| `AUTH_GOOGLE_ID` | Google Cloud Console OAuth 2.0 Client ID |
| `AUTH_GOOGLE_SECRET` | …its client secret |

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put AUTH_GOOGLE_ID
npx wrangler secret put AUTH_GOOGLE_SECRET
```

Local dev: the Next dev server (`npm run dev`) reads these from `.env.local`;
the Workers preview runtime (`npm run preview`) reads them from `.dev.vars`.
Keep the two files in sync. Templates: `.env.example`, `.dev.vars.example`.

### Runtime secret — ticketing Worker

| Secret | Notes |
|---|---|
| `WEBHOOK_PATH` | The path segment KonfHub POSTs to — **the entire access-control model**. Unset ⇒ the Worker 404s every request. Use a long random string: `openssl rand -hex 16`. |

```bash
npx wrangler secret put WEBHOOK_PATH -c workers/ticketing/wrangler.jsonc
```

Local dev reads it from `workers/ticketing/.dev.vars` (template sets it to
`webhook`).

---

## Deploying

### Site

```bash
npm run deploy
```

This runs `opennextjs-cloudflare build` (which runs `next build`) then
`opennextjs-cloudflare deploy`. First deploy checklist:

1. D1 created, `database_id` pasted into `wrangler.jsonc`, migrations applied `--remote`, then `npm run content:sync -- --remote`.
2. R2 bucket created.
3. `wrangler secret put` for the three `AUTH_*` values.
4. Build-time vars available (see above).
5. `npm run deploy`.
6. Add the two prod redirect URIs to the Google OAuth client (below).

Variants: `npm run preview` (build + run locally on the Workers runtime),
`npm run upload` (build + upload a version without promoting it to production).

### Ticketing Worker

```bash
npm run worker:ticketing:deploy
```

First deploy: create/confirm the shared D1 and its `database_id` in
`workers/ticketing/wrangler.jsonc`, `wrangler secret put WEBHOOK_PATH -c …`,
then deploy. Give KonfHub the webhook URL:

```
https://devfest-ticketing.<your-subdomain>.workers.dev/<WEBHOOK_PATH>
```

KonfHub retries only on `429/500/502/503/504`. The Worker returns `500` on a
real internal failure, `200` for processed-or-safely-skipped, `4xx` for a
structurally bad request. Check delivery with:

```bash
npx wrangler tail devfest-ticketing
```

### Database migrations

Adding a migration file ⇒ apply it to both environments:

```bash
npx wrangler d1 migrations apply devfest-chennai-2026 --local
npx wrangler d1 migrations apply devfest-chennai-2026 --remote
```

Always from the repo root (the ticketing config has no `migrations_dir`).

### Regenerating binding types (after editing either `wrangler.jsonc`)

```bash
npm run cf-typegen                 # site → cloudflare-env.d.ts
npm run worker:ticketing:types     # worker → workers/ticketing/worker-configuration.d.ts
```

---

## Google auth setup

Auth.js (NextAuth v5), Google provider only, JWT sessions (nothing session-side
in D1 — only the `users` row). `trustHost: true` because Cloudflare isn't a host
Auth.js auto-detects.

1. **Google Cloud Console** → *APIs & Services* → *Credentials* →
   *Create credentials* → *OAuth client ID* → **Web application**.
2. **Authorised redirect URIs** — add every origin the app runs on:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://devfest.gdgchennai.in/api/auth/callback/google` (production)
   - any staging origin you use, same `/api/auth/callback/google` path
3. **Scopes:** the provider default only — `openid`, `profile`, `email`. All
   non-sensitive, so the OAuth consent screen does not need Google verification
   to serve unlimited users once it's set to *In production* (Testing mode caps
   at 100 users).
4. Copy the **Client ID** → `AUTH_GOOGLE_ID`, **Client secret** →
   `AUTH_GOOGLE_SECRET`. Set them as Worker secrets (above) and in
   `.env.local` / `.dev.vars` for local work.
5. Generate `AUTH_SECRET` (`openssl rand -base64 32`) — independent of Google.

The redirect flow only ever lands same-origin (`auth.ts` `redirect` callback +
`lib/safe-redirect.ts`), so there's nothing per-environment to configure beyond
the URI list.

---

## Post-deploy verification

- `https://devfest.gdgchennai.in` loads; hero renders.
- `/tickets`, `/memories`, `/contact` load. `/agenda` + `/speakers` behave per
  `AGENDA_READY`.
- Sign in with Google from `/signin` → lands back signed in → `/profile` shows
  the account. (Exercises `AUTH_*` secrets + D1 + the redirect URI list.)
- Star a session on `/agenda`, confirm it on `/my-agenda` (D1 `favorites`).
- `curl -X POST https://devfest-ticketing.<subdomain>.workers.dev/<WEBHOOK_PATH>`
  with `--data @workers/ticketing/samples/registration.json` → `200`; the row
  appears on `/profile` for the matching email. A wrong path → `404`.
- Image URLs point at the ImageKit endpoint (prod) not `/public`.

---

## Operations

| Task | Command |
|---|---|
| Tail site logs | `npx wrangler tail devfest-chennai-2026` |
| Tail ticketing logs | `npx wrangler tail devfest-ticketing` |
| Roll back the site | `npx wrangler rollback` (or `npx wrangler versions deploy` to pick one) |
| Query prod D1 | `npx wrangler d1 execute devfest-chennai-2026 --remote --command "SELECT …"` |
| List secrets (site) | `npx wrangler secret list` |
| List secrets (ticketing) | `npx wrangler secret list -c workers/ticketing/wrangler.jsonc` |
| Rotate a secret | `npx wrangler secret put <NAME>` again (rotating `AUTH_SECRET` logs everyone out) |

### Local, both Workers at once — don't

`npm run worker:ticketing:dev` shares the app's local D1 via
`--persist-to .wrangler/state`, and Miniflare can't run two instances against
one state dir. **Stop `npm run dev` before starting the ticketing dev server.**
If `lib/db.ts` starts throwing `Attempted to use poisoned stub`, that's the
collision — restart `npm run dev`.
