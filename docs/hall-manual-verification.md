# Manual hall events verification — 15 October 2026

Implemented on `codex/hall-availability-test` after fetching and merging `main` at `93f64cc`. Existing user edits to `AGENTS.md` and the handoff were preserved. No push, remote deployment, migration, or paid-service change.

## Behavior and authorization

- Event titles lead both lead/admin and super-admin controls; same cards contain occupancy, lifecycle, and (super-admin only) recommendation/pin/reordering controls.
- Existing RBAC resolves production access on each request: super-admin is `ADMIN_EMAILS`, admin/lead are track grants from `user_track_roles`. Retired `users.is_admin` and local `hall_leads` cannot grant production hall access. Existing main RBAC matches the required scopes once this adapter is used.
- Explicit start and end actions replace clock-driven selection and expiry. Only one event can run per track. The next unplayed event follows the last ended event; an earlier skipped or another unplayed event can be chosen. Ended events cannot restart. Occupancy persists unchanged. Scheduled times remain informational and order the agenda.
- Ending an event removes its recommendation and pin in the same audited D1 batch. A successor inherits neither. Public snapshots and hall schedule highlights use the same manual state.
- Priority changes save immediately. Most available first is the default; pinned events override that order, and recommended alone does not sort. Pointer dragging and keyboard Up/Down operate directly on event cards. Passive live reorder waits for focus/pointer to leave.

## Checks

- App and coordinator typechecks pass. Focused lint passes; full lint retains the existing 10-error/4-warning baseline.
- Isolated Next/OpenNext build passes. Additive local D1 migration succeeds without renaming either existing `0014` migration.
- API/model tests cover manual lifecycle independent of scheduled time; assigned and wrong-track leads; scoped admins; public/forged identities; super-admin-only promotions; retained occupancy; rejected duplicate starts, ending an unstarted event, and promoting an ended event; concurrent occupancy/promotion conflicts and exactly one committed winner from concurrent event starts; subscription/write races; injected publication failure and alarm recovery; CSRF, public socket writes, and durable throttling.
- Production access adapter tests supply mocked auth/RBAC decisions to the actual adapter and confirm mapping of super-admin, admin and lead, fixture-cookie/header rejection, and runtime/host gates. This is not a real Google OAuth integration test.
- The model also checks skipped-event suggestions, parallel tracks, empty schedules, deterministic availability ties, unknown occupancy, relocated breaks, and recommendation/pin independence.

## Browser checks

Actual in-app browser interactions exercised lead Start/Mark ended, scoped admin selecting an alternate event, super-admin recommendations, keyboard priority ordering, and pointer dragging. A second public tab received corresponding event/order/badge changes. Event endings retained the measurement and removed promotion inheritance. Lead/admin views expose no recommendation, pin or reorder controls.

The browser's viewport override was ineffective on this host. Responsive checks instead used a temporary local HTML harness with fixed-width iframes and verified each frame's document width equals its scroll width. Rendered layouts were inspected at 320/375/390 phone widths and 1280 desktop, covering lite/full modes and long titles. This checks CSS layout, not a physical phone or touchscreen. Existing dialog and motion shell behavior is retained; no spoken screen-reader test is claimed.

Screenshots: [390px event controls](hall-live-qa/manual/controls-390.png) and [320px participant cards](hall-live-qa/manual/live-320.png). The harness is temporary and is not part of the product.

## Integration limits

The hall feature remains an isolated local preview until production service bindings/gateway are configured. The existing Sessions admin page retains its legacy favorites/push workflow; use Hall control to drive Live. Hall lifecycle does not currently send favorites push notifications. No hosted CPU, eight-hour soak, physical touch-device, or real OAuth verification is claimed.

## Updated load run

The [raw report](hall-live-manual-load-report.json) records 1,400 simultaneous sockets, 500 occupancy/promotion writes, one setup clock write, two additional manual Start/End writes, and 300 reconnects. Every client matched the final revision, measurements, promotions, clock, and manual lifecycle state. Continuously connected clients missed zero committed broadcasts. No unexpected disconnects, transport retries, or out-of-order revisions occurred.

Propagation p50 / p95 / p99: **61.32 / 93.63 / 117.93 ms**, across 704,500 observations. Total duration 204.887 seconds, including a **120-second soak**. The writes are sequential; the tests separately cover conflicting writes. These local shared-hardware timings are not hosted performance guarantees.

D1 audit at revision 2071 found contiguous audit history, no partial guard rows, no pending outbox, and valid percentages and lifecycle states. Restart persistence checks compare manual session state as well as occupancy, promotions, clock and revision.

Final isolated build dry-run (no upload): application **1937.32 KiB gzip**, coordinator **25.81 KiB gzip**. No runtime dependency added. These are isolated bundle sizes, not a full production integration measurement.
