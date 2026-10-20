# Post-event analysis

`/admin/analysis` opens a simple attendance overview. The default range is
**17 October 2026, 09:00–18:00 IST**, with zero schedule delay.

## What organizers see

Four clickable takeaway cards lead the page:

- **Low attendance:** events averaging below 25% occupied during reported time.
- **Attendance dropped:** events with a reported fall of at least 20 percentage
  points while running. Reports must be within ten minutes of each other;
  falls in the last five minutes before a recorded end are excluded.
- **Time spent full:** measured duration at exactly 100% occupied.
- **Time spent empty:** measured duration at exactly 0% occupied.

Full/empty durations add event time across tracks; they are not a single
wall-clock duration or a count of unique attendees. Unknown time never counts
as empty. Events with no usable reports stay unknown, rather than being
classified as low attendance.

The attendance comparison lists every decrease between consecutive reports in the selected time range for the same event, including small drops and reports separated by gaps. Both report times are shown; the exact time people left is unknown. This column does not use the overview's large-drop threshold or end buffer.

The first six event cards mix quiet events, drops, full halls and empty halls.
Selecting an overview card narrows the event cards to that takeaway; selecting
it again restores highlights. **All events** lists events in recorded start
order. Each event card opens an accessible modal with:

- Its occupancy timeline, with selectable report dots and unknown gaps.
- Peak occupancy and time to peak; opening versus closing reports.
- Time full/empty, with a disclosure listing the actual reported intervals.
- Its largest qualifying mid-event drop, if any.
- Recorded start/end versus planned times including the schedule delay.

Further down, compact attendance and timing comparisons initially show six
rows each, with buttons to reveal the remaining events. Event names in these
comparisons open the same detail view.

Only **time range** and **schedule delay in minutes** are prominent controls.
A global delay moves planned start and end together, preserving duration and
original agenda timestamps. No recorded action or live hall state is edited.
Old saved layouts and advanced filters no longer affect this page. The previous
heatmap, lead timelines, raw audit table, layout customization, exports and
advanced detection settings have been removed from the dashboard.

## Data and interpretation

The data menu offers **Import event data**, **View sample data**, and
**Load server history**. Samples are explicitly labeled and can be opened with
`?sample=1`. No database request is made automatically.

Imports stay in tab memory. Supported inputs are a raw audit row array,
Wrangler's JSON result envelope, or an analysis bundle containing `audit`,
optional `agenda`, and optional `actors`. Limits remain 10 MiB / 50,000 rows.
Invalid imports leave the existing data intact. An event-day agenda snapshot
is preferable if the repository schedule has changed.

`lib/post-event-analysis.ts` replays the complete audit in revision order before
applying the range. Each recorded start creates an event run; a restart appears
as another occurrence with its own time. Occupancy never transfers into a new
run. End, reset, unknown agenda IDs and subsequent starts bound the old reading.
Missing context appears under **Some reports need more context**.

A reading is valid until the next update, event boundary, or five minutes after
submission, whichever comes first. Full/empty periods merge contiguous reports
but never bridge unknown gaps. Averages weight measured time rather than update
counts. Peaks include any still-fresh reading supporting the selected range;
opening/closing are the first/last submitted readings within it. Partial-window
comparisons and missing reports are noted in event details. A reported drop
cannot establish why people left. Recorded start/end times reflect organizer
button actions, not independently verified stage times.

## Testing actual history on localhost

The server-history button reads the database bound to the current server and
requires super-admin access. Normal `next dev` uses local D1; a hosted-site
session does not sign you in locally. Use the exact Local URL printed by Next,
as unapproved hostname aliases can block development resources.

For actual event history without deploying or connecting the entire local app
to production, explicitly run:

```sh
npm run analysis:pull
```

This performs one read-only hosted SELECT through Wrangler and saves
`.wrangler/post-event-analysis/history.json` (git-ignored, mode 0600). Choose
**Import event data** to open it. No migrations, database writes or deployments
occur. `npm run analysis:pull -- --dry-run` prints the query without network
access or file writes. The command never runs automatically.

The static page contains no private records. `GET /api/admin/analysis` checks
`requireAccessApi` and requires `isSuper`, excludes emails/authentication fields,
returns `private, no-store`, and refuses oversized histories without truncation.
Client requests time out after 15 seconds with an actionable error.

## Local verification

```sh
node --test scripts/analysis/*.test.cjs scripts/analysis/*.test.mjs
npx tsc --noEmit
npm run lint
NEXT_PUBLIC_HALL_ISOLATED=1 npm run dev -- --hostname 127.0.0.1
```

Browser-review desktop and phone widths in both `?sample=1&lite=1` and
`?sample=1&lite=0`. Check overview cards, event details, report-dot selection,
full/empty intervals, schedule delay, custom range, empty states and data import.
All model/API/export tests run offline. No new dependencies, migrations,
environment variables, Cloudflare changes or production writes are required.
