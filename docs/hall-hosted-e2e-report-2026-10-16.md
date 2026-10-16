# Hosted organizer-write rehearsal — 16 October 2026

**Result: FAIL for the requested 500 committed updates in two minutes with 1,400 viewers.** Three real organizer sessions validated successfully. The main run submitted exactly 500 authenticated requests in the 120-second offered-load window: **122 committed and 378 returned HTTP 409 revision conflicts**. There were no 401/403, 429 or HTTP 5xx responses in the main run. Final viewer convergence failed its deadline, so this is not a successful end-to-end delivery assurance.

## Target and scope

Public target: `https://devfest-hall-availability-test.gdg-chennai.workers.dev`. Requests used the normal authenticated `/api/admin/halls` route, Auth.js permission checks, private hall service, real D1 writes and public WebSockets. No Google login load, forged sessions, actor headers, role grants or rate-limit changes were used. All three supplied cookies worked; none were skipped. Credentials were read from private local files and excluded from logs, reports and Git.

The backend was confirmed at deployed version `6431b79a-0023-4730-b86c-6f27d28bfe8e`. Read-only inspection of frontend version `26b39bc1-d214-46b6-9c16-3da53b780eb8` confirmed both hall service bindings point to `devfest-hall-live` production, with `HallControl` for writes and the default entrypoint for public sockets. No deployment occurred during this rehearsal. The unrelated local backend source reversion was preserved.

A private hall-table backup was exported before writes. Only already measured halls were updated: `d7-auditorium` and `agent-wars`. Values alternated between their starting value and one percentage point higher (or lower at 100%). Lifecycle, clock, promotions and permissions were untouched. Two of the three organizers wrote the same hall, deliberately exercising revision conflicts under overlapping edits. This workload is not 500 independent nonconflicting hall changes.

## Connection setup and test-driver validation

The runner was linted and checked against an isolated real workerd/D1/DO fixture using the committed coordinator, including audit accounting, reconnects, every-revision checks, restoration and a forced setup disconnect. Local fixture authentication is limited to that generated local harness and was never deployed.

Three hosted starts were stopped before any organizer mutation because the all-viewer health gate failed. They initialized 1,400 snapshots but initially observed 1,383, 1,321 and 1,204 ping responders respectively. The third improved to 1,392 after bounded repairs and still stopped. The detailed second start recorded abnormal 1006 closures and one ECONNRESET, not an application policy close. These failures are retained in the evidence and must not be erased by the later run.

The driver initially retried only establishment failures, then was corrected to recover initialized sockets during setup as the application does, without restarting the whole group. The final run initialized all 1,400 and passed a fresh 1,400/1,400 protocol ping check before sending writes. It recorded 18 automatic socket retries across setup and the planned reconnect phase. This driver change does not establish a server-side fix for the earlier disconnects.

## Main write window

Run ID: `c2995ffb-cf60-4962-96cf-14206a64fb29`.

- 500 offered slots and **500 submitted POST requests**, paced over 120 seconds; no skipped slots or hidden retries.
- **122 HTTP 200 responses / committed audit rows**, from three distinct actors, revisions **12–133**.
- **378 HTTP 409 responses**; no audit revision was created by those rejected writes.
- 120 successful responses were confirmed by the end of the 120-second window. Including outstanding response drain, the window lasted **121.834 seconds**.
- At the midpoint, 300 viewers were deliberately disconnected/reconnected; all 300 reinitialized in **16.950 seconds**. During that planned outage, the open-viewer minimum was 1,100. The test therefore represents 1,400 logical viewers with a reconnect surge, not 1,400 uninterrupted sockets for every instant.
- Zero unexpected closures or state regressions were recorded during the final run.
- The all-viewer final revision check failed after **30 seconds** following the writes. A second check failed after **10 seconds** following restoration.

The 409s are optimistic-concurrency protection: requests carried a zone revision that an earlier committed edit had already superseded. They are not accepted updates silently lost by the server. The burst generator allowed overlapping requests from three actors on two halls; current UI behavior and coordinated track ownership differ from this stress pattern. These results cannot be treated as a general maximum of 122 independent updates per two minutes, or as proof that ordinary 250-per-day usage will produce the same conflict fraction.

**Measurement limitation:** the failed convergence assertion aborted before per-viewer final revision distributions and propagation samples were saved. The exact number of stale viewers and the end-to-end update p95/p99 cannot honestly be reported for this run. This recording gap was fixed afterward and locally checked, but the high-load write run was not repeated. Organizer HTTP response timings in the JSON evidence are not viewer-delivery timings.

## Restoration and follow-up check

The normal organizer API restored `d7-auditorium` to **48%**, creating revision **134**. `agent-wars` already held its original **11%** value. A subsequent low-load publication probe attempted ten viewers; one failed initial establishment, while all nine established viewers received a no-op restoration revision **135**. Its three planned diagnostic edits were not executed because establishment failed first. This confirms a basic publication path at low load, not reliable publication to 1,400 viewers.

Independent final snapshot and D1 audit checks confirmed:

- Occupancy values **48% and 11% restored**.
- Sessions, promotions and clock unchanged.
- Exactly 122 main test commits, one guarded restoration and one subsequent no-op probe commit. Final revision **135**.
- All generator sockets closed. Error-tail sessions terminated or expired normally. No app exception/resource error was captured by the error-filtered tails; these are not complete request, disconnect, CPU or quota telemetry.

Audit history and refreshed occupancy timestamps remain, as expected from real authorized writes. No audit rows, measurements or revisions were deleted/reset, and the whole database was not restored.

## Interpreting the earlier ten-second startup number

The earlier single-machine 1,400-at-once protocol run measured first-snapshot median **8.178 seconds** and p95 **10.759 seconds** across successful attempts; retry-inclusive p95 was **10.850 seconds**. TLS completion alone had p95 **9.737 seconds**. Much of the delay occurred before reaching the application, so the number is not a ten-second D1 snapshot query for every user. It also is not a browser page-load measurement.

It is still a real startup concern: the current UI waits for its first WebSocket snapshot, so users under an equivalent burst can see a several-second initial wait. Smaller bursts were faster, and distributed participant devices may behave differently from one generator creating 1,400 TLS connections. Venue network behavior remains unverified; do not promise an instantaneous first result based on this data.

## Decision and artifacts

Do not sign off on the requested stress scenario from these results. Before another hosted high-load write run, use the corrected per-viewer recorder to locate stale clients and correlate publication with server/network evidence. Avoid extrapolating a definitive infrastructure cause or purchasing an upgrade based solely on these incomplete convergence measurements.

[Sanitized evidence](hall-hosted-e2e-evidence-2026-10-16.json) preserves every hosted start, successful-write audit counts, response timing summaries, final value checks and low-load probe results. Complete raw job records remain at `/tmp/hall-hosted-e2e-1400-500-final.json`; private database backups, raw tails and deployment settings stay outside Git. Session cookies are not part of any artifact.
