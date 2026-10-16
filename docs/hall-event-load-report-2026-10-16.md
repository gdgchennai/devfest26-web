# Hall availability readiness report — 16 October 2026

Historical pre-cache assessment. For the later deployed cached-backend rehearsal, see [the realistic five-minute report](hall-realistic-five-minute-report-2026-10-16.md). The serialized-subscription findings below describe the earlier backend.

Event: 17 October 2026, Chennai. Target: 1,500 participants plus 20 organizers connected concurrently; evaluate both 200 total updates and 200 per organizer (4,000 total). Expectations were recorded first in [the acceptance plan](hall-event-load-expectations.md).

## Decision

**Conditional readiness; do not claim that 1,500 hosted concurrent users are verified.** The local application demonstrates reliable broadcast and conflict handling at the target connection count. The deployed connection path misses the initial-snapshot latency target with just 25 simultaneous arrivals. Hosted escalation was stopped, preserving shared resources. Free-tier request volume looks feasible for moderate connection churn, but hosted CPU compliance and actual account subscription remain unverified.

**Assurance:** strong for the local state-consistency cases actually exercised; limited for hosted event-day capacity; insufficient for an unconditional assurance that the event will run smoothly. This is an evidence assessment, not a statistical probability.

No deployment, subscription change, purchase, production migration, seeding, or authenticated hosted mutation was performed. Existing user edits were preserved. The local `.open-next` bundle was rebuilt in isolated test mode: **do not deploy that bundle**; a future deployment must rebuild with the intended production configuration.

## Shared quota and infrastructure findings

The staging frontend binds the production `devfest-hall-live` service and the production D1 database. Both frontends reach the same named `HallCoordinator`. A separate frontend hostname does **not** isolate hall data, active sockets, throttles or account quotas.

Hosted load tests consume the same daily allowances as the production site and other Workers in the account. Local Miniflare/D1 tests do not consume hosted execution/database quotas. Daily reset is **00:00 UTC / 05:30 IST**. Today's tests before tomorrow's reset do not consume tomorrow's daytime daily allocation; retained storage and monthly product allowances do not reset on that schedule.

Cloudflare documentation checked live on 16 October 2026:

| Resource | Free allowance / constraint | Implication |
|---|---|---|
| Worker requests | 100,000/account/day | Count upgrades, reconnects, API and dynamic-page requests; reserve room for every other site |
| Worker CPU | 10 ms per HTTP invocation | Waiting on I/O is excluded; Next rendering/auth must still fit |
| Durable Object requests | 100,000/day | Connections, HTTP/RPC, alarms and incoming application messages count |
| Durable Object duration | 13,000 GB-s/day | Shared per active object, not multiplied by sockets |
| D1 | 5 million rows read, 100,000 rows written/day; 5 GB total | Queries scan rows; indexes and deletes also matter |
| DO SQLite | 5 million rows read, 100,000 rows written/day; 5 GB total | Separate storage accounting from D1; rate counters consume writes |
| Application socket cap | 2,000 per coordinator | 1,520 leaves 480 spare sockets (24%); tabs and overlapping reconnects consume headroom |
| Application throttles | 6,000 connections/min, 6,000 public snapshots/min, 90 writes/actor/min | Limits are shared per coordinator, not a per-venue-IP restriction |

References: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/).

Outgoing WebSocket broadcasts are not charged as additional request units. Worker upgrades count once; forwarded WebSocket messages do not count as Worker requests. DO incoming application messages use a 20:1 billing ratio; this app sends no heartbeat messages and rejects client writes over WebSockets. Service bindings do not add another billable external request. The code uses `acceptWebSocket`, allowing hibernation, and clears idle alarms.

### Observed account usage

Read-only GraphQL queries covered the UTC day across the account, not just the test Worker. These are analytics, potentially sampled/delayed, **not an exact billing ledger**. Long-lived WebSocket invocation records can appear only after close ([DO metrics](https://developers.cloudflare.com/durable-objects/observability/metrics-and-analytics/)).

| Metric | Before hosted testing | After bounded hosted checks |
|---|---:|---:|
| Worker invocation sum (includes service invocation records) | 26,825 | 28,073 |
| D1 rows read | 64,978 | 65,772 |
| D1 rows written | 517 | 527 |
| DO requests/invocations | 111 | 366 |
| DO duration, GB-s | 51.824 | 120.944 |
| DO SQLite rows read | 24,810 | 24,943 |
| DO SQLite rows written | 193 | 326 |
| DO CPU/memory/fatal-resource errors | 0 / 0 / 0 | 0 / 0 / 0 |

The observation window added 1,248 account invocation records, 794 D1 rows read, 10 D1 rows written and 69.120 GB-s of DO duration. These deltas include other traffic, delayed records and diagnostic browsing; they are not the isolated cost of the runner. The five hosted runner reports total 89 attempted WebSocket establishments plus nine snapshot GETs, with a few additional single-connection diagnostics, access probes and browser requests. No quota was close to exhaustion in the retrieved metrics.

The post-check DO sampled peak was 72 sockets, not 1,520. The generator's largest successful hosted group was 25. Other account traffic and disconnecting test attempts can contribute to the server metric. DO memory sampled peak was 37,687,260 bytes. A read-only `SELECT 1` reported D1 size 1,417,216 bytes and APAC/SIN primary service; the DO request analytics reported KIX. This is useful diagnostic context, not proof that geography alone caused the delay.

Subscriptions API returned 403. `default_usage_model: standard` does not prove a paid or free subscription. No billing settings were changed. The owner must confirm the plan in Billing before relying on free-only operation. On the Free plan, exhausted daily allowances cause failures; they are not a reason to assume automatic paid overages.

An observed staging frontend CPU p95 was **190.332 ms** across 148 successful invocations in a mixed traffic window. This is not a socket-route-only measurement, and cannot be extrapolated to all requests, but it is substantially above the Free plan's 10 ms budget. No `exceededCpu` outcome was observed in the retrieved rows. This remains a free-tier readiness concern requiring route-level profiling, not proof of compliance because requests happened to succeed.

The main website already had 219 `scriptThrewException` invocations before testing (227 in the later snapshot). Another Worker had 25. These predate/extend beyond hall testing and were not diagnosed in this scope. DO analytics included disconnect-related errors and two `scriptThrewException` hibernation invocations during the diagnostic window. A short exception-only tail produced no exception payload to explain those two; they remain unresolved. Do not interpret the aggregate DO error count as HTTP 5xx or as quota exhaustion.

## Actual tests

| Test | Result and scope |
|---|---|
| Existing functional suite | PASS after rebuilding the isolated bundle. Initial attempt correctly failed because an older production-mode bundle disabled the local identity endpoint (404). |
| Permissions and safety | Local super-admin, both track admins/leads, ordinary/anonymous users, forged roles, cross-track writes, CSRF and invalid values checked. Hosted anonymous and forged local-organizer cookie GETs both returned 401. |
| State/lifecycle | Local stale revision rejection; same-zone and promotion races; event start/end constraints; occupancy preservation; ended-promotion removal; public socket write rejection; production actor throttling and `Retry-After: 60` checked. |
| Recovery | Local subscription racing an update, alarm/outbox recovery after suppressed publication, and persistence after runtime restart passed. Persisted revision 219 matched exactly. |
| Existing load runner | **1,520 sockets; 200 regular changes + 1 clock + 2 lifecycle writes; 300 reconnects; 120-second soak; 163.044 seconds total.** Zero missed final states, healthy-client broadcast gaps, out-of-order messages or unexpected disconnects. Three unauthorized writes rejected; zero transport retries. |
| Existing runner latency | 308,860 observations: p50 **45.41 ms**, p95 **64.16 ms**, p99 **100.28 ms** from pre-request timestamp. 300 duplicate revisions were expected reconnect snapshots. This runner writes sequentially and uses raised local-only actor limits; it does not prove 20 simultaneous writers. |
| Distinct-actor concurrency | **PASS: 1,520 clients, 20 actors, 4,000 successful updates plus one race winner; 19 expected 409s; 300 reconnects; 120-second soak; 367.234 seconds total.** Zero gaps, regressions or unexpected disconnects; all 1,520 final snapshots matched. Audit: exactly 4,001 rows from 20 actors. Real backend code with isolated D1/DO, 20 trusted synthetic actor IDs, normal 90/min actor limiter. Auth.js and the Next gateway are intentionally outside this backend harness. |
| First hosted group | **FAIL:** 25 native Node WebSocket clients timed out at 15 seconds with no initial snapshots. Cleanup closed all generator sockets. No larger stage followed this failure. |
| Hosted diagnostics | HTTP/1.1 upgrade received 101 and a valid snapshot. Browser `/live` initially showed reconnecting, then showed Connected and current data. Native IPv4 and explicit IPv4 `ws` single-client probes succeeded. Exact cause of the original native-client failure is not established. |
| Hosted 5 clients | All 10 initial/reconnect connections succeeded, 10-second soak, zero unexpected closes, all final states matched. Initial snapshot p95 about **3.43 seconds**. |
| Hosted 25-client repeat | All 50 initial/reconnect connections succeeded, 30-second soak, zero unexpected closes, all final states matched. **Performance FAIL:** initial snapshot p95 **13.376 seconds**; reconnect group took **12.821 seconds**. |
| Hosted 1,520 / hosted writers | **NOT RUN.** Stopped escalation after the 25-client latency failure. No real organizer session was supplied or used for writes. Hosted propagation latency was not measured; revision stayed 2 throughout the completed read-only groups. |

The older hosted JSON's `result: PASS` means transport/convergence only. It does **not** override the predeclared 5-second latency criterion. The new read-only runner now explicitly fails when snapshot p95 exceeds 5 seconds or reconnect exceeds 30 seconds. Early reports used floor-index percentiles, which underestimate high percentiles for tiny samples; treat the single-client numbers as diagnostic only. The runner now uses nearest-rank percentiles.

The distinct-actor run recorded **6,081,820 observations**, including 300 reconnect snapshots: propagation p50 **48.42 ms**, p95 **81.77 ms**, p99 **97.44 ms**; initial snapshot p95 **535.69 ms** across 1,820 connections. These are local measurements, not internet latency. Generator RSS ended at about **1.04 GB**; that is the Node measurement process holding millions of samples, not Cloudflare Worker memory.

### Why hosted arrival latency matters

`workers/hall-live/index.ts` wraps every fetch in `blockConcurrencyWhile`. Subscription persists a rate counter, reads four D1 snapshot queries, accepts the socket and queries the outbox/schedules before releasing the serialized operation. This means one slow subscription can queue others. The worsening 5-to-25-client measurements are consistent with this bottleneck; they do not conclusively isolate network, database and queueing time. The local tests have nearby simulated D1, so their much lower timings do not validate hosted connection throughput.

The client reconnects with jitter and closes hidden tabs. It has no HTTP snapshot fallback or application heartbeat; the one-second interval updates display time, not network state. A half-open network can therefore appear connected until the transport notices. Do **not** add arbitrary text heartbeats: the current server deliberately closes application messages with code 1008.

## Event-day quota model

Let N=1,520, U=200 or 4,000, and C be total connection establishments per viewer during the day, including the first. The hall protocol's external Worker request floor is approximately `N*C + U`, plus page loads, auth, conflicts/retries, access checks and other API traffic. DO requests have a similar base plus internal snapshot/access calls and alarms. These are planning estimates, not measured all-day billing.

| Total connections per viewer | 200 updates | 4,000 updates |
|---|---:|---:|
| 1 | 1,720 | 5,520 |
| 10 | 15,400 | 19,200 |
| 20 | 30,600 | 34,400 |
| 50 | 76,200 | 80,000 |
| 60 | 91,400 | 95,200 |

For illustration, adding today's ~27,000 other/account invocation baseline to 34,400 yields ~61,400 before additional page/auth traffic. This is below the 80,000 planning threshold but tomorrow's background traffic can differ. At 50 connections/person, the hall request floor alone consumes the full 80% planning allocation in the 4,000-update case. Frequent tab switching, retries and several devices per participant can invalidate a comfortable-looking estimate based on footfall alone.

Over eight hours, 4,000 updates average 8.33/min total and 0.417/min per organizer. Even a continuously active single DO would use `28,800 seconds * 0.128 GB = 3,686.4 GB-s` (28.36% of the DO duration allowance), with hibernation reducing eligible idle duration. This bound does not cover other account objects.

A normal occupancy update changes seven logical D1 rows across occupancy, revision, audit, guard insert/delete and outbox insert/delete, before index accounting. Thus 4,000 occupancy updates imply roughly 28,000 logical row writes plus indexes, not 4,000 writes and not 6.08 million writes. Each snapshot scans the small hall tables: approximately `1 + occupancy rows + promotion rows + session rows`, plus the outbox query and index/internal scans. Two snapshots occur on successful writes; connections also read snapshots. Budget using actual row metrics. A 50-row snapshot planning assumption with 20 connections/person and 4,000 writes gives roughly 1.92 million snapshot rows before access/index/other queries.

**Update type matters:** promotions replace the whole list. For example, repeatedly deleting and reinserting 20 promotions adds about 40 logical row changes per update before fixed overhead/indexes. Four thousand such changes would exceed 100,000 writes. Occupancy-heavy usage can fit; unrestricted promotion-list churn cannot be promised to fit. DO storage also writes rate counters and alarm state. Static assets served directly are free; dynamic Next HTML and API responses are not all static assets. R2/cache and Images have separate product allowances and were not comprehensively audited here.

## Required work before a strong go decision

1. Address subscription queueing without weakening snapshot/subscribe atomicity. Candidate design: maintain one authoritative cached snapshot in the DO, reconstruct once after wake, update it after committed writes, and avoid repeated remote D1 reads for every subscriber. Validate against outbox/restart and subscribe/write race tests before deployment.
2. Profile the deployed frontend's costly HTML/auth routes against the free 10 ms CPU budget. Confirm account plan and all relevant product usage in Billing; do not upgrade as a testing shortcut.
3. Repeat hosted 25 → 100 → 500 → 1,000 → 1,520 stages only after smaller stages meet latency/error criteria, with current quota headroom and real socket counts. Verify a few authorized occupancy updates through genuine organizer sessions while observers are connected. Use isolated hosted data for destructive lifecycle/load tests.
4. Test at least one actual venue Wi-Fi and mobile connection, phone foreground/background transitions and temporary network loss. Establish an organizer fallback (manual occupancy communication) if the live page cannot reconnect.
5. Limit to one visible hall tab/device per viewer where practical; avoid gratuitous refreshes, promotion reorder churn and deployments during the event. Observe aggregate requests, D1/DO rows, disconnects and errors during the day. Use 80% as an operational warning threshold, not the platform's hard limit.

## Reproduction and artifacts

All commands run from the repository root with installed dependencies. Existing load runners require Node with native WebSocket support (Node 22+; this run used 26.10.0). The two new runners use the already installed `ws`, `esbuild` and Miniflare packages; no dependency installation or paid service was added.

Local full-application commands (use a fresh local state directory; no second runtime against that directory):

```sh
npx wrangler d1 migrations apply hall-live-local --local -c workers/hall-live/wrangler.local.jsonc --persist-to .wrangler/event-load-2026-10-16/state
npx wrangler d1 execute hall-live-local --local -c workers/hall-live/wrangler.local.jsonc --persist-to .wrangler/event-load-2026-10-16/state --file scripts/hall-live/seed.sql
npm run hall:build
npx wrangler dev -c wrangler.hall-local.jsonc -c workers/hall-live/wrangler.local.jsonc --ip 127.0.0.1 --port 8787 --persist-to .wrangler/event-load-2026-10-16/state
# Separate terminal:
npm run hall:test
```

For the existing accelerated load test, stop that runtime and restart with `workers/hall-live/wrangler.load.jsonc` as the second config, retaining the same state directory. Then:

```sh
HALL_URL=http://127.0.0.1:8787 HALL_CLIENTS=1520 HALL_CHANGES=200 HALL_SOAK_SECONDS=120 npm run hall:load
```

It overwrites `/tmp/hall-load-report.json`, uses only a few fixture identities and permanently ends local agenda fixtures. Repeated runs eventually exhaust untouched sessions; use fresh local state. Never point this runner at the hosted site.

Independent local concurrency test (starts and disposes its own loopback-only ephemeral backend, no remote bindings):

```sh
node scripts/hall-live/concurrent-local.mjs 1520 200 /tmp/hall-concurrent-local.json
```

The second argument is rounds: 20 actors each write once per round, in concurrent pairs to two different zones; 200 rounds = 4,000 successful updates plus one successful deliberate race. The initial 20-way same-zone race requires exactly one 200 and nineteen 409s. Rounds are paced at least 1.2 seconds apart. It reconnects 300 clients, verifies exact final state/audit count and soaks 120 seconds. This is neither 20 Google accounts nor an eight-hour browser simulation.

Read-only protocol test (allowlisted staging or loopback only, no cookies/writes, bounded counts/duration, cleanup and failure reports):

```sh
node scripts/hall-live/readonly-load.mjs http://127.0.0.1:8787 25 2 /tmp/hall-readonly-local.json
# Hosted example for a future recheck after resolving latency; consumes shared quota:
node scripts/hall-live/readonly-load.mjs https://devfest-hall-availability-test.gdg-chennai.workers.dev 25 30 /tmp/hall-readonly-hosted.json
```

Raw current-run reports/logs are under `.wrangler/event-load-2026-10-16/` (ignored). The [compact evidence JSON](hall-event-load-evidence-2026-10-16.json) contains the actual run summaries and explicit hosted acceptance verdict. All test runtimes, diagnostic tails and agent-created browser tabs were closed; in-memory test storage was disposed and the fresh local regression state retained for inspection. Logs containing account metadata remain local. Typecheck, hall Worker typecheck and full build passed. Repository lint reports 10 existing errors and 4 warnings; both added scripts lint clean. No application source was changed to force passing tests.
