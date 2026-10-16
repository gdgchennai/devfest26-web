# Live track occupancy

Emergency fallback: set frontend runtime `HALL_LIVE_ENABLED=false` to redirect
new `/live` visits to `/agenda`, hide Live links and pause new public hall
connections. See [the emergency runbook](hall-emergency-switch.md) before the event.

`/live` has one current/next card per configured track. `/admin/halls` allows assigned track leads/admins to report occupancy and manually start/end events. Only super-admins manage all tracks and recommend, pin, or reorder events. Site navigation includes Live in both full and lite modes.

## Local isolated runtime

Use Node 22+ for the integration/load runners (native WebSocket); the site retains its existing Node minimum. No new package dependencies are needed.

```sh
npm install
npm run hall:migrate
npm run hall:seed
npm run hall:build
npm run hall:dev
```

Public: http://127.0.0.1:8787/live?lite=1
Controls: http://127.0.0.1:8787/admin/halls?lite=1

The yellow local toolbar selects Super admin, Admin (organizer) for Tech or Deep tech, Track lead for Tech or Deep tech, User (signed in without grants), or Signed out identities. The legacy `organizer` fixture value still means super-admin and is unchanged; it is no longer labeled as an organizer in the selector. `unassigned` remains a test-only alias for a user without grants. Its IST clock is server-controlled, frozen at the selected time, and shared across every browser. The clock affects occupancy age only; event transitions require explicit Start event / Mark event ended actions. Real time removes the override. No query parameter controls server time.

Two Workers run in ONE Wrangler process with private service bindings; only the coordinator owns the isolated D1. `.wrangler/hall-state` is distinct from normal site state. Stop this runtime before migration/seed commands or before starting another preview. No OAuth, tickets, push, Gemini, production secrets, paid service activation, or remote database is used. R2 and Images are locally emulated. Local build uses webpack because Turbopack's CSS subprocess listener was blocked on the implementation host. Normal build defaults are preserved.

The isolated build sets `AGENDA_READY=true` so the original Agenda and Speakers destinations remain visible and routable. Navigation order is Home → Live → Agenda → Speakers, followed by the original remaining items. Normal production builds retain their existing `AGENDA_READY` configuration.

`NEXT_PUBLIC_HALL_ISOLATED=1` is set by the build command. It disables GA/PostHog, auth session fetching, push prompt and crossword preload; the normal header, dropdown, footer and motion preference shell remain. Local identities additionally require `HALL_LOCAL_TEST=1` at runtime and a loopback Host. The role cookie is only a local fixture selector. Production auth ignores it; an isolated bundle with the runtime opt-in disabled is anonymous. Never deploy the local config or isolated bundle to production.

## Behavior

- Zone IDs and order come from `siteConfig.tracks`. Tracks sharing a hall have separate measurements. Agenda/speaker JSON is compiled into both page and coordinator; deploy both together when schedule content changes. Live intentionally does not use the editable D1 agenda overlay, which could otherwise disagree with coordinator event validation.
- Every track starts with no running event. The primary card shows its earliest unplayed event as Upcoming until a permitted lead/admin explicitly starts it. Mark event ended stops the current event, expires its promotion, and reveals a next-event selector. The next unplayed event after the last ended event is suggested first; remaining choices follow agenda order and can be selected instead, including earlier skipped events and events that were previously marked ended. Only one event can run per track. When every event on a track has ended, the last ended event is suggested so it can be started again. Scheduled timestamps order choices and are displayed as planned times; they never start/end events. Breaks remain accessible in physical-hall schedules but are not occupancy events.
- Cards show occupied and remaining percentages; 100% means Full/closed for entry. Thresholds are centralized: 0–49 green, 50–79 yellow, 80–100 red. Unknown is explicitly unknown. Last measurement persists between sessions. Older than five minutes is marked stale; offline is separate from age.
- Visible pinned primary sessions first, then known occupancy ascending, then unknown; configured track order breaks ties. Recommended only adds a badge. Promotions use stable agenda IDs and expire only when the event is manually marked ended. They never transfer to a next preview/session. Upcoming session promotions may be prepared in advance.
- Full snapshots include manual event states and small revisioned messages. Clients discard older revisions. A one-second local UI timer updates measurement age without HTTP requests; it never advances an event. Simulated time is frozen and changes only on an authorized write.
- Physical movement is deferred while pointer/focus is inside the card region; measurements update immediately. A 3:1 current/next layout applies from 360px through tablet widths; below 360px previews stack. Desktop uses aligned four-column rows. A physical-hall schedule navigation row also exposes F&B/general entries without adding occupancy zones. Hall dialogs deduplicate by stable ID and include parallel events with track labels. Opening details replaces the schedule focus trap; Back restores the selected schedule entry.
- Super-admins start with a compact overview: current/upcoming event title, speaker names, planned IST times and timing status, a thin occupied-percentage bar, and saved pin/recommendation badges. Clicking a row opens the full editing card in a focus-trapped popup. All occupancy, recommendation, pin, Start/End and next-event edits live in that popup; track admins/leads retain their direct editing cards.
- Up/Down arrows replace dragging. Moves preview a pinned priority order; **Save priorities** publishes it atomically, while Discard restores the live order. Moving a row pins the minimum leading group needed to preserve its exact position; unaffected ordinary rows keep availability sorting. Recommendations are preserved. Any intervening live revision makes the draft stale: discard and reorder against current state. Popup edits are disabled while a priority draft exists. Saved priorities and badges expire on manual event end and never transfer to a successor.
- Timing labels compare manual state with the planned window: green On schedule while running inside it; red Out of sync for early running, an overrun, or an event awaiting start after its planned start. Future upcoming events remain neutral. Clock time is informational and does not start/end events.

## Persistence and security

Migration `0014_hall_live.sql` adds measurements, assignments, promotions, audit, metadata revision, a singleton outbox and a batch guard. Migration `0015_hall_manual_sessions.sql` adds stable-ID manual lifecycle state. The upstream `0014_track_roles.sql` and existing `0014_hall_live.sql` have distinct filenames and are both tracked by Wrangler; neither applied migration is renamed. D1 is authoritative. The stable event-level SQLite DO queues writes and alarm recovery together. Public reads and subscriptions reuse its current committed snapshot; only first-use reconstruction after startup/hibernation uses `blockConcurrencyWhile()`. Snapshot reconstruction uses one transactional D1 batch. All hall mutations must go through this coordinator; direct D1 edits while it is awake bypass cache invalidation. Expected zone revisions allow independent zone edits; promotion lists use the global revision. A constraint guard makes stale batches roll back. State, audit revision and outbox intent commit in the same D1 batch.

Socket registration plus its initial snapshot send is synchronous. Installing a committed snapshot plus broadcasting it is also synchronous, so a joining viewer either receives the new state initially or is already registered for its broadcast. Remote D1 reads/commits and publication cleanup yield to subscribers, who can temporarily see the previous committed state before its update arrives. `serverNow` is refreshed for each cached response; local frozen clocks remain frozen. Subscribers perform no D1 reads or alarm maintenance. D1 write batches retain the revision guard, audit and outbox; each writer reads fresh D1 state to reconcile any earlier ambiguous commit.

A durable alarm is scheduled before committing D1, closing the crash window before broadcast. Publication clears only the outbox revision it has processed; failed publication retries from authoritative D1. The singleton outbox coalesces to latest state rather than growing with retries. Alarms retry publication; schedule timestamps no longer schedule transition alarms. Sockets use `ctx.acceptWebSocket`; after hibernation the disposable cache is reconstructed from D1 before serving another snapshot. Public Worker fetch is read-only; writes and permission lookup are confined to the named `HallControl` entrypoint over a private binding. Caller-provided actor/role headers are ignored by Next routes.

Production permissions are resolved on each request through `lib/admin.ts` (`getAccess` / `manageableTracks`): `ADMIN_EMAILS` super-admins manage all tracks, while `user_track_roles` admins/leads manage only their own tracks. Only super-admins may recommend/pin/reorder. Admins are organizers, with the track scopes defined by current `main`. Ordinary signed-in users have no track/control grants; the hall controls show assignment guidance and writes are rejected with 403. Signed-out actors remain unauthenticated. `users.is_admin` is not used. Legacy `hall_leads` assignments are restricted to explicit loopback test identities and cannot grant production access. Origin checks defend writes, including OpenNext's HTTPS model of local HTTP requests. Origin never grants permissions. Public socket messages close with policy/size errors; clients cannot publish.

Synchronous DO SQLite counters (with automatic one-time migration of the previous KV counters) enforce 90 attempted writes per actor per minute, 6000 snapshot requests/minute and 6000 upgrades/minute per event. The 2000-socket cap permits 1400 attendees plus reconnect headroom. Limits are event/actor based, avoiding a venue NAT IP bottleneck. Responses include Retry-After for throttling. Payloads are capped at 16KiB, promotion lists at 100, rate-counter keys at 2000 and public inbound messages at 256 bytes. Retry delays use bounded exponential backoff/jitter; hidden pages close and visible pages resubscribe. No per-browser polling fallback or application heartbeat.

Workers' WebSocket API does not expose bufferedAmount. Send exceptions close connections for resnapshot; strict slow-client buffer accounting remains a platform limitation of this implementation. Evaluate slow-reader behavior on hosted staging before production use. No hosted CPU/free-tier reliability claim follows from local measurements.

## Reproducible checks

```sh
npx tsc --noEmit
npm run lint
npm run hall:check
npm run hall:test
```

Tests exercise actual route handlers, service binding, D1 and DO WebSockets: role/zone denial, invalid values, forged headers, concurrency conflicts, atomic ordering, manual lifecycle, preserved occupancy, production RBAC adapter mapping, subscription/write races, injected publication failure/recovery, socket write rejection, CSRF and durable actor throttle. Model tests exercise clock independence, gap, empty day, parallel-track, unknown/tie sorting, missing speaker/long title and promotion noninheritance cases. `/tmp/hall-restart-expected.json` is written by tests; stop/restart `hall:dev`, then:

```sh
node scripts/hall-live/persistence.mjs
# For a later restart: run with --record BEFORE stopping, then without it after restart.
```

To verify disabled local identities, stop preview and run `npm run hall:dev -- --var HALL_LOCAL_TEST:0`, then `node scripts/hall-live/disabled.mjs` (selector 404, write 403, permission lookup 401). Stop before restarting normal mode.

For the explicit local load allowance, stop normal preview, then:

```sh
npm run hall:dev:load
# in a second terminal
npm run hall:load
```

The load configuration only raises the coordinator's actor limit to 2000/min; validation, authorization, public limits and socket cap stay enabled. Runner defaults: 1400 independent sockets, 500 writes (400 occupancy, 100 promotion/order), two additional manual lifecycle writes, 300 reconnect surge, shared loopback IP, unauthorized cases and 120-second soak. `HALL_CLIENTS`, `HALL_CHANGES`, `HALL_SOAK_SECONDS` and `HALL_URL` customize it. Final convergence checks revision and measurement content on every connected client. Output is saved to `/tmp/hall-load-report.json`. The runner records bounded retries on transient local proxy failures for denial probes; successful writes are not silently repeated. Latencies include Next/API/D1/DO/generator work from request start to client receipt, rather than hosted network timing. See [manual event verification](hall-manual-verification.md) for current results and browser QA limitations.

## Hosted availability branch

Root `wrangler.jsonc` on this branch deploys the full app to
`devfest-hall-availability-test`, without the production custom domain. The
`main` branch owns `devfest-chennai-2026` and `devfest.gdgchennai.in`. See
[branch deployment targets](deployment.md#branch-deployment-targets) for
commands, shared production data, cache separation and OAuth configuration.
The private hall backend remains `devfest-hall-live`.

## Production integration

1. Apply additive migrations to the project's existing D1. Assign track admins/leads using the existing People RBAC page (`user_track_roles`); `ADMIN_EMAILS` supplies super-admin access. Do not assign production roles in `hall_leads`.
2. `workers/hall-live/wrangler.jsonc` defines the production `devfest-hall-live` Worker, the SAME existing D1, and a SQLite DO migration. It has no public hostname and omits all test flags. Local configurations retain their separate local database IDs.
3. Root `wrangler.jsonc` supplies `HALL_CONTROL` (named private entrypoint) and `HALL_PUBLIC` (read-only default entrypoint) service bindings. Its gateway delegates `/api/halls/socket` upgrades and re-exports OpenNext's named cache/queue classes as well as forwarding ordinary requests.
4. Build the full site without `NEXT_PUBLIC_HALL_ISOLATED`; restore the original full-site bindings/secrets and verify the combined gzip bundle, hosted slow readers, rate limits and Free CPU budgets before deployment.

Cloudflare references checked during implementation: [hibernating WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/), [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/). Outgoing socket messages are not DO request units, but their CPU/duration still matters. Local load measurements do not establish hosted Free-tier compliance.

See [production readiness](hall-production-readiness.md) for the verified prerequisites and deployment sequence. Preparing these configurations does not deploy them.

Cloudflare Worker Previews require their own `previews.services` declarations for `HALL_CONTROL` and `HALL_PUBLIC`; top-level production service bindings are not inherited. These preview bindings use the production `devfest-hall-live` service and share its hall state. Authorized edits in a hosted preview therefore affect production. Updating preview configuration requires a new preview deployment; an older unique deployment URL retains its previous bindings.

## Existing Sessions page

The `/admin` Sessions page retains its existing favorites/push notification workflow and legacy `session_status` keys. Hall lifecycle is owned by `/admin/halls` and uses stable agenda IDs, atomic audit/outbox writes, and WebSocket publication. Changes in the legacy Sessions page do not control Live halls, and hall controls do not send favorites push notifications. Use Hall control to run the live event; merging these notification workflows is separate integration work.

## Concurrent-arrival regression

`node scripts/hall-live/arrival-local.mjs 1400` runs a fresh isolated workerd/D1/SQLite DO with 1,400 upgrades issued simultaneously, without ramp delays. It injects remote-I/O latency and checks one shared cold snapshot read, cached time, subscribing during a suspended writer, concurrent revision conflicts, failed/ambiguous commits, legacy limiter migration, and pending-outbox recovery across a persisted runtime restart. Its test-only subclass and RPC hooks are generated inside the harness and never deployed. The report defaults to `/tmp/hall-arrival-local.json`; no hosted account resources or Google login are used.

See [the connection-path follow-up](hall-connection-path-2026-10-16.md) for implementation reasoning, measured results and remaining hosted validation.
