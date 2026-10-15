# Compact hall overview verification — 15 October 2026

Implemented on `codex/hall-availability-test`. No stress tests or load tests were run for this change. Historical load reports remain unchanged.

## Updated workflow

Super-admins see compact current/upcoming event rows, using the same track-card selection and committed sorting as the participant page. Rows include event title (maximum two lines), speaker names, planned IST time range, schedule-status text/colors, a thin occupied-percentage bar, and saved Pinned/Recommended labels. Missing measurements and speakers are explicit. Local fixture tools start collapsed to preserve room for the list.

Clicking a row opens its full event card in a scrollable popup with a fixed Close button. Occupancy, pinning, recommendations, event start/end and next-event selection remain in the popup. Track admins/leads retain direct cards for their assigned tracks and cannot promote/reorder.

Dragging is removed. Up/Down stages an exact relative move; Save priorities publishes atomically, and Discard restores current committed ordering. The minimum leading group necessary to preserve a moved row's position becomes pinned when saved, with untouched ordinary rows retaining availability ordering. Existing recommendations and prepared pins are preserved. Any intervening live revision blocks saving an outdated draft. Popup edits are disabled while a priority draft is pending.

Manual lifecycle remains authoritative. Green On schedule means a running event is within its planned time window. Red Out of sync distinguishes early running, an overrun, or awaiting start after the planned start. Future upcoming events are neutral. These labels never change lifecycle automatically and do not assert historical start punctuality.

## Verification

- App typecheck, separate Worker typecheck, focused lint and isolated production-style build pass. Full lint retains the pre-existing 10 errors / 4 warnings.
- `npm run hall:test` passes: model, client lifecycle, access adapter, real local API/authorization, revision conflicts, atomic writes, manual transitions, outbox recovery, CSRF and actor-throttle checks. These are functional tests, not a stress workload.
- Added overview model tests cover timing boundaries, immutable staging, exact single-position moves including lower rows, recommendation preservation and ended-event priority noninheritance.
- Browser: popup occupancy save appeared on the public page; recommendation and pin controls saved from the popup; arrows changed only the draft until Save; publishing updated public order. A concurrent authorized measurement revision disabled stale-draft saving, and Discard restored committed order.
- Browser: manually ending both promoted events removed their badges/pins. Successors retained measurements and inherited no promotions; most-available-first sorting resumed after the last priority expired. Starting an event inside its planned window showed green On schedule; late upcoming events showed red Out of sync.
- Browser: Shift+Tab wrapped from Close to the final popup control; Escape closed the popup and returned focus to its originating row. Lead fixture still showed only its assigned direct card without promotion or overview controls.
- Responsive layout: actual rendered iframe documents were checked at 320/375/390 CSS pixels and 1280 desktop, with scroll width equal to document width. 375px full mode and lite phone/desktop modes were inspected. Long titles clamp to two lines; several rows fit in the phone viewport. Fixed-width iframes were used because the browser viewport override was ineffective on this host. Interactions were tested in the direct browser tab; the tool could read/render the phone frames but could not target their controls. No physical touchscreen or spoken screen-reader verification is claimed.

Screenshots: [320px overview](hall-live-qa/overview/mobile-320.png), [desktop overview](hall-live-qa/overview/desktop.png), [popup editor](hall-live-qa/overview/popup.png).

## Scope

No backend/schema, dependencies, remote deployment or production binding changes. The existing isolated preview setup and pending production integration requirements remain documented in [hall availability](hall-availability.md). Existing user changes to `AGENTS.md` and the handoff are preserved. Commits are local only.
