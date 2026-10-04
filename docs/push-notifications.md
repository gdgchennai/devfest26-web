# Push notifications

Standard Web Push (VAPID + `aes128gcm`), stored and sent from this Worker — no
separate Worker, no Firebase project, no third-party push SaaS. See
[`docs/environment.md`](./environment.md) for the VAPID key pair.

## Pieces

| Piece | File |
| --- | --- |
| `push_subscriptions` table | [`migrations/0011_push_subscriptions.sql`](../migrations/0011_push_subscriptions.sql) |
| Subscription read/write | [`lib/push-subscriptions.ts`](../lib/push-subscriptions.ts) |
| Sending (VAPID sign + encrypt + fetch) | [`lib/push.ts`](../lib/push.ts) |
| Subscribe/unsubscribe REST API | [`app/api/push/subscribe/route.ts`](../app/api/push/subscribe/route.ts) |
| Service worker (`push` / `notificationclick`) | [`public/sw.js`](../public/sw.js) |
| Subscribe button (on `/profile`) | [`components/push/PushSubscribeButton.tsx`](../components/push/PushSubscribeButton.tsx) |
| Auto-shown nudge (any page, signed-in) | [`components/push/PushPrompt.tsx`](../components/push/PushPrompt.tsx), mounted in `app/layout.tsx` |
| Shared subscribe/unsubscribe state | [`lib/usePushSubscription.ts`](../lib/usePushSubscription.ts) |

## How it works

1. The browser's `PushManager.subscribe()` returns an `endpoint` on whichever
   push service that browser uses (FCM for Chrome/Edge/Android, Mozilla
   autopush for Firefox, APNs for Safari) plus a `p256dh`/`auth` key pair. The
   client POSTs that to `/api/push/subscribe`, which stores one row per
   endpoint in D1 (re-subscribing the same browser replaces its row via
   `ON CONFLICT(endpoint)`).
2. To notify someone, call `sendPushToUser(userId, { title, body, url })` or
   `sendPushToAll(...)` from `lib/push.ts`, from any server-side code —
   a route handler, a future cron trigger, wherever. Each subscription gets
   its own VAPID-signed, encrypted request straight to its `endpoint`.
   `sendPushToAll` chunks the fan-out (25 at a time) so a large subscriber
   list doesn't open thousands of simultaneous outbound fetches.
3. If a push service reports the subscription gone (`404`/`410` — the user
   revoked permission, cleared site data, or uninstalled), the row is deleted
   from D1 automatically.

## Session start/end notifications (`/admin`)

The one wired-up sender: [`app/admin/page.tsx`](../app/admin/page.tsx) lists
every agenda session grouped by track, each with Upcoming/Started/Ended
buttons ([`components/admin/AdminSessionRow.tsx`](../components/admin/AdminSessionRow.tsx)).
Clicking one `POST`s to [`app/api/admin/session-status/route.ts`](../app/api/admin/session-status/route.ts),
which:

1. Writes the status to the new `session_status` table
   ([`lib/session-status.ts`](../lib/session-status.ts),
   [`migrations/0012_session_status.sql`](../migrations/0012_session_status.sql)).
2. On "started" or "ended" (not "upcoming" — that's just an undo), looks up
   everyone who favorited that session
   (`listUserIdsForSession` in [`lib/favorites.ts`](../lib/favorites.ts), backed
   by the `idx_favorites_session` index from the same migration) and calls
   `sendPushToUsers` — a notification goes out immediately, inline in the
   request (no confirm step, no queue).

**Access:** gated by `ADMIN_EMAILS` (see `docs/environment.md`) via
[`lib/admin.ts`](../lib/admin.ts) — there's no `role` column or any other
privilege concept in this codebase, so this allow-list env var is the entire
mechanism. `/admin` isn't listed in `lib/routes.ts`, so it won't show up on
the 404 rescue grid or sitemap, same as `/signin`.

Nothing else calls `sendPushToUser`/`sendPushToUsers` yet, but they're
generic — call them from any other server-side event that should notify
people.

## The auto-prompt

Signed-in visitors who haven't subscribed get a one-time nudge (the same
bottom-pill shell `FavoritesProvider` uses for "sign in to save") after a 3s
delay, on whichever page they're on. Accepting or dismissing it sets
`localStorage["devfest-push-prompt-dismissed"]` so it never reappears —
it's a single nudge, not a recurring one. It never calls
`Notification.requestPermission()` on its own; that still only happens from
the "Enable" button's click handler, since browsers require a user gesture
for that call to do anything.

## iOS

iOS/iPadOS Safari only exposes the Push API to sites added to the Home
Screen (16.4+). `PushSubscribeButton` detects this and shows a one-line hint
instead of a button on Safari when the page isn't running standalone.
Android and desktop browsers need no such install step.

## Runtime notes

- `app/api/push/subscribe/route.ts` is `runtime = "nodejs"` (touches D1 +
  auth) per the usual rule.
- Encryption/signing uses [`@block65/webcrypto-web-push`](https://github.com/block65/webcrypto-web-push)
  — built on `SubtleCrypto` only, no Node crypto polyfill, kept deliberately
  tiny given the Worker's 3 MiB gzipped cap (see AGENTS.md "Hard constraints").
