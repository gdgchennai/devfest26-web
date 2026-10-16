# Admin portal (`/admin`)

Two pages, gated by the same check, not listed in `lib/routes.ts` (same
precedent as `/signin` — not meant to surface on the 404 rescue grid or
sitemap for ordinary visitors).

| Page | What it does |
| --- | --- |
| `/admin` | Only the tracks you hold a role on. Mark agenda sessions Upcoming/Started/Ended. Started/Ended notifies everyone who favorited that session and has push on — see [`docs/push-notifications.md`](./push-notifications.md). |
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

## Hall live controls

`/admin/halls` shows current event titles on per-track cards, manual Start event / Mark event ended controls, and occupied percentages that persist across transitions. It uses the same RBAC: super-admins control every track; assigned admins and track leads control only their tracks. Super-admins see compact event rows and open a popup card for occupancy, lifecycle, pin and recommendation edits. Up/Down buttons stage priority changes in the overview; Save priorities publishes and Discard restores the current live order. Dragging is removed. Only super-admins can recommend, pin, or reorder. Default ordering is most available first, with pinned events first. A super-admin **Reset to first events** control clears started/ended events, pins, recommendations, occupancy and any frozen clock so every track shows its earliest agenda event as upcoming; organizers and track leads start and end from there. Promotions expire when an event is manually ended, never at its planned clock time. See [hall availability](hall-availability.md) for the isolated runtime and the distinction from the legacy Sessions page's push workflow.

Hall identity terminology follows current `main`: **super-admin**, **admin (organizer)**, **track lead**, and **user** (no track grants). The local selector includes each role, plus Signed out. Super-admin authorization remains unchanged; admins/organizers retain their existing track scope.
