# Admin portal (`/admin`)

Two pages, gated by the same check, not listed in `lib/routes.ts` (same
precedent as `/signin` — not meant to surface on the 404 rescue grid or
sitemap for ordinary visitors).

| Page | What it does |
| --- | --- |
| `/admin` | Mark agenda sessions Upcoming/Started/Ended. Started/Ended notifies everyone who favorited that session and has push on — see [`docs/push-notifications.md`](./push-notifications.md). |
| `/admin/users` | Every account, with its ticket name resolved the same way the profile page shows it, and a toggle to grant/revoke admin access. |

## Access control

There is no `role` concept anywhere else in this codebase — `lib/admin.ts` is
the whole mechanism, two layers:

1. **`ADMIN_EMAILS`** (env, see `docs/environment.md`) — a comma-separated
   bootstrap allow-list. Always grants admin, regardless of the DB flag.
2. **`users.is_admin`** (migration `0013_user_admin_role.sql`) — set from
   `/admin/users` by an existing admin. `0` by default for every new sign-in.

`isAdminUser()` checks both; `currentAdminUser(uid)` is what pages call (401→
redirect to sign-in, not-admin→redirect to `/`); `requireAdminApi()` is the
API-route equivalent (returns a `Response` to return as-is, or the admin's
own `UserRecord`).

**Why two layers, not just the DB column:** an env-controlled allow-list can
never be locked out by a DB mistake — whoever controls the deploy's secrets
always has a way back in. The API route also refuses to flip `is_admin` for
an `ADMIN_EMAILS` account (it'd silently no-op) and refuses to let an admin
remove their *own* access from the people list, for the same reason.

## Ticket names on `/admin/users`

`listUsersWithTicketNames()` in `lib/users.ts` resolves each account's
ticket the same way `getTicketForUser()` does for the profile page (an
explicit `ticket_claims` link wins, else a direct email match), batched into
three queries instead of one per user. Whatever string KonfHub gave that
ticket — "Professional", "Student", "Volunteer", "Core Team", or anything
else — is what's shown; this file has no special-cased list of ticket names.
`null` means no ticket found under either path ("No ticket" in the UI).

## Session-key fragility (inherited, not new)

Session status (`lib/session-status.ts`) and the favorites reverse-lookup
(`listUserIdsForSession` in `lib/favorites.ts`) are both keyed by
`sessionKey()` — `` `${track}@${start}` ``, derived from content, not a
stored id (see `lib/session-key.ts`). If a session's `track` or `start` is
edited in the agenda content after people have favorited it or an organizer
has marked it started, those rows silently orphan. This is the same
tradeoff `favorites` already had; nothing here makes it worse, but editing
agenda times near showtime is worth double-checking against this.
