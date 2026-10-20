# Hall emergency fallback

The frontend gateway supports the runtime variable `HALL_LIVE_ENABLED`.
Missing or `true` enables Live. The value `false` pauses public Live access.
The flag is case-insensitive and trims whitespace. It is a Cloudflare runtime
variable, not a Next.js build variable or private hall backend setting.

## Before the event

Deploy the frontend containing this implementation once, with Live enabled.
Confirm the frontend target in root `wrangler.jsonc`; this checkout targets
`devfest-hall-availability-test` (a Git branch rename does not rename a Worker).
The private `devfest-hall-live` backend needs no deployment for this switch.

From this branch's repository root, the one-time normal frontend deployment is:

```bash
AGENDA_READY=true NEXT_PUBLIC_HALL_ISOLATED=0 npm run deploy
```

This rebuilds the full application instead of publishing an isolated local-test
bundle. Check the target remains `devfest-hall-availability-test` before running it.
Do not use `hall:build` output for production. Subsequent emergency toggles use
only the dashboard steps below.

Verify `/agenda` returns the schedule. The frontend must be built with
`AGENDA_READY=true`; that existing build-time flag gates Agenda separately.
Agenda can use the bundled schedule when its D1 content lookup fails/times out.
This fallback cannot protect against a failure of the entire frontend Worker,
Cloudflare account, or exhausted account-wide request allowances.

## Pause Live

1. Open Cloudflare → Workers & Pages → **devfest-hall-availability-test**.
2. Open Settings → Variables and Secrets. Add/edit a **Text** variable:
   **`HALL_LIVE_ENABLED` = `false`**.
3. Select **Deploy** to apply the configuration to the serving version. No
   Next.js rebuild, Git push, migration or backend change is needed to toggle it.
   Use a full rollout; mixed versions can give mixed behavior.
4. Open `/api/halls/availability`: it must return `{"enabled":false}`.
5. Open `/live` in a new/private tab: it must land on `/agenda`. Confirm the
   schedule is visible and Live is absent from navigation.

The gateway returns an uncached temporary 307 for `/live` and `/live/`, including
query strings and Next.js route requests. It rejects new public socket and
snapshot requests with 503 without contacting the hall service. The status
endpoint avoids D1, authentication and the hall Durable Object. Other pages
remain available; an HTML marker hides Live links/content before hydration.
The normal organizer control API stays available, but organizer WebSocket
updates share the paused public endpoint.

## Already-open pages

A variable change cannot push a command to an existing browser socket.
Updated clients check on Live entry, foreground return, back/forward-cache
restoration and reconnect attempts. A confirmed pause hides Live content and
uses full navigation to `/agenda`, bypassing client route caches.
An initial or disconnected public connection without a usable snapshot for
20 seconds also falls back to Agenda. Successful snapshots clear that deadline;
hidden tabs suspend it. Organizer pages do not use this automatic redirect.

There is no periodic HTTP polling. One shared check runs at document startup;
Live entry/foreground return can request a fresh check. Reconnect checks share
in-flight requests and a 30-second cache. Each uncached status check consumes a
frontend request, but no hall/D1 request. A failed status check preserves the
last known setting rather than declaring a healthy hall disabled.

Healthy, continuously foregrounded pages with an already-open socket are not
redirected immediately. A half-open socket after its first snapshot still needs
a transport close or foreground/reload event to trigger recovery. In an
emergency, ask attendees with an old page to refresh or open Agenda.
Browsers loaded before this implementation need a reload to gain its client
handling, although the gateway still handles their new requests.

## Resume Live

Set **`HALL_LIVE_ENABLED` = `true`** in the same frontend Worker and select
**Deploy**. Verify `/api/halls/availability` returns `{"enabled":true}` and
`/live` loads normally. Refresh existing Agenda tabs to restore their Live link.
The redirect is temporary and `no-store`, so browsers should not retain the pause.
`keep_vars: true` in Wrangler preserves dashboard variables on later CLI deploys.
Do not add a conflicting fixed value in Wrangler or the deployment command.

## Local verification

The gateway runs in Workers preview, not plain `next dev`. Add
`HALL_LIVE_ENABLED=false` to the frontend `.dev.vars`, or supply
`--var HALL_LIVE_ENABLED:false` to Wrangler. Use only one Miniflare instance per
state directory. The isolated hall build is for local verification only; rebuild
the normal application before any production deployment.

References: [runtime variables](https://developers.cloudflare.com/workers/configuration/environment-variables/#add-environment-variables-via-the-dashboard),
[preserving dashboard variables](https://developers.cloudflare.com/workers/wrangler/configuration/#top-level-only-keys).

## Verification recorded on 16 October 2026

`node scripts/hall-live/emergency-switch-test.mjs` passed against real local
workerd: pause/resume, absent backend bindings, temporary/no-store redirects,
HEAD, status endpoint methods and HTML masking. Root and hall Worker typechecks
passed. The isolated OpenNext build passed; lint retained its existing 10 errors
and 4 warnings with no new findings in the added code.

Browser checks confirmed disabled `/live` lands on the usable Agenda and hides
Live links at desktop/phone widths in lite and full modes. Enabled Live received
a snapshot. With the local public backend binding deliberately absent and the
switch enabled, the browser moved to Agenda after the connection deadline.
Those implementation checks used only local state. The subsequent frontend
deployment is recorded below; no production hall writes or load test were performed.


## Deployment recorded on 16 October 2026

The normal frontend build was deployed to
`https://devfest-hall-availability-test.gdg-chennai.workers.dev` with Live enabled.
Serving version: `9960dc1e-cd29-492d-951f-f6327b0649ff`, at 100% traffic.
The optimized private hall backend was not redeployed. Existing dashboard logs,
traces and Issues monitoring are preserved explicitly in `wrangler.jsonc`.

Hosted read-only checks returned 200 for `/live`, `/agenda`,
`/api/halls/availability` and Google provider discovery. Availability returned
`{"enabled":true}`. A public WebSocket received a current snapshot and answered
protocol ping. The full production build excludes local identity/clock tools.
The frontend bundle was 2,234.60 KiB gzipped. No live pause was triggered during
verification; disabled behavior was verified in the local Worker/browser tests.
The dashboard instructions above are now usable on this deployed Worker.
