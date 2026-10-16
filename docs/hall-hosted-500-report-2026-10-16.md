# Anonymous hosted hall diagnostics at 500 users — 16 October 2026

**500 initial connections passed; 497/500 reconnects passed. Overall strict result: FAIL for three TCP connection timeouts.** All 500 initial sockets remained open for the 60-second hold, responded to protocol ping/pong at both ends of the hold, and matched the authoritative HTTP snapshot. Every successful reconnect also answered a ping and matched the final snapshot. No automatic retries or application writes were performed. All sockets and live-tail sessions were closed afterward.

## Which deployment was tested?

Public page: [Live](https://devfest-hall-availability-test.gdg-chennai.workers.dev/live), confirmed HTTP 200 during this run. Public WebSocket URL: `wss://devfest-hall-availability-test.gdg-chennai.workers.dev/api/halls/socket`.

The public frontend forwards `/api/halls/socket` through its `HALL_PUBLIC` service binding to the private `devfest-hall-live` Worker, which routes `/socket` to the named `HallCoordinator`. The backend's config has `workers_dev: false` and `preview_urls: false`, so its deployment has no public URL. It remains callable over service bindings. Only this backend changed in the preceding deployment; there was no new frontend deployment or frontend preview URL.

Wrangler deployment history confirmed backend version `6431b79a-0023-4730-b86c-6f27d28bfe8e` at 100% traffic. Live backend tail records during this test carried that same version. Frontend tail records carried existing version `26b39bc1-d214-46b6-9c16-3da53b780eb8`. The backend deployment contains implementation commit `f1221158854e07e4386b0d93f09c6b4efe8e9f57`. No further deployment or application change was needed for these diagnostics.

## Results

| Measurement | Initial arrivals | Reconnects |
|---|---:|---:|
| Simultaneous attempts | 500 | 500 |
| Valid initial snapshots | 500 | 497 |
| Failed establishments | 0 | 3 |
| Successful snapshot p50 | 2.479 s | 1.866 s |
| Successful snapshot p95 | 2.562 s | 2.472 s |
| Successful snapshot p99 | 2.637 s | 3.128 s |
| Protocol ping/pong responders | 500 at hold start and end | 497 |
| Matching current state | 500 after hold | 497 after reconnect |

The 500 reconnects were issued together after closing all 500 old sockets. Reconnect completion including the failed deadlines took 15.025 seconds. Total run time was 94.210 seconds. No unexpected disconnects, state regressions or revision gaps were observed. Revision remained 11. Latencies exclude the failed attempts; acceptance still fails for those three even though latency p95 meets the five-second target. Generator RSS was approximately 193 MB; event-loop delay p99 was 21.09 ms and maximum 154.66 ms.

The workload is public anonymous viewers, with matching Origin headers and no cookies. It does not involve Google authentication. Protocol ping frames are transport control frames, not application text messages; they do not invoke the server's read-only application-message rejection. Since no application mutation occurred, update propagation under hosted writes was not measured.

## What caused the failures?

The detailed runner captures socket allocation, DNS lookup, TCP connect, TLS completion, HTTP 101 upgrade and first valid snapshot separately. All three failed attempts were in the reconnect phase:

| Client | DNS finished | TCP connected | TLS / HTTP upgrade | Outcome |
|---|---:|---|---|---|
| 85 | 149.94 ms | No | Not reached | 15-second deadline |
| 102 | 182.17 ms | No | Not reached | 15-second deadline |
| 112 | 199.88 ms | No | Not reached | 15-second deadline |

DNS completed without error. None of these sockets emitted a TCP connect event, TLS completion or HTTP upgrade response. The cause of these failed attempts is therefore **TCP connection establishment stalling before TLS and before the request can reach either Worker**. The timeout's generic “initial snapshot deadline” label covers the entire establishment sequence; it does not mean the DO spent 15 seconds preparing a snapshot.

This locates the failure below the application/D1/subscription path. It does not identify which network hop dropped or delayed connection establishment: the generator's network/NAT path, transit or Cloudflare's TCP edge remain possibilities. Pinpointing that requires packet/network evidence or a controlled test from another network. The original two failures at 100 clients lacked these phase timings, so their exact cause remains unproven; the new reproduction is consistent with the same transport issue but is not retrospective proof.

Successful connections were checked beyond socket-open state: all 500 original sockets and all 497 successful reconnects answered protocol pings and converged to freshly fetched state. Their observed transport/state checks passed. The overall run still fails the requirement that every reconnect succeeds without a retry. The application's existing jittered reconnect behavior may recover transient network failures; this runner intentionally disabled retries, so recovery was not measured or assumed.

## Server logs and their limits

Both frontend and backend were tailed during the run. The captured backend events all identified the deployed backend version, and neither tail contained an exception. Frontend tail reported sampling due to event volume: captured logs are not a complete request/error ledger. Many records have `canceled` or `responseStreamDisconnected` outcomes during deliberate socket closure/reconnect/cleanup; these cannot be equated to failed establishments. No CPU/quota dashboard claim is made.

[Sanitized evidence](hall-hosted-500-evidence-2026-10-16.json) includes phase timings, the three failure records, responsiveness/convergence checks, deployment identities and tail aggregates. Full per-attempt timing data remains at `/tmp/hall-diagnostic-500.json`. Raw tails contain request metadata and were retained only in a private local directory, not committed.

## Reproduction

A one-client diagnostic preflight passed before the 500-client run. The test-specific diagnostic runner was linted and exercised by that preflight; application code was unchanged.

```sh
node scripts/hall-live/diagnostic-load.mjs https://devfest-hall-availability-test.gdg-chennai.workers.dev 1 1 /tmp/hall-diagnostic-preflight.json
node scripts/hall-live/diagnostic-load.mjs https://devfest-hall-availability-test.gdg-chennai.workers.dev 500 60 /tmp/hall-diagnostic-500.json
```

Execution stopped after this 500-client run. Nothing above 500 was tested. The recorded evidence establishes a healthy 500-client initial arrival/hold and 497 healthy reconnects, while leaving reliable recovery from the three TCP establishment failures unresolved.
