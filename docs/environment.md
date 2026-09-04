# Environment variables

Every configurable value the app reads from the environment. Nothing here is
committed — `.env*` and `.dev.vars*` are git-ignored (`.env.example` and
`.dev.vars.example` are the committed templates).

## Where each one goes

| Context | File | Vars it needs |
| --- | --- | --- |
| `npm run dev` (Next dev server) | `.env.local` | all of them |
| `npm run deploy` / `npm run preview` build step (`next build`) | `.env.local` / `.env.production` / shell env | build-time vars only |
| Cloudflare Workers runtime, local (`npm run preview`) | `.dev.vars` | `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| Cloudflare Workers runtime, production | `wrangler secret put …` | `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| Git-triggered build (only if Cloudflare Workers Builds is connected) | dashboard → Worker → Settings → Build | `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`, `AGENDA_READY`, `HERO_BUTTONS` |

Full deploy walkthrough: [`deployment.md`](./deployment.md).

## The variables

### `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`
- **Type:** build-time, public (inlined into the client bundle)
- **Used by:** [`lib/imagekit-loader.ts`](../lib/imagekit-loader.ts) — the custom
  `next/image` loader used in production, and the preloader warm-up in
  `components/motion/useAssetsLoaded.ts`
- **Required:** production only. Dev serves images straight from `/public` and
  ignores this. If unset in production, images fall back to their raw `/public`
  paths (no resizing/format negotiation).
- **Example:** `https://ik.imagekit.io/gdgchennai`

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

### `NODE_ENV`
- Set automatically by `next dev` / `next build` / Wrangler. Never set it by
  hand. `lib/imagekit-loader.ts`, `next.config.ts`, and
  `components/motion/useAssetsLoaded.ts` branch on it.

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
