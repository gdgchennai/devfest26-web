# Hall live verification — 15 October 2026

Historical verification of the initial clock-driven implementation. Manual lifecycle and current RBAC supersede its scheduling/UI assertions; see [manual event verification](hall-manual-verification.md).

Implemented on `codex/hall-availability-test`. Local verification only; nothing pushed or deployed, no remote migrations or paid services enabled. See [startup and test commands](hall-availability.md) and [raw load metrics](hall-live-load-report.json).

## Passed

- Baseline and final app typecheck: clean. Separate coordinator/gateway typecheck: clean.
- ESLint: original baseline retained, 10 errors and 4 warnings; no new feature findings. Existing failures were not repaired in unrelated files.
- Production-style isolated Next/OpenNext build succeeds using the supported webpack option. Turbopack was blocked by its CSS subprocess listener on this host; normal production bundler defaults remain unchanged.
- All 14 additive migrations applied to a fresh isolated local D1. Only dev lead assignments were seeded, without OAuth or production user data.
- Real Next route handlers, private service bindings, local D1 and SQLite DO exercised together in one coordinated Wrangler runtime.
- Organizer, assigned Tech lead, differently assigned Deep tech lead, unassigned actor and public actor cases checked. Invalid percentage/type/zone, forged role headers, cross-origin writes and public socket messages rejected.
- Concurrent occupancy edits with identical expected revisions: exactly one success and one conflict. Promotion-order race: exactly one success and one conflict. Losing writes did not increment global revision/audit.
- Recommendation independent of pin; exclusive session-end expiry; expired promotions rejected. Model coverage includes gaps, not-started/finished tracks, empty schedules, simultaneous tracks, deterministic ties, unknown occupancy, break relocation/deduplication, missing speakers, long titles and next-session noninheritance.
- Revision reducer discards old revisions and old same-revision reconciliation timestamps. Mocked client lifecycle regression covers rapid hide/show and obsolete close/error/message events without creating duplicate sockets. These are lifecycle tests, not browser rendering tests.
- Socket initial snapshot raced with a write. A local-only publication fault persisted state without broadcast; the durable alarm recovered it without repeating the successful write.
- Durable actor throttle returned 429 with Retry-After. Runtime fixture opt-in disabled: role route 404, spoofed write 403, permission lookup 401.
- Full Workers stop/restart preserved measurements, promotions, clock and global revision. Final loaded state was also recorded before returning the preview to normal-limit mode.
- Read-only local D1 audit after the load run: 1519 contiguous committed audit revisions, no partial guard rows, no stranded outbox, valid integer measurements. Independent SQLite schema checks reject invalid percentages even without API validation.

## Load run

Completed 15 October 2026, 04:29 IST. One local Intel Core i5-12450HX machine (12 reported logical CPUs) hosted Wrangler, the application/coordinator and the generator.

| Metric | Result |
| --- | ---: |
| Independent simultaneous WebSocket clients | 1400 |
| Accepted upgrades including reconnects | 1700 |
| Authorized event changes | 500 |
| Occupancy / promotion-order changes | 400 / 100 |
| Additional simulated-clock setup write | 1 |
| Shared-IP reconnect surge | 300 |
| Final revision | 1519 |
| Clients failing final convergence | 0 |
| Missed broadcasts on continuously connected clients | 0 |
| Unexpected disconnects during soak | 0 |
| Intended disconnects / reconnects | 300 / 300 |
| Unauthorized probes rejected | 3 |
| Write conflicts in sequential load workload | 0 |
| Duplicate equal-revision snapshots | 300 |
| Out-of-order revisions | 0 |
| Recorded transient denial-probe retries | 1 |
| Propagation p50 / p95 / p99 | 74.36 / 121.55 / 149.56 ms |
| Latency observations | 701700 |
| Total duration | 222.631 seconds |
| Sustained idle soak | 120 seconds |
| Generator ending RSS | 371347456 bytes (~354 MiB) |
| Generator CPU | 48714.172 ms |

Every client matched the final committed revision, occupancy, promotions and clock. The 1100 continuously connected clients also received every measured committed broadcast. The last event change raced the 300-client resubscription surge. Duplicate initial/reconnect snapshots were accepted safely; separate reducer tests inject old revisions/timestamps. The 500 writes were sequential, not 500 concurrent writers; independent race tests cover contention.

One local Wrangler ProxyWorker response failed with “Network connection lost” on an unauthorized probe after the surge. The runner records bounded retries for these non-mutating probes; its retry succeeded and authorization remained enforced. Successful writes are not automatically repeated. Earlier exploratory runs were excluded: one was interrupted by a source reload during soak, another stopped at that transient proxy error before retry handling was added.

Propagation timing starts before the authorized HTTP write and ends on client receipt, including local Next/D1/DO/generator work. Socket ramp batches were 50; reconnects launched 300 independently. The generator and emulator share hardware, so these numbers include local scheduling/serialization overhead and are not hosted network guarantees. Observed workerd process RSS reached roughly 1.25 GiB and 1.68 GiB in the retained development runtime; those processes also served earlier trials and include Wrangler/Miniflare overhead. This is not per-DO hosted memory or per-request CPU accounting.

## Bundle measurements

Wrangler `deploy --dry-run` only (no upload):

- Isolated application: 9244.02 KiB raw, **1912.88 KiB gzip**.
- Hall coordinator: 65.59 KiB raw, **17.74 KiB gzip**.

No runtime dependency added. The isolated app omits production analytics/auth side effects, so these measurements do not replace a full production integration bundle check.

## Browser verification completed

Browser permission was subsequently accepted and the isolated runtime was restarted. Actual rendered QA then passed on 15 October 2026 in the in-app browser; no feature code changes were required by this pass.

- Public page inspected at **1280px desktop and 320/375/390 CSS-pixel phone widths**, in both `lite=0` and `lite=1`. DOM viewport dimensions and document scroll widths were checked: no horizontal overflow. Below 360px next previews stack; larger phone widths retain the 3:1 split and readable wrapping of real long titles. Desktop rows align in four columns. Organizer controls were also inspected at phone and desktop widths (eight forms, two desktop columns).
- Full-mode menu was watched open and close, including the restrained Live dot; lite disclosure opened instantly and included the same Live destination. The stored lite choice persisted across navigation.
- Shared D6 schedule showed all three simultaneous current tracks. F&B schedule showed relocated breaks without inventing an occupancy zone. Session descriptions replaced the schedule dialog; only one dialog was visible. Shift+Tab wrapped inside details, Back focused the exact original schedule entry, and Escape restored the hall opener.
- Organizer saved 100% occupancy: public progress value became 100, with Full and 0% remaining. A subsequent 25% save appeared immediately in the public view. Recommended alone did not sort ahead of that lower occupancy; pin changes did. Keyboard Up ordering and actual pointer dragging at phone width both changed the saved list and public order.
- While keyboard focus stayed in a card, removing its pin updated the badge immediately but preserved physical row position. Moving focus out allowed occupancy ordering to resume.
- Native datetime keyboard editing advanced the shared clock exactly to 11:10 IST. Tech switched from Kotlin to Gemma, its expired session pin disappeared, the 25% measurement persisted, and age became Stale · 10 min ago. Browser locator filling of the native datetime widget did not commit the React edit on this host; native keyboard editing did.
- Public identity showed Sign in required; each assigned lead saw exactly its own form and no promotion controls; unassigned identity showed assignment guidance. Organizer restored all eight controls.
- Intentional runtime shutdown showed Offline / reconnecting while retaining measurements. Restart automatically reconnected and resnapshotted without a page reload.
- Accessibility-tree inspection confirmed named progress values, dialogs, buttons, headings, assignment guidance and status text. This does not claim spoken screen-reader or physical touch-device testing.

Screenshots: [desktop live](hall-live-qa/desktop-lite.jpg), [desktop controls](hall-live-qa/admin-desktop.jpg), [320px full-mode cards](hall-live-qa/mobile-320-full.jpg), [390px lite cards](hall-live-qa/mobile-390-lite.jpg). Additional viewport captures were saved under `/tmp/hall-visual-qa/` on the implementation host. Temporary viewport overrides were cleared; the public preview was kept open.

QA changed only isolated fixture data after the recorded load run; its historical revision 1519 and benchmark metrics remain unchanged. The post-QA audit has **1529 contiguous revisions**, no stranded outbox or partial guard, and valid measurements. The clock was restored to frozen 11:00 IST for review.

## Remaining verification limits

Physical touchscreen gestures, spoken screen-reader output and a separate OS-level reduced-motion preference were not exercised; phone-width pointer interaction, keyboard behavior, accessibility-tree semantics and the lite baseline were checked. Existing navigation prefetches of non-feature ISR pages logged a missing dummy revalidation queue in this isolated preview; the hall pages/APIs passed, and full-site cache integration remains outside this test feature.

There was no eight-hour soak, forced hosted hibernation eviction, hosted slow-reader test, production OAuth test or hosted Free-tier CPU verification. Hibernation-compatible APIs and durable reconstruction are implemented; local restart persistence and outbox recovery were tested. Workers does not expose bufferedAmount, so strict application-side slow-reader buffer accounting is a remaining limitation; send failures close clients for resnapshot.

Production still needs the shared D1 migration/real UID assignments, realtime Worker deployment, private/public bindings, gateway upgrade wiring and a full production build without fixture flags. Production Wrangler database IDs and routes were not changed. Concurrent `AGENTS.md` and handoff wording edits were preserved outside implementation commits.
