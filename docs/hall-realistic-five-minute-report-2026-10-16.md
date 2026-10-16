# Five-minute realistic hall test — 16 October 2026

Result: not a clean reliability pass. Quota headroom is adequate for the modeled event, but prompt connection recovery is not demonstrated.

Target: https://devfest-hall-availability-test.gdg-chennai.workers.dev. Deployed cached backend unchanged. No application changes, deployment or push performed.

1,310 anonymous protocol sockets represent 1,300 participants plus 10 organizer-equivalent socket slots. Three supplied real organizers validated; two distinct organizers performed two occupancy changes at 60 and 210 seconds. The measured hold lasted 300.000 seconds. These are not 10 authenticated organizer sessions or 1,310 browser page loads.

Both writes committed (revisions 140 and 141), with no 409/429/5xx write responses. All 1,310 observers held revision 141 at cleanup. The first/second delivery checks still had 3/1 stale viewers after 30 seconds following the HTTP response. Continuous viewers: 1251; missed committed revisions: 0; send-to-receipt p50/p95/p99: 3.37/5.21/9.55 seconds. This includes HTTP request/commit and network transit, not server-only latency.

There were 64 close events during the hold and 151 during setup, all from one load-generator machine. Recorded close samples are abnormal 1006; the first-100 detail cap was exhausted during setup, so the precise number of distinct users affected during the hold is unavailable. Do not label 64/1310 as a measured unique-user failure rate. All initialized, but setup ping responders were 1231, 1233 and 1269 after repair rounds; final five-second ping sample was 1237 with 1309 sockets open. Ping timeout is not itself proof a connection closed. Final authoritative HTTP checks timed out, including the runner's automatic restoration attempt. No definitive cause has been localized to Cloudflare, server code or the generator/network.

The previous five-minute attempt delivered both writes to all viewers but retained a 14-close recovery cutoff from the old stress harness, making its restoration delivery failure unsuitable as a pure application-recovery result. Its evidence is retained. The final repeat allowed recovery through the hold, with bounded per-client retries. Initial setup retries, setup failures and the aborted batched setup are not erased.

Cleanup: all test sockets closed. Independent normal organizer API cleanup restored both measured values to 48% and 11% at revisions 142/143. Public snapshot verified restoration and unchanged sessions/promotions/clock. Audit records and updated timestamps remain. D1 confirmed the two test commits and an empty outbox before cleanup. No whole-database restore or audit deletion occurred.

## Daily request model

Idle viewers do not poll. A successful upgrade counts once; outgoing broadcasts add no request units. The one-second display timer is local. Hidden tabs close their sockets and re-establishment adds usage.

With 1310 people, 20 total establishments/person/day (including first connection) and 100 edits: approximately 26,300 hall external requests. Add page loads and all other APIs. A planning example with 40,000 other requests and 5 additional counted page/API requests/person totals 72,850 against a hypothetical Workers Free 100,000/day allowance. This is a bounded scenario, not a guarantee of arbitrary traffic. Actual Workers billing plan remains unverified. One continuously active DO for 10h uses at most 4,608 GB-s; hibernation reduces eligible idle duration and this estimate excludes other objects.

Latest account analytics through 2026-10-16T15:56:00Z: conservative Worker invocation sum 75,070, including internal service calls; D1 reads 77,890, writes 1,963; DO SQLite reads 70,122, writes 16,727. Zero recorded DO CPU/memory-limit or fatal-internal errors. Analytics are delayed/sampled and not an exact billing ledger. Today's testing shares production/account resources. Daily free limits reset at 00:00 UTC / 05:30 IST.

Next priority: bounded first-snapshot timeout, compatible liveness checks and state reconciliation; then validate recovery. A request-budget increase alone does not address the observed failures.
