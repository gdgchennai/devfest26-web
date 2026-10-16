# Hosted hall load-test handover — 2026-10-16

## Objective and authorization

Prepare and run a controlled hosted load test of:

`https://devfest-hall-availability-test.gdg-chennai.workers.dev`

The user reports Google sign-in now works and wants hosted stress testing next.
This handover task did not run any load or change hosted configuration/data.
The earlier “no stress tests” instruction has been superseded by the user's
new testing intent, but the user still requires approval before command batches.
Obtain approval for concrete load stages and any shared-data writes before
executing them. Do not assume approval for deployments, migrations, role grants,
production lifecycle edits, limiter changes, or paid-plan upgrades.

Read `AGENTS.md`, this file, `docs/hall-availability.md`, and the relevant source
before work. Preserve all existing edits. No commits/pushes without a new request.

## Repository and deployments

- Workspace: `/home/headhit/Documents/repos/devfest26-web`
- Branch: `codex/hall-availability-test`; last pushed feature tip was `776e907`.
  Recheck current local/remote state instead of assuming it has not changed.
- Root `wrangler.jsonc` has **uncommitted** deployment separation changes: Worker
  `devfest-hall-availability-test`, empty custom-domain routes, its own
  `WORKER_SELF_REFERENCE`, and R2 prefix `hall-availability-test`.
- The original main website `https://devfest.gdgchennai.in` serves `main` commit
  `93f64cc845366dd94d881a5120c20a373e8cf4e6`, last recorded version
  `0d2cea81-5b50-4f12-9888-5811dfb9de34`. Do not deploy to it for this test.
- The availability app binds **the existing private `devfest-hall-live` Worker**
  and **production D1** `devfest-chennai-2026`, ID
  `7460097a-f29e-4c9d-95ac-fd6070d666d0`.
- Account: GDG Chennai, ID `dbf439e411a3a8835d7880c3ff047b9e`.
- The separate frontend Worker does NOT isolate hall data, Durable Object
  capacity, rate counters, D1 usage, or audit history. Writes affect shared state.
- Private backend config: `workers/hall-live/wrangler.jsonc`; class
  `HallCoordinator`, named control entrypoint `HallControl`.
- Hall migrations were already applied. No migrations, seeding, or content sync
  are required for testing. Do not restore the whole production DB for cleanup.

At handover, existing modifications include `.dev.vars.example`, `AGENTS.md`,
`cloudflare-env.d.ts`, `docs/deployment.md`, `docs/environment.md`,
`docs/hall-availability.md`, `docs/hall-live-handoff.md`,
`docs/hall-production-readiness.md`, and `wrangler.jsonc`. `AGENTS.md` and the
original handoff include user edits. Preserve them all.

## Authentication

User reports OAuth is fixed. Before that fix, the locally supplied credential
pair returned Google `invalid_client`; **do not overwrite working deployed auth
secrets from `.env.local`**, which may still contain that rejected pair.

Hosted writes require an actual Auth.js session:

- Super-admin: email in the availability Worker's `ADMIN_EMAILS` secret;
  may edit all tracks, pin, recommend, and reorder.
- Track admin / track lead: existing `user_track_roles` grants, mapped through
  `lib/hall-access.ts`; may edit assigned tracks' occupancy and lifecycle.
- Ordinary signed-in users and anonymous users cannot edit halls.

Do not print cookies, OAuth codes, secrets, or full auth logs. If an automated
writer needs a real session, obtain it using an approved secure local mechanism,
store it in a private ignored file (mode 0600), and never put its value in command
arguments, committed files, reports, or chat. Include any chunked Auth.js session
cookie pieces. Validate the session with `GET /api/admin/halls` before writes.
Public reads/WebSockets need no account.

`POST /api/admin/halls` requires exact
`Origin: https://devfest-hall-availability-test.gdg-chennai.workers.dev`, JSON,
and a real session cookie. Normalize `HALL_URL` to its origin with no trailing
slash. Do not forge roles or introduce an auth bypass.

## Existing scripts: important limitations

Read `scripts/hall-live/load.mjs` before running it. It currently:

- Defaults to 1,400 sockets, 500 update iterations, and a 120-second soak.
- Opens clients in batches of 50, separated by 50 ms.
- Uses local `hall-dev=organizer`, `lead-tech`, and `lead-deep` cookies.
- Writes a local-only clock override BEFORE regular updates.
- Starts an unused agenda event, then permanently marks it ended through the API.
- Alternates occupancy updates and promotion replacements; reconnects up to
  300 clients during a final update; checks forbidden writes and convergence.
- Saves `/tmp/hall-load-report.json`, overwriting a previous report.
- Counts generator CPU/RSS, not Worker/Durable Object CPU or billing.
- Does not have a read-only switch or real hosted-session support. Setting
  `HALL_CHANGES=0` does NOT disable setup/lifecycle writes.
- May leave sockets open until process exit on an assertion failure; a hosted
  runner needs bounded timeouts and cleanup in `finally`.

**Do not run the existing runner against the hosted URL as-is.** Its fixture
cookies correctly fail hosted authorization, and its clock write is prohibited.
Simply replacing cookies still leaves unsafe lifecycle and promotion behavior.

`npm run hall:test` imports `identity-tests.mjs`, selects local fixtures and
mutates events. It is also unsuitable for hosted use. `hall:dev:load` and
`workers/hall-live/wrangler.load.jsonc` are local-only and must not be deployed.
Never enable `HALL_LOCAL_TEST`, `HALL_LOAD_TEST`, or
`NEXT_PUBLIC_HALL_ISOLATED` on the hosted application/backend.

For a separate LOCAL rehearsal only, after checking no runtime uses the same
state directory, the existing commands are:

```sh
npm run hall:migrate
npm run hall:seed
npm run hall:build
npm run hall:dev:load
# In another terminal, only after the local runtime is ready:
HALL_URL=http://127.0.0.1:8787 HALL_CLIENTS=50 HALL_CHANGES=10 HALL_SOAK_SECONDS=30 npm run hall:load
```

Those commands alter local state/build outputs; they are not hosted commands.
A local isolated build must never be deployed. Node 22+ is required for the
existing runners' native WebSocket support.

## Adapt the runner before hosted testing

Prefer a separate `scripts/hall-live/hosted-load.mjs` so local regression tests
retain their behavior. The following is an implementation contract, **not an
existing supported CLI**:

1. Explicit target-origin allowlist; refuse the original production website,
   refuse implicit localhost fallback, validate positive bounded load inputs.
2. Default to read-only connection/snapshot/soak/reconnect testing. No clock,
   lifecycle, promotion, occupancy, or denial-probe writes in this mode.
3. Optional authenticated update mode requires explicit opt-in, a private
   session file, validated super-admin/track permissions, approved tracks and
   mutation types, bounded counts, and paced writes under production limits.
4. Reuse measurement/convergence concepts from `load.mjs`: revision monotonicity,
   duplicate/gap counts, accepted/rejected connections, close codes, final state,
   update-to-observer latency, reconnect recovery and soak health. A read-only
   run cannot measure update propagation unless a separately approved operator
   performs real updates during observation.
5. Record 401/403/409/429/503 explicitly. Honor `Retry-After`; never retry writes
   blindly after a transport timeout. Refetch authoritative state to reconcile
   potentially committed mutations. Do not retry POSTs with stale revisions.
6. Clean up every socket on success, failure, timeout and SIGINT. Give connection
   ramp, reconnect batch size, timeout, request rate and total duration explicit
   bounds. Run negative access probes separately from saturation tests.
7. Timestamp reports in an ignored directory, redact credentials and personal
   data, capture initial/final snapshots privately, distinguish intended closes
   from unexpected disconnects. Include target, stage, clients, rates, duration,
   statuses, revisions, latency sample count and generator resource use.
8. Verify small local behavior first; typecheck/lint as applicable. Read installed
   Next docs before changing app code. No app changes should be needed just to
   implement a standalone runner.

Once implemented, document the actual CLI and show the user exact commands for
approval. Do not present invented flags as usable existing script options.

## Current application limits (verify source before testing)

`workers/hall-live/index.ts` currently enforces:

- At most **2,000 active sockets** per coordinator.
- **6,000 connection attempts per fixed minute** per coordinator.
- **6,000 public snapshots per fixed minute** per coordinator.
- **90 write attempts per actor per fixed minute**; denied mutations can consume
  this budget after the request reaches the actor limiter.
- Local-only dual test flags raise actor writes to 2,000/min; irrelevant hosted.

Counters are coordinator-wide, not per venue IP, and share real traffic capacity.
Keep headroom; do not treat 2,000 as a promised target. A 429 from a deliberate
rate-limit probe is expected enforcement, not necessarily a reliability defect.

Occupancy uses the zone measurement revision as `expected`; promotions and
lifecycle use the global snapshot revision. Promotion writes replace the list.
Ending an event deletes its promotions; an ended event cannot be restarted via
the current API. Do not run lifecycle tests on real events just to generate load.
An API snapshot is not a complete database backup and restoring occupancy values
still creates new revisions, timestamps, audit rows and broadcasts.

## Proposed hosted execution sequence

Obtain approval for load levels, duration, write scope and stop criteria first.
Suggested starting stages (adjust after source/config checks):

1. Read-only preflight: snapshot 200, one WS initial snapshot, `/api/halls/dev`
   unavailable, forged fixture roles denied, real-account permissions verified.
   A previously signed-in user may need to refresh their session.
2. 25 clients for 30 seconds, then 100 for 60 seconds; controlled ramp/reconnect.
3. 500 for 120 seconds, then 1,000 for 120 seconds if healthy. Consider 1,400
   only with explicit approval, enough headroom and healthy telemetry.
4. During an approved stage, a real operator can make a few agreed occupancy
   updates to measure delivery. Automated writes require separate scope approval;
   start with 10–20 occupancy writes, paced at 1 every 2 seconds, to approved
   zones. Do not automatically start/end events or replace promotions.
5. A longer soak or capacity/rate-limit probe is a separate agreed stage.

Stop on the first unexplained sustained 5xx, auth failure, event/data change
outside scope, convergence failure, unexpected disconnect burst, or Cloudflare
resource-limit errors. Proposed sustained failure rule: >1% unexpected failed
operations for 30 seconds; agree it with the user before execution. Stop on SIGINT
and close all generator sockets. Do not auto-escalate load to compensate for
failures. Preserve logs/reports and investigate before another stage.

Watch Cloudflare dashboards for both Workers, DO errors/duration/CPU, D1 query
errors/latency, and quota indicators available to the account. Use narrowly
filtered diagnostic tails if needed, keeping auth headers/query strings private.
Tailing logs and observing dashboards need approval as part of the command batch.
Do not infer hosted CPU compliance from generator CPU. User previously lacked
Billing visibility; missing billing access is not zero usage or unlimited quota.

## Backups, cleanup and report

Before any automated shared-data writes, obtain fresh approved backup/snapshot
coverage and an agreed restoration plan. Existing private backup directory:
`/home/headhit/devfest-backups`. Do not reuse the previous day's backup as if it
were current. D1 exports contain personal data and a signed download URL may
appear in export logs; capture privately and never print those logs verbatim.

Prefer occupancy-only tests or a genuinely isolated backend/D1 for destructive
lifecycle stress. Creating isolated hosted infrastructure is a separate approved
change. Never drop tables, delete audit history, reset revisions, or restore the
whole shared DB to clean up a load test. Restore only approved values through
normal APIs where possible, and report residual audit/timestamp changes honestly.

Final report must distinguish actual results from proposed stages, list peak
connections and duration, update counts, propagation p50/p95/p99 with sample
counts, gaps/out-of-order/duplicates, reconnect outcomes, 429/503 counts, final
state convergence, Cloudflare telemetry observed and its limitations, cleanup,
and any untested roles/features. No claims about event-day capacity beyond the
measured configuration and traffic pattern.

Useful existing artifacts (ignored, may be stale):
`.wrangler/hall-separate-worker-smoke.mjs`,
`.wrangler/hall-separate-worker-smoke-report.json`,
`.wrangler/hall-branch-separation-preparation.json`.
Read the smoke script before reuse; it has a hardcoded hosted URL and read-only
access probes. It does not validate successful signed-in writes.
