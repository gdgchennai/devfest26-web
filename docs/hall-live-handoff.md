# Hall live status — implementation handoff to GPT-6 sol

Prepared 2026-10-15, Asia/Kolkata. This document is the implementation brief, not a claim that the feature exists.

## Mission and authorization

Implement and locally test a mobile-first live event/zone occupancy feature in this repository. The user has approved the design direction and resolved the outstanding product questions. Proceed with coding, local Cloudflare runtime verification, browser testing, and load testing. Do not ask the same product questions again. Make routine implementation decisions and document them.

Make standard atomic git commits using the developer’s configured identity. Do not push, deploy remotely, apply remote database migrations, or enable paid services. Do not create another chat or message another chat unless the human explicitly requests it. No subagents were requested; follow the active delegation rules.

Read root `AGENTS.md` first. Its constraints apply. Read relevant guides in `node_modules/next/dist/docs/` before writing application code. Dependencies/the installed docs directory were absent during discovery; install dependencies first if still necessary. Follow the tool's escalation flow for network or filesystem restrictions.

## Current repository state

- Workspace: `/home/headhit/Documents/repos/devfest26-web`.
- Branch created for this work: `codex/hall-availability-test`.
- Both `origin` and `upstream` currently point to `https://github.com/gdgchennai/devfest26-web.git` for fetch and push. Upstream is correct. This is NOT a personal fork remote; do not push assuming it is.
- Starting commit observed: `a1c7f55` (`Add pre-req and levels (#42)`). Recheck status and preserve any subsequent human edits.
- No feature code has been written. This handoff and its reference image are the only deliverables from planning.
- Creating the branch required escalation because `.git` was read-only in the sandbox. The branch creation succeeded.

## Final product decisions — authoritative

1. Occupancy is independent **per track/zone**, even where several tracks share a physical hall.
2. The public `/live` page has **one current/next card per track**, not one card for every session and not one card per physical hall.
3. Use existing agenda JSON and speaker JSON. Resolve current and next events from timestamps in Asia/Kolkata. Every scheduled session remains reachable through the physical-hall schedule dialog.
4. Leads edit occupancy for their assigned zones. Organizers can edit all zones and manage event priorities/recommendations.
5. The public bar represents **occupied percentage**, not availability: left label `25% occupied`, right label `75% remaining`; fill length 25%. Store one integer occupancy value, derive remaining as `100 - occupied`.
6. Ordinary cards sort by **lowest occupancy first**.
7. Organizers explicitly pin selected events to a priority list and **drag and drop** to order it. Pinned events appear before ordinary cards, in that order.
8. **Recommended is an independent badge.** It does not affect sorting by itself. An event can be pinned without being recommended or recommended without being pinned.
9. Priority and recommendation are session-specific and expire at the session's end time. They must NOT transfer to the next event in that track.
10. No separate admission-closed feature. User explicitly rejected it: setting occupancy to **100% means Full/closed for entry**. Do not add an admission status column, toggle, or independent closed sorting rule.
11. Local development uses **dev-only test identities/permissions**, not Google OAuth. Include organizer, assigned lead, differently assigned/unassigned lead, and public cases.
12. Use WebSockets and a hibernating Cloudflare Durable Object, not 15-second HTTP polling by every browser. Push saved updates promptly, including order and recommendation changes.
13. Keep the site's existing header/dropdown. Add a distinct **Live** nav item, preferably a restrained red dot. Also support the existing lite navigation. The nav dot is a destination cue, not a network-health claim.
14. Preserve the original backend architecture: Next.js route handlers, Cloudflare Workers, additive D1 migrations. Unrelated backend integrations remain outside the test feature's scope.

## Approved visual direction

Reference: `docs/hall-live-design-reference.png` (concept image, not a screenshot of implemented UI). The user approved its overall look and explicitly said not to regenerate it.

The reference is superseded wherever it differs from the decisions above:

- Change availability bars to occupancy bars and show both percentages.
- Replace the mockup's alternate desktop nav with the existing header/dropdown plus Live.
- Replace the mockup's numeric priority field with an organizer drag-and-drop list.
- Keep recommendations independent of priority; badge alone does not raise a card.
- Use real agenda and speaker data. Some image text/speakers/timings are illustrative or generated; never copy them as authoritative data.
- Render one card per track/zone, including simultaneous tracks sharing a hall.

Existing design evidence:

- `app/layout.tsx` loads Google Sans from Google Fonts; all typography is Google Sans. No new font family.
- `app/globals.css`: `ink`, `paper`, `surface`, `surface-raised` and brand blue/green/yellow/red/purple tokens. Use Tailwind v4 tokens, not literal hex or `bg-[var(...)]`.
- `components/Card.tsx`: fine border, near-black surface, modest rounded corners, optional accent hairline.
- `lib/track-color.ts`: track identity colors. Keep these distinct from occupancy's semantic colors.
- `components/ArrowGlyph.tsx`: existing arrow idiom. Reuse available icon patterns; avoid adding an icon library for a few icons.
- `components/SessionDescriptionModal.tsx`: the shared agenda details dialog. Reuse it, including speaker metadata, prerequisites, time, and description.
- `components/games/useDialog.ts`: focus trap, Escape, focus return. Use/adapt existing dialog behavior rather than stacking two competing modal focus traps.

Mobile:

- Card hall header is a real button with clear `All sessions`/chevron affordance.
- Main current-event region approximately 75% width; next-event preview approximately 25% on right, separated visually.
- Current title, speakers, start/end time; next title, speakers, start/end time. Both titles open the shared event dialog.
- Keep long titles readable and touch targets usable. At exceptionally narrow widths, stack the next preview rather than making unreadable text; document the breakpoint choice.
- Occupancy bar spans a readable region, with both percentage labels. No fabricated seat counts: a percentage is not an exact seat count.
- Proposed semantic thresholds: 0–49% green, 50–79% yellow, 80–99% red, 100% Full. Treat these as implementation defaults and centralize them.
- Recommended uses a restrained blue badge/star and accent, without masking occupancy colors. No perpetual flashing or excessive glow.

Desktop:

- Aligned table-like rows/semantic table: Hall/track, Happening now, Occupancy, Up next.
- Preserve all mobile interactions and keyboard access. Avoid horizontal scrolling where responsive layout can solve it.

Hall schedule dialog:

- Physical hall heading; list all events occurring there, across zones, sorted by start time with track labels.
- Past entries muted but readable and clickable. Current entries marked On now; parallel current events can both be highlighted. Future entries remain visible.
- Opening an event replaces/transitions to the existing details modal. Provide return to the hall schedule and appropriate focus restoration.
- Deduplicate by stable session ID, not title. Session `hall` determines actual venue, including breaks in F&B; do not mislabel relocated sessions as taking place in a track's normal hall.

## Scheduling, ranking, and stale data

- Current: `start <= now < end`. Avoid inclusive end boundaries creating two current sessions.
- Use stable `AgendaSession.id` for new promotions. Existing `lib/session-key.ts` uses `track@start` for other features and has outdated comments; do not extend that fragility or migrate unrelated favorites/session status in this task.
- Each track displays its ongoing session or earliest future session when none is ongoing; next is the subsequent upcoming session in that track. Explicitly label gaps, not-yet-started sessions, and finished tracks.
- Keep breaks/general entries accessible in schedules. Do not invent separate occupancy zones for F&B or check-in. Use an explicit policy for their presence in track cards and document it.
- Pin/badge applies to the card's primary displayed session, not a future session merely mentioned in its next preview. Organizers may prepare upcoming session promotions; they take effect when that session is the primary card.
- Pinned visible sessions first by organizer order. Remaining cards by known occupancy ascending. Put unknown occupancy after known values; deterministic final tie-break by configured track order/ID. Recommended alone does not affect this ordering.
- Expired promotion records may remain for audit, but reads and UI must ignore them. Server validates end time, client updates on boundaries even with no network message. Schedule an appropriate expiry notification/reconciliation if necessary; do not rely only on a future admin write.
- Occupancy persists across session changes; never automatically reset to zero. Distinguish measurement age from connection status. Unknown/stale is not empty.
- Default stale threshold can be configurable (e.g. five minutes); do not silently claim accurate current occupancy after losing connection.
- Prevent card reorder from moving a button under a finger/keyboard focus. Update values immediately, defer physical movement while interacting where necessary.
- Provide a conspicuous local-only simulated clock so Oct 17 schedule transitions can be tested before event day. Align frontend and backend test clocks for expiry checks. No production clock override from untrusted query parameters.

## Architecture and persistence

One logical D1 database with additive feature tables, not a separate database per hall. The local test database is separate from production. Later integration applies the same migrations to the original project's D1.

Suggested tables (adapt names/normalization as appropriate):

- Zone occupancy keyed by stable track/zone ID: integer 0–100, revision, updated_at, updated_by.
- Zone lead assignments and organizer authorization, with a compatible adapter to existing `users`/admin checks. Seed dev identities without requiring OAuth or copying production accounts.
- Session promotions: stable session ID, recommended boolean, optional pin/order; include a revision for atomic list edits. Derive expiry from authoritative agenda end time rather than a client-supplied deadline.
- Audit history for occupancy and promotion/order changes.
- Durable pending-publication/outbox state or equivalent recoverable mechanism.

Enforce schema constraints and server validation. Update state, audit, and publication intent atomically using supported D1 transactions/batching. Prevent concurrent writes using expected revisions and return a clear conflict response. Do not hold a supposed transaction across independent HTTP calls.

Suggested flow:

1. Next.js route authenticates actor, checks zone/organizer permission, validates payload.
2. A private service binding calls the real-time service/coordinator.
3. Authoritative update commits in D1 before public broadcast.
4. One event-level SQLite-backed Durable Object coordinates sockets and publishes revisioned changes.
5. Public clients receive initial snapshots and updates. Use a race-safe snapshot/subscription sequence, deduplicate retries, and handle out-of-order revisions.
6. Failed publication after persistence is retried/reconciled. A failed broadcast must not require repeating a successful occupancy write.

D1 remains authoritative. Durable Object SQLite can hold minimal coordination/recovery data; it is not a substitute for migrating the hall state into D1. Never rely exclusively on in-memory caches or an open browser for persistence/retries.

Use Hibernation API `ctx.acceptWebSocket`, not ordinary sockets that unnecessarily prevent sleep. Reconstruct transient state correctly after hibernation. Route all public connections for this event to the same stable DO ID; do not create one DO per participant.

Public endpoint is read-only. No public publish operation, caller-supplied trusted actor, or forwarded arbitrary role header. Use a private binding for writes. Validate origins as defense in depth, but do not treat Origin as authentication.

Reconnect with bounded exponential backoff and jitter; pause/close as appropriate while hidden, resnapshot when visible. Handle abnormal closure and slow clients. No unrestricted polling fallback. Avoid high-frequency application heartbeat messages; if needed use hibernation-compatible auto-response and account for request costs.

## Development permissions and isolated runtime

- Server-controlled dev identities must exercise the real authorization path. Hiding controls is not permission enforcement.
- Explicit opt-in test environment; bind locally to loopback. A local production-style Workers preview has `NODE_ENV=production`, so do not use NODE_ENV alone to determine whether local fixtures are allowed.
- Production config must not enable dev identities. Test that an ordinary remote/production configuration fails closed even if a request attempts to select an organizer role.
- Prefer separate local Wrangler/test configuration and secrets templates. Never change checked-in production database IDs or use remote D1 in local tests.
- Root layout currently mounts auth, push prompt, favorites, analytics, and crossword preloading. Isolated mode must prevent unrelated service calls/seeding requirements while retaining the visual shell. Do not send test activity to the original GA/PostHog projects.
- Root OpenNext config uses R2 incremental cache and an Images binding. For local testing use local emulation or an isolated feature configuration; no paid activation/remote provisioning. Be explicit about what remains required for full-site deployment.
- Do not run independent Miniflare instances against the same state directory. Use a coordinated multi-Worker local runtime/supported service-binding setup with clear ownership of persisted D1. The ticketing Worker is not needed.
- No Google OAuth, KonfHub, Gemini, push subscription service, or production secrets are required for this feature's local tests.

## File-level implementation map (proposed)

Inspect existing files before choosing final names; this is a guide, not an instruction to create empty abstractions.

| Area | Files |
| --- | --- |
| Zone metadata and mapping | `site.config.ts`, new `lib/hall-zones.ts` |
| Additive D1 schema | next unused numbered file under `migrations/` (0014 was next during discovery) |
| Shared validation/types | new `lib/hall-status-schema.ts` |
| D1 operations | new `lib/hall-status.ts` |
| Permission adapter | new `lib/hall-access.ts`; reuse `lib/admin.ts` when integrating production auth |
| Public snapshot and admin routes | new `app/api/halls/...`, `app/api/admin/halls/...`, promotion/order endpoints |
| Real-time Worker | new `workers/hall-live/` with Wrangler config, types, separate tsconfig, implementation |
| Service bindings/local orchestration | dedicated test config, `package.json`, `cloudflare-env.d.ts` generation as needed |
| Public page and shared connection | `app/live/page.tsx`, new `components/halls/*`, shared client hook/provider |
| Lead/organizer UI | `app/admin/halls/page.tsx`, new `components/admin/*`, `components/admin/AdminNav.tsx` |
| Reused dialogs | `components/SessionDescriptionModal.tsx`, `components/games/useDialog.ts` |
| Navigation | `lib/routes.ts`, `components/HamburgerMenu.tsx`, `components/Header.tsx` as necessary |
| Isolated feature mode | minimal scoped changes to root providers/config; preserve production defaults |
| Tests and fixtures | focused feature integration tests, local seed scripts, load runner/report |
| Docs | `docs/hall-availability.md`, `docs/admin.md`, `docs/environment.md`, templates, `docs/deployment.md`, architecture notes |

Do not modify animation/hallway files just to add this feature. If an animation skill applies, read it first. Respect lite/reduced-motion behavior and GPU gating. Reuse existing styles; no new dependency unless its value and bundle impact justify it. Touch-friendly dragging may use an appropriate small library after checking alternatives; keyboard ordering is mandatory.

## Rate limiting

Discovery found `lib/rate-limit.ts`, an in-memory per-isolate best-effort limiter. Its callers are primarily `app/api/games/session/route.ts`: 1500 starts/minute/IP, and 10 Gemini generations/minute/IP before fallback. Existing admin session-status writes have no explicit request limiter. No Wrangler rate-limit binding was found. Dashboard rules are unknown and cannot be inferred from the repo.

Add appropriate feature-specific protection:

- Authenticated actor-based admin write and reorder throttles; return 429 with retry guidance.
- Snapshot/connection/reconnect protection that tolerates 1400 people sharing venue NAT/Wi-Fi.
- Public socket message size/type limits and no public writes.
- Bound retry queues, history payloads, and pending connections.
- Do not describe a per-isolate limiter as globally strict. Choose durable/coordinated enforcement where needed and include it in the load budget.
- Rate limiting is not a way to make per-browser polling fit Free; keep event-driven broadcasts.

## Verification and load-testing contract

The repository has no established test suite, but the user explicitly requested thorough testing. Add meaningful tests for authorization, races, persistence, and schedule behavior; do not merely mirror implementation details.

1. Record baseline typecheck/lint before feature edits. Final `npx tsc --noEmit` clean and lint with no new failures; do not fix unrelated baseline issues. Separately typecheck the new Worker (root excludes Workers).
2. Apply migrations to fresh local D1, seed, restart, and verify persistence. Test valid/invalid percentages, stable IDs, audit records, revision conflicts, and atomic ordering changes.
3. Test organizer, assigned lead, wrong-zone lead, unassigned identity, public user, and disabled dev mode through direct API calls.
4. Test priority vs badge independence; expiry exactly at end; next-session noninheritance; ties, unknown/stale occupancy, empty days, gaps, simultaneous tracks, missing speakers, and long titles.
5. Test initial snapshot racing with writes, duplicate/out-of-order delivery, failed publication/recovery, socket disconnects, service restart, and hibernation-compatible reconstruction.
6. Exercise actual local Workers runtime, not only Next dev and mocked fetches.
7. Browser QA: 320/375/390px mobile and desktop, lite=1 and lite=0, keyboard/touch interaction, focus, modal navigation, drag/order buttons, progress labels, screen-reader semantics, stale/offline status. Inspect screenshots and watch transitions.
8. Load test locally: ramp to **1400 simultaneous WebSockets**, execute **500 authorized changes**, and check every healthy client converges to the final committed revision/state. Include occupancy changes and organizer changes. Track accepted connections, write successes/conflicts, missed updates, duplicate handling, p50/p95/p99 propagation latency, memory/CPU, disconnects, retries, and recovery.
9. Include reconnect surge, shared-IP clients, mixed-zone assignments, and rejected unauthorized writes. Configure load-runner allowance/test identities explicitly rather than disabling production limiter logic silently.
10. Run a sustained soak (document actual duration; do not imply an eight-hour test if only minutes were run). Distinguish sequential broadcast work from independent connections. Explain local hardware/load-generator bottlenecks.
11. Save reproducible commands and results. Do not claim hosted Free-tier CPU compliance from local measurements. Remote deployment/load tests require separate authorization.

## Free-tier planning context (verify current docs when implementing)

For the isolated feature, previous analysis assumed 1400 initial connections, 500 writes, one event-level DO, and an illustrative eight-hour event:

- About 1900 external API/upgrade requests before page loads, retries, and extra endpoints.
- About 1900 DO connection/update calls before alarms, extra RPCs, and recovery.
- 500 broadcasts × 1400 clients = 700,000 outgoing messages; outgoing DO WebSocket messages have no request-unit charge, but CPU/duration still matter.
- One continuously active 128MB DO for eight hours is roughly 3686 GB-seconds, compared with 13,000/day Free duration. Hibernation should reduce this. Do not multiply duration by clients.
- Workers Free and DO Free each have 100,000/day request allowances; D1 Free: 5 million row reads/day, 100,000 row writes/day, 5GB total storage. Index and outbox writes count too.
- DO hibernating socket API ceiling 32,768 per object is a limit, not proof that any implementation handles that many.
- Regular Worker Free CPU budget is 10ms/request; keep gateway work lean and measure. Authentication/SSR may be the limiting path.
- Frequent incoming heartbeat messages, reconnect loops, other account workloads, and fallback polling can materially change these estimates.
- Free-tier overruns can cause failures. Do not promise guaranteed free production reliability or auto-upgrade plans.

Sources:

- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/api/state/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/

The repo's AGENTS contains an older 3MiB Worker-size constraint; preserve its conservative no-bloat intent and measure the build rather than resolving unrelated documentation discrepancies in this change.

## Completion report expected

Give the user local public/admin URLs and exact startup/seed/load commands, how to switch dev roles and simulated time, what was implemented, what was actually tested, measured load results, and any remaining limitations. Explain the small production integration steps: migrations, zone assignments, auth adapter, service bindings, and real-time Worker deployment. No claim of remote verification unless it actually occurred with authorization.
