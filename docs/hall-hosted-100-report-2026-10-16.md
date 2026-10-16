# Anonymous hosted hall test — 16 October 2026

**Stopped at the authorized limit of 100 concurrent public users. Overall result: FAIL in the 100-client reconnect phase.** All 100 initial connections succeeded and remained connected during the full 60-second hold; 98 of 100 reconnects received their initial snapshot, and two hit the 15-second deadline. No larger test or retry was run. All generator sockets were closed.

## Deployment and Git

Connection-path implementation commit: `f1221158854e07e4386b0d93f09c6b4efe8e9f57`, pushed to `codex/hall-availability-test`.

The private `devfest-hall-live` Worker was deployed directly from its own config. Version `6431b79a-0023-4730-b86c-6f27d28bfe8e` was confirmed at 100% traffic using Wrangler deployment history. This service is shared by the availability frontend and production; the frontend itself was not rebuilt or deployed. No migration, seed, role grant, authentication change, paid-plan change or hosted application mutation was performed. Existing unrelated working-tree edits were retained outside the implementation commit.

Target: `https://devfest-hall-availability-test.gdg-chennai.workers.dev`. Workload: anonymous public WebSocket viewers. Google sign-ins are separate and were not part of this test.

## Measurements

| Stage | Initial connections | Hold | Reconnects | Snapshot p95 | Result |
|---|---:|---:|---:|---:|---|
| Preflight | 1/1 | 1 second | 1/1 | 1.467 s | PASS |
| 25 simultaneous arrivals | 25/25 | 15 seconds | 25/25 | 1.660 s | PASS |
| 100 simultaneous arrivals | 100/100 | 60 seconds | 98/100 | 1.900 s | FAIL: reconnect timeout |

Each stage issued all initial upgrades concurrently, and all reconnect upgrades concurrently after closing the old sockets. Snapshot percentiles combine successful initial and reconnect establishments. The failed reconnects are excluded from those latency samples; the p95 is therefore **not a success-rate guarantee**. The 100-client stage has 198 successful samples, p50 1.461 s and p99 2.491 s. Total elapsed time was 83.217 s.

The 25-client reconnect group completed in 1.810 s. The 100-client reconnect group did not fully complete, so no successful group completion latency or final convergence count is claimed. HTTP snapshot reads returned 200. No HTTP upgrade rejection status was captured for the two failures. The 100-client report records two transport errors and three abnormal 1006 closes during failure/cleanup; 1006 alone does not identify the server or network cause. There were zero unexpected closes during the successful initial hold. Cleanup left zero sockets in every stage.

The two fully completed stages converged to revision 11. The 100-client stage started at revision 11; no state regressions or revision gaps were observed, but its failure prevented the runner's final convergence check. The runner sent no cookies and performed no writes. These read-only runs do not measure update propagation. No server-side CPU, quota or exception telemetry was captured for this execution, so a specific cause for the failed reconnects is not established.

## Interpretation

The earlier hosted 25-client snapshot p95 was 13.376 s; this run measured 1.660 s at 25 and 1.900 s across successful establishments at 100. This is consistent with removal of the per-subscriber serialized D1 work. Tests occurred at different times and are not a controlled network benchmark.

The old startup-latency bottleneck is substantially improved, and maintaining 100 connected anonymous viewers was demonstrated for 60 seconds. Reliable reconnects at 100 have **not** passed the acceptance criteria. The implementation must not be described as fully validated for 100, or extrapolated to 1,400 hosted users. The next investigation should capture underlying handshake/socket errors and server-side events during a separately authorized bounded reproduction; increasing deadlines alone would conceal rather than explain failures.

## Evidence and reproduction

[Raw evidence](hall-hosted-100-evidence-2026-10-16.json) preserves the three runner reports and deployment identity. The local originals remain in `/tmp/hall-hosted-cached-1.json`, `/tmp/hall-hosted-cached-25.json` and `/tmp/hall-hosted-cached-100.json`.

Commands actually run, sequentially, with escalation only after a passing stage:

```sh
node scripts/hall-live/readonly-load.mjs https://devfest-hall-availability-test.gdg-chennai.workers.dev 1 1 /tmp/hall-hosted-cached-1.json 1
node scripts/hall-live/readonly-load.mjs https://devfest-hall-availability-test.gdg-chennai.workers.dev 25 15 /tmp/hall-hosted-cached-25.json 25
node scripts/hall-live/readonly-load.mjs https://devfest-hall-availability-test.gdg-chennai.workers.dev 100 60 /tmp/hall-hosted-cached-100.json 100
```
