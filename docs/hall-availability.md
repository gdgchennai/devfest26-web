# Live track occupancy

`/live` has one current/next card per configured track. `/admin/halls` allows assigned leads to report occupancy and organizers to manage all tracks and session promotions. Site navigation includes Live in both full and lite modes.

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

The yellow local toolbar selects public, organizer, Tech lead, Deep tech lead, or unassigned identities. Its IST clock is server-controlled, frozen at the selected time, and shared across every browser. Choose organizer, set `2026-10-17T11:00`, then open controls. Real time removes the override. No query parameter controls server time.

Two Workers run in ONE Wrangler process with private service bindings; only the coordinator owns the isolated D1. `.wrangler/hall-state` is distinct from normal site state. Stop this runtime before migration/seed commands or before starting another preview. No OAuth, tickets, push, Gemini, production secrets, paid service activation, or remote database is used. R2 and Images are locally emulated. Local build uses webpack because Turbopack's CSS subprocess listener was blocked on the implementation host. Normal build defaults are preserved.

`NEXT_PUBLIC_HALL_ISOLATED=1` is set by the build command. It disables GA/PostHog, auth session fetching, push prompt and crossword preload; the normal header, dropdown, footer and motion preference shell remain. Local identities additionally require `HALL_LOCAL_TEST=1` at runtime and a loopback Host. The role cookie is only a local fixture selector. Production auth ignores it; an isolated bundle with the runtime opt-in disabled is anonymous. Never deploy the local config or isolated bundle to production.

## Behavior

- Zone IDs and order come from `siteConfig.tracks`. Tracks sharing a hall have separate measurements. Agenda/speaker JSON is compiled into both page and coordinator; deploy both together when schedule content changes. Live intentionally does not use the editable D1 agenda overlay, which could otherwise disagree with coordinator expiry validation.
- Primary session is ongoing (`start <= now < end`), otherwise earliest future session. Future primaries say Coming up; ended tracks say Track finished. Breaks are omitted from primary/next selection but remain in their actual physical-hall schedules, including F&B and check-in entries. No fabricated F&B occupancy zone.
- Cards show occupied and remaining percentages; 100% means Full/closed for entry. Thresholds are centralized: 0–49 green, 50–79 yellow, 80–100 red. Unknown is explicitly unknown. Last measurement persists between sessions. Older than five minutes is marked stale; offline is separate from age.
- Visible pinned primary sessions first, then known occupancy ascending, then unknown; configured track order breaks ties. Recommended only adds a badge. Promotions use stable agenda IDs and expire exactly at end. They never transfer to a next preview/session. Upcoming session promotions may be prepared in advance.
- Full snapshots are small, revisioned messages. Clients discard older revisions; equal revisions are accepted for time-bound expiry reconciliation. A one-second local UI timer updates age and schedule boundaries without HTTP requests. Real-clock schedule boundaries also trigger a DO alarm. Simulated time is frozen and changes only on an authorized write.
- Physical movement is deferred while pointer/focus is inside the card region; measurements update immediately. A 3:1 current/next layout applies from 360px through tablet widths; below 360px previews stack. Desktop uses aligned four-column rows. A physical-hall schedule navigation row also exposes F&B/general entries without adding occupancy zones. Hall dialogs deduplicate by stable ID and include parallel events with track labels. Opening details replaces the schedule focus trap; Back restores the selected schedule entry.
- Organizer ordering supports pointer/touch drag handles and keyboard Up/Down buttons. Pinned order is the relative order of pinned draft entries. Recommendation and pin checkboxes are independent. Edits save explicitly; conflicts ask the actor to load the latest state before retrying, preserving unsaved drafts.

## Persistence and security

Migration `0014_hall_live.sql` adds measurements, assignments, promotions, audit, metadata revision, a singleton outbox and a batch guard. D1 is authoritative. The stable event-level SQLite DO serializes writes and snapshot/subscription. Expected zone revisions allow independent zone edits; promotion lists use the global revision. A constraint guard makes stale batches roll back. State, audit revision and outbox intent commit in the same D1 batch.

A durable alarm is scheduled before committing D1, closing the crash window before broadcast. Publication clears only the outbox revision it has processed; failed publication retries from authoritative D1. The singleton outbox coalesces to latest state rather than growing with retries. Alarms also reconcile real schedule transitions. Sockets use `ctx.acceptWebSocket`, with no in-memory authoritative state to reconstruct. Public Worker fetch is read-only; writes and permission lookup are confined to the named `HallControl` entrypoint over a private binding. Caller-provided actor/role headers are ignored by Next routes.

Leads use `hall_leads.user_id` matching the existing Auth.js UID. Organizers reuse the existing administrator adapter. Origin checks defend writes, including OpenNext's HTTPS model of local HTTP requests. Origin never grants permissions. Public socket messages close with policy/size errors; clients cannot publish.

Durable counters enforce 90 attempted writes per actor per minute, 6000 snapshot requests/minute and 6000 upgrades/minute per event. The 2000-socket cap permits 1400 attendees plus reconnect headroom. Limits are event/actor based, avoiding a venue NAT IP bottleneck. Responses include Retry-After for throttling. Payloads are capped at 16KiB, promotion lists at 100, rate-counter keys at 2000 and public inbound messages at 256 bytes. Retry delays use bounded exponential backoff/jitter; hidden pages close and visible pages resubscribe. No per-browser polling fallback or application heartbeat.

Workers' WebSocket API does not expose bufferedAmount. Send exceptions close connections for resnapshot; strict slow-client buffer accounting remains a platform limitation of this implementation. Evaluate slow-reader behavior on hosted staging before production use. No hosted CPU/free-tier reliability claim follows from local measurements.

## Reproducible checks

```sh
npx tsc --noEmit
npm run lint
npm run hall:check
npm run hall:test
```

Tests exercise actual route handlers, service binding, D1 and DO WebSockets: role/zone denial, invalid values, forged headers, concurrency conflicts, atomic ordering, expiry, subscription/write races, injected publication failure/recovery, socket write rejection, CSRF and durable actor throttle. Model tests exercise boundary, gap, empty day, parallel-track, unknown/tie sorting, missing speaker/long title and promotion noninheritance cases. `/tmp/hall-restart-expected.json` is written by tests; stop/restart `hall:dev`, then:

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

The load configuration only raises the coordinator's actor limit to 2000/min; validation, authorization, public limits and socket cap stay enabled. Runner defaults: 1400 independent sockets, 500 writes (400 occupancy, 100 promotion/order), 300 reconnect surge, shared loopback IP, unauthorized cases and 120-second soak. `HALL_CLIENTS`, `HALL_CHANGES`, `HALL_SOAK_SECONDS` and `HALL_URL` customize it. Final convergence checks revision and measurement content on every connected client. Output is saved to `/tmp/hall-load-report.json`. The runner records bounded retries on transient local proxy failures for denial probes; successful writes are not silently repeated. Latencies include Next/API/D1/DO/generator work from request start to client receipt, rather than hosted network timing. See the checked-in verification report for actual results and browser QA limitations.

## Production integration (not performed here)

1. Apply additive migrations to the project's existing D1 and assign real lead UIDs in `hall_leads`. Existing admin authorization supplies organizer access.
2. Provision/deploy a hall Worker with DB pointing at that SAME D1, a SQLite DO migration and the stable event ID. Omit all test flags. No remote/production database IDs were edited by this feature.
3. Add `HALL_CONTROL` (named private entrypoint) and `HALL_PUBLIC` (read-only default entrypoint) service bindings to the application. Adapt the gateway wrapper for its `/api/halls/socket` upgrade delegation; retain OpenNext's default exports if future cache modes require them. Root production configuration deliberately remains unchanged pending this integration.
4. Build the full site without `NEXT_PUBLIC_HALL_ISOLATED`; restore the original full-site bindings/secrets and verify the combined gzip bundle, hosted slow readers, rate limits and Free CPU budgets before deployment.

Cloudflare references checked during implementation: [hibernating WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/), [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/). Outgoing socket messages are not DO request units, but their CPU/duration still matters. Local load measurements do not establish hosted Free-tier compliance.
