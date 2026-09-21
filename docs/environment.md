# Environment variables

Every configurable value the app reads from the environment. Nothing here is
committed — `.env*` and `.dev.vars*` are git-ignored (`.env.example` and
`.dev.vars.example` are the committed templates).

## Where each one goes

| Context | File | Vars it needs |
| --- | --- | --- |
| `npm run dev` (Next dev server) | `.env.local` | all of them |
| `npm run deploy` / `npm run preview` build step (`next build`) | `.env.local` / `.env.production` / shell env | build-time vars only |
| Cloudflare Workers runtime, local (`npm run preview`) | `.dev.vars` | `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, optional `GEMINI_API_KEY` / `GEMINI_MODEL` |
| Cloudflare Workers runtime, production | `wrangler secret put …` | `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, optional `GEMINI_API_KEY` |
| Git-triggered build (only if Cloudflare Workers Builds is connected) | dashboard → Worker → Settings → Build | `AGENDA_READY`, `HERO_BUTTONS`, optional PostHog overrides |

Full deploy walkthrough: [`deployment.md`](./deployment.md).

## The variables

### `AGENDA_READY`
- **Type:** build-time (re-exposed unprefixed via `next.config.ts` `env` so
  client components can read it too)
- **Used by:** [`lib/routes.ts`](../lib/routes.ts) → gates `/agenda`, `/speakers`,
  `/speakers/[slug]`, the hero "See agenda" CTA, the 404 rescue grid, and the
  `/md/agenda` + `/md/speakers` markdown twins
- **Required:** no. Only `"true"` (exact string) enables the above; unset or any
  other value keeps them returning 404.
- **Example:** `AGENDA_READY=true`

### `HERO_BUTTONS`
- **Type:** build-time (re-exposed unprefixed via `next.config.ts` `env`, same
  as `AGENDA_READY` — the hero CTA row is resolved in `HeroCopy.tsx`, which is
  imported by client components)
- **Used by:** [`components/motion/HeroCopy.tsx`](../components/motion/HeroCopy.tsx)
  → filters the hero CTA row (`CurvedMarqueeHero` + `StaticHero`)
- **Required:** no. Unset → all buttons show. Set to a comma-separated allow-list
  from `tickets,cfp,volunteer,agenda` to trim/pick which appear. Order is fixed
  in code, not taken from the value. `agenda` is additionally gated on
  `AGENDA_READY` — naming it here does nothing while the agenda is off.
- **Example:** `HERO_BUTTONS=tickets,cfp`

### `AUTH_SECRET`
- **Type:** runtime secret
- **Used by:** Auth.js ([`auth.ts`](../auth.ts)) to sign/verify the JWT session
  cookie
- **Required:** yes, for sign-in. Generate with `openssl rand -base64 32`.
  Rotating it logs everyone out.

### `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- **Type:** runtime secret
- **Used by:** the Google provider in [`auth.ts`](../auth.ts)
- **Required:** yes, for sign-in. From Google Cloud Console → APIs & Services →
  Credentials → OAuth 2.0 Client ID (Web application).
- **Authorised redirect URIs to register:**
  - `http://localhost:3000/api/auth/callback/google`
  - `https://devfest.gdgchennai.in/api/auth/callback/google` (prod — match
    `siteConfig.url`)

### `GEMINI_API_KEY` / `GEMINI_MODEL`
- **Type:** runtime secret (`GEMINI_API_KEY`) / runtime variable (`GEMINI_MODEL`)
- **Used by:** [`lib/typing-generator.ts`](../lib/typing-generator.ts), called when a
  typing run starts — asks Gemini for the Speed Typer's paragraph
- **Required:** no. Without a key, or when Gemini errors or times out (3s), the
  game silently uses its built-in word list.
- **`GEMINI_MODEL`:** the model id, defaults to the constant in that file.
  Models get retired and a stale id is just a 404 — the game falls back and
  nobody notices — so check the Worker logs for
  `Gemini paragraph unavailable` if generated text seems to have stopped.
- **Abuse:** starting a run is unauthenticated and the typing text may call
  Gemini. `POST /api/games/session` has a loose flood guard (1500/min per client — the
  venue's wifi puts many attendees behind one IP) and a tighter Gemini budget
  (10 typing texts/min per client; beyond that the local word list is used, not an
  error). Both are best-effort and per Worker isolate. For a hard limit, add a
  Cloudflare rate-limiting rule on `/api/games/session`.

### `NODE_ENV`
- Set automatically by `next dev` / `next build` / Wrangler. Never set it by
  hand. `next.config.ts` branches on it (dev-only `allowedDevOrigins`).

### `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` / `NEXT_PUBLIC_POSTHOG_KEY`
- **Type:** build-time, public (inlined into the client bundle)
- **Used by:** [`instrumentation-client.ts`](../instrumentation-client.ts) —
  `posthog-js` init. Either name works; `PROJECT_TOKEN` is what current
  PostHog Next.js docs use, `KEY` is the older alias.
- **Required:** no. Unset → the committed `siteConfig.analytics.posthogKey`.
  Set this to point a preview/staging build at a different project.
- **Example:** `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_…`

### `NEXT_PUBLIC_POSTHOG_HOST`
- **Type:** build-time, public
- **Used by:** `posthog-js` `api_host`, and `@posthog/nextjs-config` when
  sourcemaps are uploaded
- **Required:** no. Defaults to `https://us.i.posthog.com` (US cloud ingestion).
  EU would be `https://eu.i.posthog.com`. This is the **ingestion** host, not
  `https://us.posthog.com` (the app).

### `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_API_KEY`
- **Type:** build-time secret (never `NEXT_PUBLIC_`)
- **Used by:** [`next.config.ts`](../next.config.ts) `withPostHogConfig` —
  uploads JS sourcemaps to PostHog Error Tracking during `next build`
- **Required:** no. Without it the plugin is skipped and the site still
  captures events; stack traces stay minified. Create a personal API key at
  PostHog → Settings → Personal API keys with error-tracking write access
  (`phx_…`, not the public `phc_…` project token).
- **Not** a Worker runtime secret — `next build` reads it, Wrangler does not.

### `POSTHOG_PROJECT_ID` / `POSTHOG_ENV_ID`
- **Type:** build-time (not secret, but only useful with the personal API key)
- **Used by:** `withPostHogConfig` `projectId` (`ENV_ID` is the older name)
- **Required:** only when uploading sourcemaps. The GDG Chennai project id is
  `593813`.

## Not env vars, but related: Cloudflare bindings

Configured in [`wrangler.jsonc`](../wrangler.jsonc), surfaced on `CloudflareEnv`
(see [`cloudflare-env.d.ts`](../cloudflare-env.d.ts)), read via
`getCloudflareContext()`:

| Binding | What | Set up by |
| --- | --- | --- |
| `DB` | D1 — accounts, favorites, tickets, and `content_documents` (agenda / speakers / archive). Seed content with `npm run content:sync` | `wrangler d1 create devfest-chennai-2026`, then paste `database_id` |
| `ASSETS` | static asset serving | OpenNext default |
| `NEXT_INC_CACHE_R2_BUCKET` | ISR/incremental cache | `wrangler r2 bucket create devfest-chennai-2026-opennext-cache` |
| `IMAGES` | Cloudflare image optimization | OpenNext default |
| `WORKER_SELF_REFERENCE` | self-call for cache ops | OpenNext default |

## Quick start (local dev)

```bash
cp .env.example .env.local
# fill AUTH_SECRET (openssl rand -base64 32) + the two Google values
npm run dev
```

`DB` is required for sign-in, saved sessions, and live content. Marketing
pages fall back to `content/*.json` when D1 is empty (including `next build`).
After applying migrations, run `npm run content:sync` so local/prod D1 match
the JSON files.
