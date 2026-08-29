# Accounts & saved sessions

Sign in with Google → an account in D1 → star sessions on `/agenda` → review
them on `/my-agenda`. Account details live on `/profile`.

## Pieces

| Concern | Where |
| --- | --- |
| Auth.js config (Google, JWT sessions, account upsert) | [`auth.ts`](../auth.ts) |
| Auth.js route handler | `app/api/auth/[...nextauth]/route.ts` |
| D1 handle | [`lib/db.ts`](../lib/db.ts) |
| `users` / `favorites` tables | [`migrations/0001_accounts_and_favorites.sql`](../migrations/0001_accounts_and_favorites.sql) |
| Account read/write | [`lib/users.ts`](../lib/users.ts) |
| Favorites read/write | [`lib/favorites.ts`](../lib/favorites.ts) |
| Favorites REST API | `app/api/favorites/route.ts` |
| Stable session key (agenda.json has no ids) | [`lib/session-key.ts`](../lib/session-key.ts) |
| Client state + optimistic toggle | `components/favorites/FavoritesProvider.tsx` |
| Star button (agenda list + spatial board) | `components/favorites/FavoriteButton.tsx` |
| Pages | `app/signin`, `app/profile`, `app/my-agenda` |

The account `id` is our own opaque `usr_…` handle (see `lib/id.ts`). Google's
`sub` never leaves `users.google_sub`.

## One-time setup

1. **Google OAuth client** — Cloud Console → Credentials → OAuth 2.0 Client ID
   (Web application). Redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://df-dev.gdgchennai.in/api/auth/callback/google`

2. **D1 database**

   ```bash
   npx wrangler d1 create devfest-chennai-2026
   ```

   Paste the printed `database_id` into `wrangler.jsonc` (`d1_databases[0]`),
   then apply migrations:

   ```bash
   npx wrangler d1 migrations apply devfest-chennai-2026 --local
   npx wrangler d1 migrations apply devfest-chennai-2026 --remote
   ```

3. **Secrets**
   - Local: copy `.dev.vars.example` → `.dev.vars`, and mirror the same three
     values into `.env.local` for `npm run dev`.
   - Production:

     ```bash
     npx wrangler secret put AUTH_SECRET
     npx wrangler secret put AUTH_GOOGLE_ID
     npx wrangler secret put AUTH_GOOGLE_SECRET
     ```

## Notes

- Sessions are JWT (cookie) — D1 stores accounts and favorites only.
- `/profile` and `/my-agenda` are `force-dynamic`, `noindex`, disallowed in
  robots, and excluded from the sitemap.
