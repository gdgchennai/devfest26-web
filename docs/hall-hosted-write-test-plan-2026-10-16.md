# Hosted organizer-write rehearsal — preparation, 16 October 2026

**Status: executed; the requested stress scenario failed.** All three supplied organizer sessions validated. See [the results](hall-hosted-e2e-report-2026-10-16.md) for 122 commits, 378 conflicts, failed convergence checks and verified restoration. The remaining text records the original plan. The user authorized 1,400 anonymous viewers and 500 occupancy updates offered over 120 seconds, using at least three existing organizer identities. The public frontend and private backend share production hall data.

## Authentication and scope

`GET /api/admin/halls` must validate every supplied Auth.js session, enforce distinct actor IDs and confirm permission on the selected measured zone. The production limit remains 90 attempted writes per actor per minute. Three evenly used actors offer about 83.33 writes/minute each, leaving limited allowance for retries/conflicts. Independent tabs/cookies for one actor do not increase its allowance.

No local fixture roles, forged sessions/headers, new roles, limiter changes or private-service bypass may be used for the hosted writer. This is a real authenticated frontend-to-backend test. Keep Google credentials, OAuth tokens and session cookie values out of chat, arguments, logs, reports and Git.

A private template exists at `/home/headhit/.local/state/devfest-hall-load/organizers.json` with three relative cookie paths, `organizer-1.cookie` through `organizer-3.cookie`. The directory is mode 0700 and the manifest mode 0600. Each supplied cookie file must be mode 0600 and contain one Cookie header line from that account on the availability hostname, including all chunked Auth.js session token pieces. The preflight forwards only Auth.js session cookies.

```sh
node scripts/hall-live/hosted-writer-preflight.mjs /home/headhit/.local/state/devfest-hall-load/organizers.json
```

This command is read-only. It reports sanitized actor references and permission scope, never cookies. It initially stopped because no cookie files were supplied; the later supplied files all validated. It now skips invalid/inaccessible entries and continues with usable distinct organizers, without bypassing permissions or rate limits. The in-app browser's admin page showed Sign in required.

## Required execution sequence

1. Recheck the deployed backend version and real organizer permissions. The expected cached-snapshot version is `6431b79a-0023-4730-b86c-6f27d28bfe8e`. The local backend source has an unrelated working-tree reversion to the earlier implementation; preserve it and do not deploy it accidentally.
2. Immediately before writes, privately preserve current hall state/database backup and exact measured occupancy values/revisions. Use only already measured zones accessible to the supplied organizers; the public API cannot remove a newly created measurement to restore Unknown.
3. Connect 1,400 anonymous viewers, with bounded initial/reconnect retries using the client's exponential backoff and jitter. Do not begin writes until all 1,400 have valid state. Record raw attempt failures separately from successful recovery and user-perceived ready times.
4. Offer 500 authorized occupancy changes at approximately 4.167/sec for 120 seconds, distributed over at least three distinct actors and their permitted zones. Keep lifecycle, clock, recommendations and promotions untouched. Bound outstanding requests; record any backpressure or skipped/deadline-limited slots. The test measures whether the service can sustain this rate: do not stretch the window and label that as 500 writes in two minutes.
5. Use expected zone revisions and normal Origin checks. Record successful commits, latency, conflicts, 429/Retry-After, 5xx, timeouts and ambiguous outcomes. Never blindly replay a timed-out POST: reconcile it with authoritative state/audit before deciding whether another mutation is appropriate. A 500-attempt run is not automatically 500 committed updates.
6. For continuously connected viewers, track every committed revision and propagation p50/p95/p99. For reconnecting viewers, track convergence to latest state and recovery duration separately. Check final content, not just revision or socket-open state. Read-only connection success does not establish write propagation.
7. Stop on authorization failures, unexplained sustained service errors, revision regressions, unexpected external edits or deadline/bounded-queue exhaustion. Preserve evidence of pending/ambiguous operations and let them settle before restoration.
8. Restore only test-touched occupancy values through the normal API with guarded expected revisions. If a later external edit is detected, preserve it and report a restoration conflict. Restoration creates new revisions/timestamps/audit rows; do not erase audit history, reset revisions or restore the whole database.
9. Close all viewers and tail sessions. Report attempted versus committed versus delivered updates, actual write-window duration, retries, errors, restoration and any residual changes. No hosted readiness assertion without these results.

## Preparation checks actually performed

- Confirmed the expected backend deployment remains at 100% traffic.
- Public snapshot returned revision 11 with measured zones `d7-auditorium` and `agent-wars`.
- Verified the current browser session is anonymous on `/admin/halls`.
- Prepared and linted the read-only organizer authentication/permission preflight; verified it stops safely when the first cookie file is absent.
- A separate authorized 1,400-viewer read-only retry baseline completed while awaiting credentials. All 1,400 initial viewers and reconnects became responsive and converged after bounded retries. Seventeen initial attempts and two reconnect attempts needed one retry. The 30-second hold had no unexpected closes. Overall latency acceptance failed: successful initial snapshot p95 was 10.759 seconds, above the five-second target; retry-inclusive ready p95 was 10.850 seconds. This is not the organizer-write rehearsal, performs no application writes and does not establish update propagation.
