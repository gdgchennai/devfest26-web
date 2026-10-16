# Hosted 1,400-viewer retry baseline — 16 October 2026

**Transport/recovery PASS; latency acceptance FAIL. No organizer writes executed.** This independent baseline ran while waiting for three genuine organizer credentials required for the authorized end-to-end write rehearsal.

Target: `https://devfest-hall-availability-test.gdg-chennai.workers.dev`. The backend deployment was rechecked as version `6431b79a-0023-4730-b86c-6f27d28bfe8e` at 100% traffic. The working tree contains a local reversion of backend code; it was preserved and not deployed.

| Measurement | Initial connections | Reconnects |
|---|---:|---:|
| Logical viewers | 1,400 | 1,400 |
| Attempts | 1,417 | 1,402 |
| Viewers needing retry | 17 | 2 |
| Eventually initialized | 1,400 | 1,400 |
| Successful-attempt snapshot p95 | 10.759 s | 7.020 s |
| Retry-inclusive viewer ready p95 | 10.850 s | 7.050 s |
| Maximum retry-inclusive ready time | 18.392 s | 17.465 s |

All 1,400 viewers answered protocol pings at hold start, hold end and after reconnect. The 30-second hold ended with all sockets open and all matching authoritative state. Final 1,400 state checks matched revision 11. Zero unexpected closes, state regressions or revision gaps. There were no updates, so this is not evidence of hosted broadcast propagation.

The runner used a 15-second establishment deadline and at most two optional retries with the application's exponential backoff/jitter formula. Every affected viewer recovered after its first retry. This tests bounded recovery in the protocol harness; browser connection timeout behavior and whole-page rendering are outside it. Each group was issued without a ramp delay; 1,400 socket constructions still take real generator time, so this is not literally one physical instant.

The established five-second initial snapshot p95 target failed. TLS completion p95 alone was 9.737 seconds initially (4.866 seconds on reconnect), so the observed delay cannot all be attributed to snapshot preparation. The result does not isolate local network, transit, Cloudflare edge or generator effects. Event-loop delay p99 was 22.41 ms and maximum 336.59 ms. Generator RSS was approximately 360 MB. No server CPU/quota telemetry was captured for this baseline.

Total elapsed time was 85.180 seconds. Cleanup left zero sockets. The diagnostic harness now permits up to 1,400 viewers with explicit retry opt-in; default remains zero retries. [Raw summary and failure records](hall-hosted-1400-readonly-evidence-2026-10-16.json) exclude credential data and full per-attempt success records, which remain at `/tmp/hall-diagnostic-1400-retries.json`.

```sh
node scripts/hall-live/diagnostic-load.mjs https://devfest-hall-availability-test.gdg-chennai.workers.dev 1400 30 /tmp/hall-diagnostic-1400-retries.json 2
```

At the time of this read-only baseline, the organizer-write rehearsal was pending authentication and no writes had occurred. The subsequent [authenticated rehearsal](hall-hosted-e2e-report-2026-10-16.md) failed the requested stress scenario; it must be assessed separately.
