# `/event-agenda` — the lightweight event-day agenda

One small HTML document for weak venue wifi and mobile data. Same schedule as
`/agenda`'s simple list (per-track tabs, no "All"; lunch, breaks and check-in
shown, without a star), but none of the site's JS.

## Why a route handler

[`app/event-agenda/route.ts`](../app/event-agenda/route.ts) returns a plain
`Response` with HTML, so it **bypasses `app/layout.tsx`** — no React hydration,
GSAP, Lenis, three.js, `next-auth/react`, fonts or images. It's about 56 KB of
HTML (about 16 KB gzipped), including every session, and makes **no
requests until you act** other than `/api/auth/session`.

Cached with `public, max-age=60, s-maxage=300, stale-while-revalidate=86400`
and `revalidate = 300`. It is `noindex` and not in the sitemap — it's a
duplicate of `/agenda` for a specific situation, not a page to rank.

## What the inline JS does (~5 KB, vanilla)

Everything is progressive: with JS off you get the full schedule, every track
stacked, no stars.

| Feature | How |
| --- | --- |
| Tabs | Show/hide the server-rendered panels; selection in `#hash` |
| Sign in / out | `fetch /api/auth/csrf`, then a plain form POST to `/api/auth/signin/google` (or `signout`), `callbackUrl=/event-agenda`. Session read from `/api/auth/session` |
| Stars | Same API as the main site: `GET/POST/DELETE /api/favorites`, optimistic with rollback. Signed out → inline "Sign in" prompt |
| Push | Same as `usePushSubscription`: registers `/sw.js`, `PushManager.subscribe`, `POST /api/push/subscribe` (checks `res.ok`, re-sends an existing subscription so it belongs to whoever is signed in). Hidden when unsupported, denied, iOS-not-installed, or `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is unset |
| "Now" | Marks the session running now, re-checked every minute |

## Keeping it light

- Don't import client components or add `<script src>`/`<link>`; add to the
  inline `CSS`/`JS` strings and keep it dependency-free.
- It reads the VAPID public key from `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  at build time, same as the rest of the site.
- Colours are the brand hex values inline (the Tailwind tokens don't exist
  here), light and dark via `prefers-color-scheme`.
