# Hall production readiness

Preflight performed on 2026-10-15. Production deployment is authorized by the user, but the checks below are not a deployment record.

## Verified infrastructure

- Wrangler authenticates to the GDG Chennai account. Both production configurations explicitly select that account.
- The existing `devfest-chennai-2026` Worker owns `devfest.gdgchennai.in`, uses the existing D1 database and R2 cache bucket, and has the expected auth, super-admin, Gemini and private push secrets. Preserve these secrets; do not replace them from a local dotenv file.
- Production already has `user_track_roles` and the upstream RBAC migration. Admins and leads have track-scoped grants; super-admins still come from `ADMIN_EMAILS`. No Google OAuth scope or claim changes are required. Manage assignments through `/admin/users` after the user has signed in.
- Only `0014_hall_live.sql` and `0015_hall_manual_sessions.sql` were pending during preflight. Both apply to a restored production export without changing existing table row counts. They add hall tables and an initial revision; they do not seed occupancy, roles or event starts.
- A private SQL backup was exported outside Git and restored into an in-memory SQLite database. Its integrity check passed. Keep the backup private: it contains production user data. Export again immediately before migrations if production changes after this preflight.
- The supplied `env.local` is now ignored and copied to ignored `.env.local`, which Next actually loads. `AGENDA_READY=true` is present. The existing public VAPID key was recovered from the currently deployed public bundle and preserved in `.env.local`; no push keys were rotated.
- Production has no D1 agenda/speaker documents in the export, so the repository JSON fallback applies. The user explicitly chose to preserve the existing Agent Wars elimination times despite their unusual 2:00 AM start.

## Local verification completed

- Full production OpenNext build and both Wrangler deployment dry runs passed. Site upload: 2235.12 KiB gzip; hall service: 25.81 KiB gzip. A dry run uploads nothing.
- App and hall Worker typechecks passed. Lint reports the existing 10 errors and 4 warnings in unrelated files.
- Production RBAC adapter, manual lifecycle/ordering models and client visibility/reconnect lifecycle tests passed.
- Both production configs ran together against a fresh, separate local D1 under `.wrangler/hall-production-qa`. Live, Agenda, Speakers and the snapshot endpoint returned 200. A WebSocket received the initial snapshot; attempting a public socket write closed it with code 1008.
- Forged local-role cookies remained unauthenticated in the production build. The local identity endpoint returned 404, and HTTP mutation origin checks rejected insecure requests.
- Browser inspection covered desktop lite mode and phone full-motion mode, the restored navigation order and hall schedule dialog. Signed-in production roles and hosted updates still require post-deploy verification.
- No stress tests were run during production preparation.

## Remaining gates

- Billing visibility is unavailable and is not a deployment prerequisite. Keep the existing subscription and validate against Workers Free constraints. The SQLite-backed Durable Object is supported on Free and Paid, and the measured site bundle fits the published bundle limit as well as this repository's conservative gzip budget. Hosted CPU, startup and quota checks remain necessary; if Cloudflare rejects deployment, report the exact restriction rather than changing the plan. Do not enable or upgrade a paid service without authorization. References: [DO plan availability](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
- Complete hosted sign-in, real-role and two-browser update verification after deployment. No stress tests are authorized for this rollout.
- Production configurations must never set `NEXT_PUBLIC_HALL_ISOLATED`, `HALL_LOCAL_TEST` or `HALL_LOAD_TEST`. The dedicated local test configurations are separate. Never deploy a previously generated isolated bundle.
- Record the active production deployment/version immediately before cutover for rollback. Roll back application code if necessary; do not drop new tables or overwrite the shared database to undo this additive feature.

## Deployment order

Run from the repository root, after all readiness gates pass:

1. Refresh and verify a private production backup. Recheck the migration list so only reviewed migrations will run.
2. Apply the reviewed additive migrations using the root config:

   ```bash
   npx wrangler d1 migrations apply devfest-chennai-2026 --config wrangler.jsonc --remote
   ```

3. Deploy the hall service first. Wrangler creates its SQLite-backed `HallCoordinator` namespace and private named control entrypoint from configuration; no manual console namespace creation is needed:

   ```bash
   npx wrangler deploy --config workers/hall-live/wrangler.jsonc
   ```

4. Build and deploy the full application using root configuration:

   ```bash
   npm run deploy
   ```

5. Verify Home, Live, Agenda and Speakers; Google sign-in; anonymous/ordinary-user denials; track-scoped admin/lead controls; super-admin ordering; and WebSocket updates between two browsers. Do not seed fake users, occupancy or simulated clock values into production. Coordinate any real event start/end with the organizer because ended events cannot be restarted through the hall UI.

The existing custom domain needs no DNS change. The new hall Worker has neither a custom domain nor a workers.dev endpoint; browsers connect through the main application's `/api/halls/socket`. Existing Google redirect URIs remain valid because the application's hostname is unchanged. The ticketing Worker is not redeployed.

The existing `/admin` Sessions notification workflow remains separate from the manual lifecycle in Hall control; hall transitions currently do not send saved-session push notifications. See [hall availability](hall-availability.md#existing-sessions-page).
