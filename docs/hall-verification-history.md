# Hall verification history

This consolidates the hall implementation handoffs, acceptance plans, preflight,
UI checks and load reports from 15–16 October 2026. It is a historical record,
not a fresh verification of the current checkout or hosted deployments. Original
reports remain in Git history. All eight original JSON payloads are preserved,
keyed by their former filenames, in [verification evidence](hall-verification-evidence.json).
Embedded paths and report names in that evidence describe the original runs;
private backups and temporary raw logs were never repository artifacts.

Use [hall availability](hall-availability.md) for current behavior, architecture
and local commands, [deployment](deployment.md#hall-live-integration) for rollout,
and [the emergency runbook](hall-emergency-switch.md) for pause/resume operations.
Historical task permissions and handoff instructions are not ongoing authorization.

## Outcome and limits

**The hosted stress scenarios did not establish reliable recovery and delivery.**
Local functional and load checks passed on the tested revisions, but hosted
reconnect deadlines, initial latency and final convergence failed in different
runs. Do not turn a successful socket count into an all-day reliability claim.
The tests used one load-generator machine, not 1,400 rendered browser pages or
venue devices. The source and deployed backend also differed during later tests;
use the deployment identifiers below when interpreting the results.

## Implementation and browser checks — 15 October

The first release used clock-driven events and direct card ordering. Manual
Start/End actions superseded clock-driven lifecycle; the compact overview and
popup editor then replaced full-card super-admin controls and dragging. The
original concept image and older UI screenshots describe those superseded stages.

Local checks exercised actual Next routes, private bindings, D1 and the SQLite
Durable Object: scoped roles, invalid values, forged identities, CSRF, read-only
sockets, stale revisions, concurrent writes, atomic promotions/lifecycle,
subscription/write races, injected publication failure, outbox/alarm recovery,
restart persistence and actor throttling. Model cases included gaps, parallel
tracks, unknown/tied occupancy, skipped/restarted events and no promotion
inheritance. Production access-adapter tests mocked auth/RBAC; they did not
exercise real Google sign-in. The two existing `0014` migrations were retained.

Browser checks covered public/admin desktop and 320/375/390px phone layouts,
lite/full modes, long titles, occupancy updates in a second tab, role-specific
controls, manual transitions, independent recommendations and pins, staged
Up/Down ordering, stale-draft rejection and discard. Dialog checks included
Shift+Tab wrapping, Escape, focus return and schedule → details → Back. Physical
reordering waited while a card held focus/pointer. Timing labels were checked
against planned windows without advancing lifecycle. The final fixture selector
included super-admin, track-scoped admins/leads, ordinary user and signed out.

Some responsive checks used fixed-width iframe documents because viewport
emulation was ineffective. Layout width equaled scroll width; interactions were
exercised in the direct tab. These checks do not establish physical touchscreen
or spoken screen-reader behavior, or a separately configured OS reduced-motion
preference. Initial clock/drag checks are historical, not current product rules.

Retained overview captures: [320px](hall-live-qa/overview/mobile-320.png),
[desktop](hall-live-qa/overview/desktop.png), [popup](hall-live-qa/overview/popup.png).
These are 15 October captures, not screenshots of subsequent features.

App/Worker typechecks, isolated builds and focused lint passed at those stages;
full lint retained 10 errors and 4 warnings. Those dated passes are not a claim
that today's test harness passes. The initial isolated bundle was 1,912.88 KiB
gzip and coordinator 17.74 KiB; production preflight later measured 2,235.12 KiB
and 25.81 KiB respectively. Preflight restored a private production export into
SQLite and checked integrity/additive migrations without changing existing row
counts. Production-mode local checks rejected fixture cookies, exposed no local
identity endpoint and rejected socket writes. No load run was part of preflight.

## Acceptance criteria — defined 16 October

- Workload: 1,500 participant plus 20 organizer subscriptions; evaluate 200
  total updates and the conservative 4,000-update case (200 per organizer).
- Initial snapshot p95 ≤ 5 seconds on a paced ramp; no unexplained 5xx or
  unexpected disconnects. Update propagation p95 ≤ 1 second, p99 ≤ 2 seconds;
  all viewers converge within 5 seconds, with every committed revision received
  in order by continuously connected viewers.
- Twenty same-zone/same-revision edits yield one success and nineteen 409s;
  rejected writes create no audit revision. Different zones may succeed
  independently. Conflicts require refetch/review, not blind POST retries.
- Reconnect 300 viewers during updates within 30 seconds; soak at target
  capacity for at least 120 seconds. Keep the 90-attempts/minute actor limiter
  in concurrency tests; label raised-limit sequential tests separately.
- Verify roles, validation, lifecycle, promotion expiry, persistence and outbox
  recovery locally. Budget normal hall traffic plus other account traffic below
  80% of each daily allowance. These are planning targets, not platform promises.

## Test sequence and results

Dates below are IST; original JSON timestamps retain their recorded timezone.
The evidence column names keys in `hall-verification-evidence.json`.

| Date / phase | Workload | Recorded result | Evidence key |
|---|---|---|---|
| 15 Oct, initial local release | 1,400 viewers; 500 sequential changes; 300 reconnects; 120s soak | PASS; revision 1519; no missed final states or healthy-client broadcasts; propagation p95 121.55ms. One transient denial-probe retry. Clock-driven implementation later superseded. | `hall-live-load-report.json` |
| 15 Oct, manual lifecycle | 1,400 viewers; 500 sequential changes plus clock and two lifecycle writes; 300 reconnects; 120s soak | PASS; revision 2071; no unexpected closes, retries or out-of-order revisions; propagation p95 93.63ms. Audit/guard/outbox checks and restart state matched. | `hall-live-manual-load-report.json` |
| 16 Oct, pre-cache local sequential | 1,520 viewers; 200 regular changes plus clock/two lifecycle writes; 300 reconnects; 120s soak | PASS; propagation p95 64.16ms; raised local actor limit; no final-state gaps or unexpected closes. | `hall-event-load-evidence-2026-10-16.json` |
| 16 Oct, pre-cache local concurrency | 1,520 viewers; 20 synthetic actors; 4,000 commits plus one deliberate race winner; 300 reconnects | PASS; normal actor limit, exactly 19 expected conflicts, 4,001 audit rows; propagation p95 81.77ms; no gaps/regressions/unexpected closes. Backend harness excludes Next/Auth.js. | `hall-event-load-evidence-2026-10-16.json` |
| 16 Oct, pre-cache hosted | First 25-client attempt, then diagnostics and 5/25-client repeats | First attempt timed out at 15s. Five-client repeat passed; 25-client repeat connected/reconnected but initial p95 13.376s failed latency. Escalation stopped; no hosted writes. | `hall-event-load-evidence-2026-10-16.json` |
| 16 Oct, cached local regression | 1,400 simultaneous cold upgrades; injected D1 latency | PASS; one shared cold reconstruction, initial p95 683.15ms; subscribe/write races, failed/ambiguous commits, limiter migration and restart/outbox recovery checked. Separate 1,520-viewer/20-actor soak with 41 commits and 300 reconnects passed (update p95 73.74ms). | Original connection-path report; no dedicated tracked JSON |
| 16 Oct, cached hosted 100 | 100 viewers; 60s hold; reconnect | FAIL; initial 100 held, 98/100 reconnects received snapshots before 15s deadline. No writes or larger stage in this run. | `hall-hosted-100-evidence-2026-10-16.json` |
| 16 Oct, cached hosted 500 | 500 viewers; 60s hold; reconnect; no retries | FAIL; all initial sockets held and answered pings, 497/500 reconnects passed; three TCP establishment timeouts before TLS/HTTP. No writes; cause not localized. | `hall-hosted-500-evidence-2026-10-16.json` |
| 16 Oct, hosted 1,400 read-only | 30s hold; reconnect; at most two retries | Transport/recovery PASS, latency FAIL; all final states matched revision 11, 19 retries, zero unexpected closes; initial retry-inclusive p95 10.850s, reconnect 7.050s. No update propagation measured. | `hall-hosted-1400-readonly-evidence-2026-10-16.json` |
| 16 Oct, hosted organizer-write rehearsal | 1,400 logical viewers; three real organizers; 500 requests offered over 120s; 300 planned reconnects | FAIL; 122 commits (revisions 12–133), 378 conflicts; no 401/403/429/5xx in main run. Convergence failed at 30s after writes and 10s after restoration. | `hall-hosted-e2e-evidence-2026-10-16.json` |
| 16 Oct, realistic five-minute rehearsal | 1,310 anonymous protocol viewers; two organizer edits at 60/210s; 300s hold | Not a clean reliability pass; both writes committed (140/141), all final observers reached 141, but 3/1 remained stale after respective 30s delivery checks. Continuous-viewer propagation p50/p95/p99 3.37/5.21/9.55s. | `hall-realistic-five-minute-evidence-2026-10-16.json` |

Local generator/emulator shared hardware; timings include HTTP/Next/D1/DO and
generator work where present, and do not establish hosted CPU or network limits.
Initial and manual sequential runs used raised local-only write limits. Historical
transport-only `PASS` values do not override the declared latency criteria.

## Hosted interpretation and restoration

All hosted tests targeted `devfest-hall-availability-test.gdg-chennai.workers.dev`,
which shares the private `devfest-hall-live` backend and production D1. Cached
backend version `6431b79a-0023-4730-b86c-6f27d28bfe8e` (implementation commit
`f1221158854e07e4386b0d93f09c6b4efe8e9f57`) was checked at 100% traffic for the
100/500/1,400 stages. Frontend version `26b39bc1-d214-46b6-9c16-3da53b780eb8`
was inspected for the 500/E2E runs; a local backend reversion was not deployed.
The private service has no public hostname; frontend `/api/halls/socket` forwards
through `HALL_PUBLIC`, while authenticated writes use named `HallControl`.

The 1,400-viewer baseline's successful-attempt initial p95 was 10.759s; TLS alone
was 9.737s. Delay therefore cannot all be called D1/application latency. The
single generator, transit and edge were not isolated. No server CPU/quota
telemetry was captured for that baseline.

Three E2E starts aborted before writes when all-viewer ping gates failed;
initial responders were 1,383/1,321/1,204, with the third improving to 1,392 after
repair. The final run passed 1,400/1,400 before writes and recorded 18 socket
retries. Two actors edited the same hall, intentionally creating optimistic
conflicts: the 378 rejected writes were not accepted updates lost by the server,
and do not establish a general throughput ceiling. Planned reconnects reduced
open viewers to 1,100 temporarily. The failed convergence assertion prevented
saving final revision distributions/propagation samples; exact stale counts and
viewer p95/p99 are unavailable. The recorder was fixed locally, without another
high-load write run. HTTP response timings are not viewer delivery timings.

E2E cleanup restored `d7-auditorium` to 48% at revision 134; `agent-wars` already
held 11%. A low-load probe initialized nine of ten viewers and delivered no-op
restoration revision 135 to those nine; its three diagnostic edits did not run.
Independent snapshot/D1 checks confirmed original values and unchanged sessions,
promotions and clock. All sockets/tails closed; audit rows and updated timestamps
remained. No whole-database restore or audit deletion was performed.

The final five-minute run recorded 64 close events during hold and 151 during
setup, sampled as abnormal 1006. The first-100 detail cap was exhausted during
setup: 64/1,310 is not a measured unique-user failure rate. Final five-second ping
responders were 1,237 with 1,309 sockets open; a ping timeout alone does not prove
closure. Final HTTP checks and automatic restoration timed out. Independent
organizer cleanup restored 48%/11% at revisions 142/143; snapshot verification
confirmed unchanged lifecycle/promotions/clock, and D1 showed an empty outbox
before cleanup. Earlier attempts, setup failures and an aborted batched setup
remain in the evidence. One earlier five-minute attempt delivered both writes
but used the older 14-close recovery cutoff, limiting its recovery conclusion.

## Quota observations and remaining limits

The model uses `viewers × total establishments per viewer + writes`, then adds
page loads, auth, checks, retries/conflicts and other traffic. Idle viewers do
not poll; the one-second timer is local. For 1,310 viewers, 20 establishments
per day and 100 edits, the hall floor was approximately 26,300 external requests.
Adding 40,000 other requests and five additional counted requests/person yielded
72,850 against a hypothetical 100,000/day allowance. This is a bounded planning
scenario; subscription/billing status was not verified. A continuously active
single 128MiB object for ten hours models 4,608 GB-s, excluding other objects.
Promotion-list replacement and rate-counter writes need separate row budgeting.

Account analytics through 16 Oct 15:56 UTC showed conservative Worker invocation
sum 75,070 (including internal calls), D1 reads/writes 77,890/1,963 and DO SQLite
reads/writes 70,122/16,727, with zero recorded DO CPU/memory-limit/fatal-internal
errors. Analytics can be delayed/sampled and are not an exact billing ledger.
Earlier mixed frontend traffic had CPU p95 190.332ms, not a socket-route profile;
this did not establish Free-plan CPU compliance. Early diagnostic windows also
contained unexplained exception records; an empty filtered tail did not resolve
them. Daily limits reset at 00:00 UTC / 05:30 IST in the recorded planning model.

No eight-hour/all-day soak, physical venue Wi-Fi/mobile reliability, forced
hosted eviction or hosted slow-reader assurance was established. Workers exposes
no `bufferedAmount`; strict application-side slow-reader accounting remained a
limitation. Follow-up priorities were bounded snapshot timeout, compatible
liveness/reconciliation and recovery validation. The later emergency switch adds
an initial/disconnected 20-second Agenda fallback but does not detect a healthy-
looking half-open socket after its first snapshot; see the runbook.

## Reproduction

Keep hosted credentials/backups/raw tails private. Hosted readers consume shared
quotas and writers change production hall data; historical commands are not
permission to run a new hosted load test. Never target hosting with `hall:load`:
it performs clock, lifecycle and promotion writes even with zero requested changes.

For isolated setup and integration checks, follow [hall availability](hall-availability.md#reproducible-checks).
Additional local backend regressions start/dispose their own runtime; do not
attach a second runtime to the same persisted state directory:

```sh
node scripts/hall-live/arrival-local.mjs 1400 /tmp/hall-arrival-local.json
node scripts/hall-live/concurrent-local.mjs 1520 200 /tmp/hall-concurrent-local.json
node scripts/hall-live/readonly-load.mjs http://127.0.0.1:8787 25 2 /tmp/hall-readonly-local.json
```

For `concurrent-local`, 200 rounds means 20 actors × 200 writes plus one race
winner, paced at least 1.2s per round. It excludes Auth.js and Next rendering.
The retained `hosted-writer-preflight.mjs`, `hosted-e2e.mjs` and local
`hosted-e2e-smoke.mjs` contain writer validation/recorder tooling; no script or
application source is changed by this documentation cleanup.
