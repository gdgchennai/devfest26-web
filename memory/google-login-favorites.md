---
name: google-login-favorites
description: How Google sign-in, D1 accounts, and saved-session favorites are wired on the devfest26-web site
metadata:
  type: project
---

Added on 2026-08-28 (branch `profiles`): "sign in with Google, save favorite sessions".

- **Auth**: Auth.js v5 (`next-auth@beta`), Google provider, JWT sessions. Config in `auth.ts`; route handler `app/api/auth/[...nextauth]/route.ts`.
- **Storage**: Cloudflare D1 binding `DB` (wrangler.jsonc + `migrations/0001_accounts_and_favorites.sql`). `users` table keyed by our own random `usr_…` id (`lib/id.ts`), never Google's `sub`. `favorites(user_id, session_key)`.
- **Session key**: agenda.json has no ids — `lib/session-key.ts` derives `track@start`.
- **Client**: `components/favorites/FavoritesProvider.tsx` (optimistic toggle, fetches `/api/favorites`), `FavoriteButton.tsx` wired into `AgendaList` + `AgendaBoard` focused card. Providers mounted in `app/layout.tsx`.
- **Pages**: `/signin`, `/profile` (editable display name via server action, shows UID), `/my-agenda`. All three noindex + robots-disallowed + excluded from sitemap (`SiteRoute.noIndex`).
- **Setup still needed by user**: create Google OAuth client; `wrangler d1 create devfest-chennai-2026` + paste `database_id` into wrangler.jsonc + run migrations; set `AUTH_SECRET`/`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (`.env.local` for dev — file created with a generated AUTH_SECRET and blank Google vars; `wrangler secret put` for prod). See `docs/accounts-and-favorites.md`.
- Pre-existing lint errors in `HamburgerMenu.tsx` / `app/page.tsx` (react-hooks/refs) are on `main`, not from this work.
