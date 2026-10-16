# Hall event load acceptance plan — 16 October 2026

Event: 17 October 2026, Chennai. Define these criteria before executing tests.

## Workload and acceptance

- 1,500 participant subscriptions plus 20 organizer subscriptions (1,520 total); one visible tab per person. Test 200 total updates and conservatively 200 per organizer (4,000 total).
- All subscriptions receive an initial snapshot; no unexpected disconnects or unexplained 5xx during normal load. Initial snapshot p95 <= 5 seconds on a paced ramp.
- Every continuously connected subscriber receives every committed revision in order, with identical occupancy, sessions and promotions. No stale overwrites. Target end-to-end update propagation p95 <= 1 second, p99 <= 2 seconds; all observers converge within 5 seconds. These are acceptance targets, not Cloudflare guarantees.
- Twenty simultaneous edits to the same zone/revision must yield exactly one success and nineteen 409 conflicts. No lost updates or extra audit revisions. Different zones may succeed independently. Conflicts require review/refetch, not blind POST retries.
- Reconnect 300 clients during an update; all recover current state within 30 seconds. Verify no permanent gaps for continuously connected clients. Soak at target capacity for at least 120 seconds; this does not substitute for an all-day/venue-network test.
- Verify organizer/lead track scope, anonymous and ordinary-user denial, CSRF, validation, event start/end rules, promotion ordering, persisted restart state and outbox alarm recovery using isolated local fixtures.
- Keep production actor limits (90/minute) in concurrency tests. The existing high-speed sequential load runner uses a raised local-only limit; clearly label it.
- Quota target: planned normal hall traffic plus measured existing account usage stays below 80% of each daily allowance, leaving at least 20% reserve. No upgrade, purchase or deployment.

## Shared-resource boundary and execution order

The supplied hosted frontend shares the production hall Worker, coordinator and D1 database. Hosted reads/connections consume shared quotas; writes change real event data. First inspect official Cloudflare documentation and accessible account usage. Run local tests using local D1/DO storage, never remote migrations/seeding. Existing `hall:load` performs clock, lifecycle and promotion writes even with zero requested changes: do not point it at hosting.

Run local functional tests, then the existing load runner at 1,520 sockets, then a dedicated production-limit concurrency rehearsal. A separate bounded hosted read-only runner may verify connection ramp/soak/reconnect if quota headroom can be established. Stop on unexplained errors, convergence failure or disconnect bursts. Do not invent successful hosted writer/authentication coverage from local fixture tests.

## Evidence and final decision

Save timestamped/raw reports under `.wrangler/event-load-2026-10-16/` and a final human-readable report in `docs/`. Separate current results from historical reports; distinguish socket protocol tests from actual browsers, local runtime from Cloudflare, and estimated usage from measured account counters. Report uncertainty and operational conditions rather than a numerical probability of success without statistical support.
