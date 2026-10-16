# Hall connection-path change — 16 October 2026

This implementation follows the earlier readiness assessment. It addresses its serialized connection-startup bottleneck. It has **not been deployed or verified under hosted load**.

## Gate review and design

Previously `fetch()` wrapped every request in `blockConcurrencyWhile()`, and `alarm()` separately used the same mechanism. Each subscriber waited for a persistent limiter update, four sequential remote D1 queries, an outbox query and alarm maintenance before returning its upgrade. Twenty-five simultaneous arrivals therefore repeated 125 remote queries in the globally blocked path.

Cloudflare's input/output gates protect operations on the DO's own storage. They do not turn external D1 calls into atomic operations with the DO's in-memory state or WebSocket membership. Removing the old lock without changing the snapshot/read/subscribe sequence would allow a write to publish between a snapshot read and socket registration, losing that update for the new socket.

The replacement has one `blockConcurrencyWhile()` call site: shared lazy initialization once per DO instance, including after hibernation. It rebuilds the current committed snapshot in a transactional D1 batch and recovers any pending outbox. D1 remains persistent truth. All application hall writes must continue through the named coordinator; direct database writes while it is awake are unsupported because they bypass cache invalidation.

Regular writes and alarms share a failure-tolerant promise queue. This protects expected-revision validation, D1 commits and outbox cleanup from other writers/recovery while allowing subscriptions during remote I/O. Each write reads fresh D1 state, retaining the revision guard and reconciling an earlier ambiguous commit. The cache is replaced only by a successful persistent read, including the read after a successful commit. A pre-scheduled alarm recovers post-commit read/publication failures.

The two critical sections contain **no await**:

1. Read current cache → register socket → send initial snapshot.
2. Install committed cache → broadcast to registered sockets.

If registration occurs first, the socket receives the broadcast; if publication occurs first, the initial snapshot includes it. During remote I/O a viewer may initially receive the previous committed revision, followed by the new broadcast. JavaScript run-to-completion provides atomicity for these sections. D1 I/O, request body reads, permissions and outbox cleanup do not need a global event-delivery lock.

Public snapshots refresh `serverNow`, retaining the local frozen clock behavior. Subscribers do no D1 queries and no alarm maintenance. Durable rate counters use synchronous DO SQLite read/check/write and output-gate durability, preserving thresholds and automatically importing the previous KV counters once. No new dependency, D1 migration, binding, environment variable or namespace migration is required; the rate table is created in the existing SQLite-backed DO.

References checked on 16 October 2026: [DO state / blockConcurrencyWhile](https://developers.cloudflare.com/durable-objects/api/state/), [SQLite storage and gates](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## Validation

- Root and hall Worker TypeScript checks pass.
- Changed source and new harness pass ESLint. Repository lint retains 10 unrelated errors and four warnings; no new problems.
- Full local Workers API suite passes: permissions, validation, revision conflicts, promotions, lifecycle, subscribe/write race, alarm recovery, read-only sockets, CSRF and actor throttling.
- Backend dry-run bundle: 88.43 KiB uncompressed / **26.32 KiB gzip**; no deployment performed.
- `node scripts/hall-live/arrival-local.mjs 1400`: **PASS**, all 1,400 upgrade requests issued without batching or ramp delays, one shared cold D1 snapshot reconstruction, initial snapshot p50 **660.40 ms**, p95 **683.15 ms**, p99 **684.95 ms**. The harness injects 75 ms waits into D1 batches and additional snapshot-read latency. This is a concurrency regression, not an emulation of all Cloudflare networking.
- The arrival harness also connects 100 additional clients during a deliberately suspended writer, verifies one winner/19 conflicts for simultaneous same-zone writes, verifies failed commits never enter the cache, recovers a committed write after an injected post-commit read failure, verifies the queue remains usable after errors, migrates legacy rate counters and preserves limits/state across a persistent runtime restart with an outstanding outbox. Zero unexpected closes, regressions or observed revision gaps.
- A separate 1,520-client, 120-second soak with 20 actors, 41 successful writes and 300 simultaneous reconnects passed; every final snapshot matched, with zero unexpected closes, regressions or gaps. Its initial p95 was 157.68 ms and update propagation p95 73.74 ms across 62,620 observations. This runner ramps arrivals and is distinct from the simultaneous cold-burst harness.

Reproduction uses installed dependencies and isolated local state:

```sh
node scripts/hall-live/arrival-local.mjs 1400 /tmp/hall-arrival-local.json
node scripts/hall-live/concurrent-local.mjs 1520 2 /tmp/hall-concurrent-cached-soak.json
npm run hall:check
npx tsc --noEmit
npm run lint
npx wrangler deploy --dry-run -c workers/hall-live/wrangler.jsonc
```

The harness generates test-only subclasses/RPC hooks and fault injection in memory; these are not part of the deployable Worker. Synthetic actors bypass Auth.js only at the harness's trusted backend boundary. The target workload is anonymous public viewers: WebSocket access requires no sign-in. Google authentication is handled separately and is outside this workload. These backend measurements also exclude Next page rendering.

## Hosted verification remaining

The source change is confined to the private hall backend. A deployment must use `workers/hall-live/wrangler.jsonc`; there is no need to deploy the isolated frontend build. The frontend test hostname still shares the backend and D1 with production, so a backend deployment affects both.

After authorized deployment, repeat bounded read-only hosted stages at 25, 100, 500 and 1,400 clients, stopping on latency/error/convergence failure. Keep the existing p95 initial snapshot target of five seconds. Observe route-level timing, actual sockets, D1 reads, DO CPU/errors and quota headroom. Include a few authorized occupancy writes while readers join/reconnect. Capacity and venue-network reliability remain unverified until these hosted checks pass; longer client deadlines alone are not the remedy.
