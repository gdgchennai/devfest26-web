# Admin portal (`/admin`)

Three pages, gated by the same check, not listed in `lib/routes.ts` (same
precedent as `/signin` — not meant to surface on the 404 rescue grid or
sitemap for ordinary visitors).

| Page | What it does |
| --- | --- |
| `/admin` | Only the tracks you hold a role on. Mark agenda sessions Upcoming/Started/Ended. Started/Ended notifies everyone who favorited that session and has push on — see [`docs/push-notifications.md`](./push-notifications.md). |
| `/admin/halls` | Only the tracks you hold a role on. Update hall occupancy status (Available, Filling fast, Houseful) and broadcast in-hall announcements (max 80 chars) to the `/live` bento grid. |
| `/admin/users` | Every account, with its ticket name resolved the same way the profile page shows it, and per-track role controls (None / Track lead / Admin) limited to the tracks you administer. Searchable (`?q=`, matches name, email and ticket name) and paginated 25 per page (`?page=`) — both are plain GET params, filtered server-side. |

## Access control

Three levels, all resolved in [`lib/admin.ts`](../lib/admin.ts):

| Level | Who | Can |
| --- | --- | --- |
| **Super admin** | `ADMIN_EMAILS` (env) | Everything, on every track, including venue-wide (no-track) sessions. Grants any role on any track. Never stored in the DB, so a DB mistake can't lock out whoever controls the deploy's secrets. Not editable from `/admin/users`. |
| **Admin** (per track) | `user_track_roles` row, `role = 'admin'` | Mark that track's sessions; see the whole People list; grant `admin` or `track_lead` **only on tracks they are admin of** (so a scoped admin can only create other admins scoped to a subset of their own tracks). |
| **Track lead** (per track) | `user_track_roles` row, `role = 'track_lead'` | Mark that track's sessions started/ended. No People tab (`/admin/users` redirects to `/admin`), no promoting. |

Roles are per (user, track) in `user_track_roles` (migration
`0014_track_roles.sql`), so one person can run several tracks and even be admin
on one and lead on another. Rules enforced server-side in
`app/api/admin/users/role/route.ts` (the UI only mirrors them):

- the caller must be admin of the track being changed (super admin: any);
- you can't change your own role, and super admins can't be edited;
- `app/api/admin/session-status/route.ts` rejects sessions outside the
  caller's tracks with 403 (venue-wide sessions are super-admin only).

**Legacy `users.is_admin`** (migration 0013) is no longer read. Anyone who was
made admin that way has no access until re-granted a track from
`/admin/users` — a super admin can do it for them.

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
