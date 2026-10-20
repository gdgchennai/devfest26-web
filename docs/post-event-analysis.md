# Post-event analysis

`/admin/analysis` is an organizer dashboard for occupancy history, event timing,
possible early departures, congestion/distribution and reporting coverage.
Admin navigation links to it. It defaults to **17 October 2026, 09:00–18:00
Asia/Kolkata (IST)**; the end is exclusive. Multi-day ranges up to 366 days are
supported. No dependencies, migrations, environment variables, coordinator writes
or changes to live hall behavior are required.

## Data and access

The page is a static, noindex shell with no private data. It starts empty. Import
an existing audit JSON file for offline analysis, or choose **Try sample data**
for deterministic synthetic reports generated from the bundled agenda. Samples
are always labeled; `?sample=1` loads them on entry for local review.

**Load database history** explicitly requests `GET /api/admin/analysis`.
It uses the existing `requireAccessApi` authentication gate and requires
`isSuper`; track admins/leads cannot read the whole-event audit. The handler
performs one SELECT joining `hall_audit` to user display names, excludes emails
and authentication fields, returns `private, no-store`, and refuses more than
50,000 rows instead of truncating history. There is no polling or initial data
request. **Refresh source** rereads the imported File, regenerates sample data,
or explicitly refreshes the database, according to the current source.

Local implementation and browser checks use synthetic data only. No hosted
query, deployment or Cloudflare configuration change is required to review it.
An offline import stays in the tab's memory; it is not uploaded or stored in
localStorage. Clear data or reload to discard it. The static shell may still
load the site's usual shared shell resources in normal builds.

### Supported JSON imports

Maximum input size: 10 MiB and 50,000 rows. The parser accepts:

- An array of `{ revision, actor, changed_at, payload }` records. Timestamps are
  server Unix epoch **milliseconds**, not seconds; payload can be a JSON string
  or object. `revision` must be unique and positive.
- Wrangler's `[{ results: [...] }]` envelope, or `{ results: [...] }`.
- `{ audit: [...], agenda: [...], actors: { "user-id": "Display name" } }`.
  The optional agenda must follow `lib/schemas.ts`; importing the event-day
  agenda snapshot preserves comparisons if the repository agenda later changes.

Successful occupancy, lifecycle, reset, clock and promotion mutations are
accepted. Promotions are retained for re-export but have no dashboard panel or
metrics. Failed writes cannot be reconstructed from successful audit rows.
Actor IDs remain visible if a display name is unavailable.
Invalid records reject the import without replacing the current dataset.

## Reconstruction and measurement rules

`lib/post-event-analysis.ts` replays **all** imported rows in revision order,
before applying the time range. Keep lifecycle/reset context when exporting.
Every start creates a separate event run, including restarts of the same event.
End and reset actions bound measurement validity. Resets do not fabricate an
actual end timestamp. Revision gaps, backwards server timestamps, unknown agenda
IDs and unmatched lifecycle actions appear in the data-quality disclosure.

Occupancy belongs to a track. It is attributed to the run active at submission;
an old reading never becomes a measurement of its successor. Unmatched readings
are excluded by default and counted in the quality summary; **Include reports
outside an event** exposes them. Explicitly enabling inferred windows can attach
unmatched readings to an unambiguous adjusted schedule window for a session
without recorded lifecycle. These runs are labeled and excluded from departure
signals; recorded lifecycle takes precedence.

The default freshness cutoff is five minutes, configurable from 1–120. A reading
is carried forward only until the next report by **any** reporter, lifecycle
boundary, freshness expiry or range end, whichever is first. Freshness never
bridges events. **Carry forward while fresh** can be disabled for point-only
charts: duration coverage becomes zero and means remain unknown. Exact-time
comparisons and heatmaps then have no assumed occupancy intervals.

Coverage is fresh duration divided by the selected event-run duration, clipped
to the range. Unclosed runs extend to the next boundary or selected range end;
missing ends remain visibly missing. Means are weighted by covered duration,
not by number of submissions. The overall percentage weights event-track
minutes equally; it is not weighted by room capacity or attendee counts.
Filtering reporters measures their contributions, not the complete track
history, while another reporter's update still supersedes theirs.

Opening/closing, observed peaks, time-to-peak and largest consecutive drops use
readings in the selected range. They can be partial-window observations.
Largest consecutive drops ignore pairs farther apart than the detection gap.
A later reading at the earlier occupancy level counts as observed recovery.

### Timing and departure signals

The original agenda, adjusted plan and recorded actions are separate timelines.
Global hours/minutes shift both planned start and end, preserving duration.
A track override replaces the global total; an event override replaces its
track/global total. Blank means inherit; zero is an explicit override. No
adjustment edits agenda content or recorded timestamps. Start/end drift is
shown against both the original and adjusted plans. Recorded times are manual
button-action times, not independently verified stage times.

Departure detection defaults: prior occupancy at least 70%, drop at least 20
percentage points, one low reading, no more than ten minutes between readings,
exclude drops in the final five minutes before recorded end. All are editable.
Increasing required consecutive low readings asks for confirmation. Missing end
or under-50% coverage produces a limited-coverage label. Each flag exposes the
triggering revisions, times and values through event details. Signals do not
establish disinterest, causation, or individual movement.

## Dashboard controls

- Shared track, event and reporter filters; IST datetime range; default-event
  and full-history presets; reset. Click chart points, event names, heatmap
  cells and reporter/track links to inspect or filter. Event strips and detail
  buttons zoom the shared range.
- Occupancy charts show raw points and fresh step intervals with unknown gaps.
  Timing rows compare original, adjusted and recorded intervals.
- Congestion heatmap uses fresh, time-weighted bucket averages; tooltips show
  covered fraction. Buckets expand to cap very long ranges at 96 columns.
  Clicking a cell selects a representative covered instant (or bucket start
  when unknown), not a claim about every instant in the bucket.
- The selected-time distribution shows fresh percentages and report age.
  Optional capacities enable estimated headcounts and shares **only among
  estimable tracks**. Supply capacities only for independent measured spaces;
  shared physical rooms must not be counted twice. This is not unique attendance.
- Reporting groups by track or actor, with occupancy/lifecycle action filters,
  first/last submission, median/longest observed inter-submission gaps and dots.
  Session coverage separately includes leading/trailing unknown time.
- Update table supports text search, column sorting, pagination and CSV export.
  Unchanged measurements remain visible as confirmations.
- Show/hide overview cards and panels; move panels up/down using accessible
  buttons. Browser preferences and named views save filters/layout, not data.
  Share links encode only the view in the `view` query parameter; recipients
  must load their own authorized dataset. View JSON import/export is supported.
- Export filtered/searched updates, event summaries, occupancy charts (SVG),
  full analysis JSON, or print/save PDF. CSV protects text against spreadsheet
  formula execution. Exports open a preview with a download link and selectable/copyable content, so they remain usable in embedded browsers that block downloads. Full dataset exports include reporter IDs/names; handle
  them as organizer data. Print excludes controls.

## Local verification

```sh
node --test scripts/analysis/*.test.cjs
npx tsc --noEmit
npm run lint
NEXT_PUBLIC_HALL_ISOLATED=1 npm run dev -- --hostname 127.0.0.1
```

Open `/admin/analysis?sample=1&lite=1` and `/admin/analysis?sample=1&lite=0`.
No new animation is used. Exercise desktop/phone layouts, date filters, schedule
shifts and overrides, saved views, exports, event details and empty states.
The focused Node tests transpile the actual TypeScript model using the existing
TypeScript dependency and stub auth/D1 for endpoint tests; they never access
Cloudflare. Existing unrelated lint failures are not changed.

### Verification for this implementation

- 21 offline model/API checks pass; root TypeScript is clean. Full ESLint has
  the existing baseline of 10 errors and 4 warnings, with none in new files.
- Browser-reviewed desktop and phone layouts, including lite and full mode;
  tested custom dates, schedule shift, event details, track filtering, panel
  reordering/hiding, saved views and a synthetic JSON file import.
- Inspected generated CSV contents and standalone SVG output (resolved colors,
  no external CSS variables). The embedded browser did not emit completed
  download events; the export dialog exposes the complete selectable content
  and download link. Native download saving and PDF printing remain manual
  verification steps in a regular browser.
- No hosted data was fetched during implementation. No push, deployment, schema
  change, Cloudflare configuration change or new dependency was performed.
