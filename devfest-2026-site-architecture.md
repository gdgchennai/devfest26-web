# DevFest Chennai 2026 — site architecture & content inventory

> Companion to `devfest-2026-entry-animation-prompt.md`, which governs `/` only.
> Content below is lifted from the 2025 site and marked with its status for 2026.

---

## The central decision

**Two of these pages are marketing. The rest are utilities.**

`/` and `/memories` exist to make someone want to come. They get the full cinematic treatment.

`/agenda` exists to be read by someone standing in a corridor at IITM Research Park on congested
wifi, holding a phone at 12% battery, working out which hall the Cloud track is in. **Every
millisecond of animation on that page is a cost paid by a person who is already stressed.**
Treating it as another canvas for the motion system is the main way this build goes wrong.

Build the showpiece pages to impress. Build the utility pages to disappear.

---

## Should it be multi-page with nav? Yes.

You asked whether page-to-page navigation is the right model. It is, for reasons specific to this
event rather than general principle:

- **People deep-link the agenda.** During event week the link that circulates in WhatsApp groups
  is not the homepage, it's the schedule. That has to be a URL someone can send, bookmark, and
  reopen offline. A single-page scroll site cannot do this.
- **The 2025 URLs already exist.** `/agenda` and `/contact` are in circulation, in the sponsorship
  brochure, and in people's history. Keep `/agenda` — do not rename it `/schedule` for tidiness.
  Add redirects for anything you do move.
- **The intro only works because it's escapable.** A cinematic hero is a good first impression and
  an obstacle on the fifth visit. Multi-page means someone going straight to `/agenda` never
  touches it. On a single-page site the intro is in the way every single time.
- **Payload.** The agenda must load without the hallway's photos in the bundle.

Keep the nav to five items plus a persistent button:

```
Home   Agenda   Speakers   Venue   About            [Get Tickets]
```

`Get Tickets` is a button, not a nav link, and it is visible on every route at every breakpoint.
It is the only conversion on the site. On mobile it stays pinned in the header while the rest
collapses into a menu.

---

## Routes

| Route | Purpose | Motion budget | Status for 2026 |
|---|---|---|---|
| `/` | The pitch | Full intro + hallway + pile | Build first-class |
| `/agenda` | Multi-track schedule | **None.** Instant paint | Structure known, sessions TBD |
| `/speakers` | Speaker grid | `<Frame>` reveals, `once: true` | **All TBD** — build empty-state first |
| `/speakers/[slug]` | Bio, talk, links | Curtain transition only | TBD |
| `/venue` | Location, travel, amenities | Light fade-ups | Carried from 2025, confirm venue |
| `/memories` | 2024 + 2025 archive | Hallway lives here too | Photos exist |
| `/cfp` | Call for speakers | Light fade-ups | New; time-gated |
| `/contact` | Chapter contact | None | Carried from 2025 |
| `/code-of-conduct` | Required policy | None | Required |
| _404_ | Every unmatched URL, plus `notFound()` | Ambient only | See below |

**`lib/routes.ts` is the one route list.** The header used to hold its own five-item copy in
`siteConfig.nav` while the site had nine routes; it now filters this list by `inNav`, and the
404's rescue grid reads the same list unfiltered. A second hand-written copy is how a 404 ends up
recommending a page that no longer exists.

Build priority, which is deliberately not the order above:
`/agenda` → shared infrastructure → `/` → `/speakers` → the rest.

### The 404

No redirects: every dead URL, including `/sponsors`, lands here. The design rule is that whoever
is reading it is already annoyed, **so every flourish has to shorten the way out rather than
decorate the dead end.** Nothing animates on a delay, nothing blocks, and the headline plus the
full route grid are in the static HTML — readable before hydration and with JavaScript off.

- **"Did you mean…"** — `lib/nearest-route.ts` runs Levenshtein against the real route table and
  offers the closest match as the primary button. `/speaker` → Speakers, `/agend` → Agenda. The
  threshold is a *fraction* of the longer string (0.4), not an absolute edit budget, so a typo in
  a short slug isn't judged like one in a long slug. It deliberately rejects
  `/sponsors` → `/speakers` at 0.5: that page is retired, not misspelled.
- **Retired routes get the actual reason.** `retiredRoutes` in `lib/routes.ts` maps a removed URL
  to an explanation and a useful destination. `/sponsors` says there is no 2026 sponsorship
  programme and points at `/contact`, because the people arriving there followed the 2025
  brochure, which we cannot edit.
- **"Back to where you were"** — same-origin `document.referrer` only, and never a link back to
  the 404 itself.
- **Four brand dots, one burnt out**, in place of a giant "404". The site's identity is those four
  colours, so a missing one says page-not-found in the site's own language without shouting at
  someone who already knows. Opacity-only breathing, off under `prefers-reduced-motion`.
- **Three highlights, then the index** — `components/NotFoundHighlights.tsx` leads with the three
  things people actually came for: when it is (Agenda), how to get in (Tickets), how to get on
  stage (CFP). A dead slug like `/asdfghjkl` has no near match to offer, and a flat list of nine
  routes is an inventory, not an answer. The complete index still follows, deliberately lighter —
  compact pills rather than cards, because it is the fallback and not the main event. Tickets
  reads from `ticketCta()`, so while there is no URL it is a dashed non-link saying so.
- **It ends on the event, not the error** — "Hope to see you at DevFest," with the date and venue
  read from `siteConfig`, so this line can never contradict the hero or the ticket stub.
- An archive photo links to `/memories`.

The path-dependent block is a client component (`NotFoundRecovery`) reading through
`useClientValue`: the 404 is prerendered once at `/_not-found` and served for every unmatched
path, so the URL is only knowable in the browser. Its slot is height-reserved — a page that
shoves its own buttons downward under an already-irritated cursor is the opposite of helpful.

One caveat: for unmatched URLs the 404 is fully server-rendered, but `notFound()` thrown inside
the dynamic `/speakers/[slug]` route streams as an RSC payload in this Next version, so that
path's markup arrives via JS.

---

## Content inventory (from DevFest Chennai 2025)

### Confirmed structure, values to be updated

| Item | 2025 value | 2026 status |
|---|---|---|
| Date | 8 November 2025 | **TBD** |
| Venue | IITM Research Park, Kangam, Taramani, Chennai 600113 | Likely same — confirm |
| Tagline | Build. Learn. Connect | Carry over |
| Ticketing | KonfHub, student + professional tiers | Platform likely same, URL new |
| Tracks | AI, Cloud, Mobile, Web | Revisit — four is a good number |
| Scale claim | 1500+ developers | Update with 2025's actual number |
| Format | Single day | Carry over |

### Sponsor tiers — removed for 2026

**2026 is not running sponsorship.** The `/sponsors` route, `content/sponsors.json`, the
`sponsorTiers` config, `sponsorSchema`/`Sponsor`, and `sponsorsByTier` were all deleted rather
than left dormant, because a tier page with nothing in it and no programme behind it is worse than
no page. Two lines of homepage copy went with them — "What you'll get → Hiring" no longer promises
sponsor booths, and "Why join us" no longer promises a direct line to sponsors.

Kept for reference if it returns: the 2025 structure was Gold → Associate → Community Partners,
filled with Poshmark (gold); Codewalla, Rezoomex, Dinodial (associate); and Women Techmakers
Chennai, Kotlin Users Group Chennai, JS Lovers Chennai, Chennai ReactJS (community). Rebuilding it
means a new schema plus a route — but not new UI: `components/SlotGrid.tsx` already renders a
tiered roster with filled slots, one live invitation and ghost outlines, which is exactly what a
sponsor wall needs.

**`/sponsors` is now a 404, and the URL is in the 2025 sponsorship brochure. That 404 is the right
answer — no redirect.** An earlier note here called for redirecting it to `/contact`; that was
wrong once 2026 became self-funded with no sponsorship programme at all. Sending a sponsor enquiry
to a contact form implies a programme exists and invites a conversation there is no answer to.

The 404 already handles it deliberately rather than by omission: `lib/nearest-route.ts` sets its
similarity threshold at 0.4 specifically so `/sponsors` → `/speakers` (0.5) is *rejected* — "that
page is retired, not misspelled, and guessing at it would be worse than saying nothing." The
visitor gets the full route list and no false lead.

### Sections on the 2025 homepage, and what to do with each

| 2025 section | Verdict |
|---|---|
| Hero — date, tagline, two CTAs | Keep. Now overlaid on the hallway. |
| "What you'll get" — Talks / Hiring / Workshops / Community | Keep, four items, tight |
| "Why join us" — 12-item scrolling marquee | **Cut to 4.** See below. |
| Event highlights — 4 items | Merge into "What you'll get"; they overlap heavily |
| Agenda preview — first few sessions | Keep, as a timeline spine. Same data as `/agenda` |
| Insider tips — 9-item marquee | Keep, but move to `/agenda` where it's actually useful |
| Tracks — 4 lanes | Keep. One Google colour each — see `lib/track-color.ts` |
| Sponsors | **Cut for 2026.** No sponsorship programme this year — section, route and data all removed |
| Venue — address, map, amenities | Keep, link to `/venue` |
| FAQ — 5 questions | Keep, expand |
| Memories — 11 photos from 2024 | **This becomes the hallway.** |
| Final CTA | Keep, as a ticket stub — see below |
| Social footer — X, LinkedIn, Instagram, YouTube, GitHub, Discord | Keep |
| _New:_ Speakers | Added for 2026. A roster with visible open places; the CFP invitation sits in the lineup |

The 2026 homepage runs: hero → What you'll get → Why join us → Tracks → Agenda preview →
Speakers → Venue → FAQ → ticket stub. Every one is wrapped in `components/Section.tsx`, which
owns the shared `max-w-6xl` container, and all but the first are separated by a drawn divider
(`components/SectionDivider.tsx`).

**The divider is a bare hairline — no dot, no chapter number.** It carried both briefly and both
were wrong. The dot repeated the coloured dot in the SectionHeading's eyebrow two rows below it:
same colour, same size, no new information. The number was worse — the first section sits under
the hero and has no divider, so the first index a reader ever saw was "02", and the only fix
would have been to put a rule in the one place it doesn't belong. What remains is the draw
itself, which was the part doing the work. Section colour still comes through, once, via the
eyebrow.

**On the ticket stub:** the closing CTA is printed as a perforated ticket with mono `DATE` and
`VENUE` fields. This is deliberate given the section below — when `siteConfig.date` is null and
`ticketing.url` is null, "TBA" on a ticket reads as a ticket not yet issued, where the same fact
as body copy reads as an unfinished page.

Its colour is split in two on purpose. The four brand colours run at **full strength along a 2px
top edge**, where no text sits on them, and as an **8% wash** across the body. A saturated
four-hue gradient behind body copy makes contrast vary by region and reads like a generic SaaS
hero rather than DevFest; the edge lets the palette be unapologetic where it costs nothing. The
torn half is lifted 5% lighter than the body so the perforation reads as a real seam rather than
a dashed line.

`components/TiltCard.tsx` gives it a small pointer-tracked tilt and a foil sheen, both opted into
in CSS behind `hover: hover` and `prefers-reduced-motion: no-preference`. **The tilt is capped at
3.5°** — this is the site's one conversion element, and a card that swings far enough to move its
own button out from under an approaching cursor costs more than the effect is worth.

### Contrast floor

**Muted text on this site must be checked, not eyeballed.** Every low-opacity label is composited
over ink (`#1e1e1e`), and the intuition for how dark that gets is unreliable — `text-paper/50`
lands at **4.64:1**, barely over the 4.5:1 floor, not the comfortable margin it looks like.
Anything below `paper/50` on ink fails, and on a lifted panel (`Card`, the stub end, the 404
pills) the floor rises again: `paper/45` on a `paper/3%` card is **3.91:1**, `paper/40` is
**3.39:1**.

Rules of thumb, all verified rather than estimated: **`paper/60` is the safe minimum for small
text on any surface** on this site; `paper/55` is the minimum on a 3% panel; never go below
`paper/50` anywhere. Check against the *lightest* point a gradient reaches, not flat ink.

**On the marquees:** the 2025 "Why join us" marquee has twelve items duplicated four times in the
DOM — 48 nodes to achieve a loop. Two problems. Technically, a CSS marquee needs exactly two
copies and a `translateX(-50%)` animation. Editorially, twelve reasons is not twelve times more
persuasive than four; a reader scanning a moving strip retains almost nothing, and several of the
2025 items say the same thing in different words. Pick the four that are actually true and
specific to Chennai, and set them still.

---

## The content problem to solve first

The 2025 site's hero says the event is on November 8. Its FAQ says the date will be announced soon.
Both statements are hardcoded in components, one was updated and the other wasn't, and it shipped.

This is the failure mode to design against, and it drives the whole content model:

**In `site.config.ts`** — date, venue, ticket URL, tracks, capacity claim, social links, CFP
open/close timestamps. Every component reads from here. No fact appears as a literal twice.

**In the repo** (`/content`, MDX or JSON) — speakers, sponsors, FAQ, about, CoC. Changes rarely,
needs version history, involves images that want `next/image`. A pull request is the right friction
for "we're announcing a keynote."

**In a Google Sheet** — the agenda only. One row per session:
`track, start, end, title, speakerSlug, hall, type`. Pulled at build with ISR revalidating every
60s. Validate rows with Zod and fall back to the last good build if one is malformed.

The reasoning for the Sheet: the agenda changes constantly in the final fortnight, the people
changing it are organisers without the repo cloned, and sometimes it changes an hour before a
session because a speaker's flight is late. Requiring a git push and a deploy for that is how the
website ends up contradicting the actual event. The sheet stores `speakerSlug` and joins to the
in-repo speaker records — never duplicate speaker names into it, they will drift.

---

## Building before the content exists

Almost everything about 2026 is undecided, so build for absence explicitly:

- Every section renders a designed empty state, not a blank gap. `/speakers` with zero speakers
  should say the lineup is being finalised and link to the CFP — that's a useful page, not a
  broken one.
- Prefer an **open roster over an apology.** `components/SlotGrid.tsx` renders a list whose content
  hasn't landed as fixed places: the filled ones, one live invitation, and the rest as ghost
  outlines. The reader sees how many places exist and that one is theirs, instead of a sentence
  saying the list is empty. `components/SpeakerWall.tsx` is the consumer — its invitation reads
  "This could be you" and points at `speakerCta()` in `lib/cta.ts`, which prefers
  `siteConfig.cfp.formUrl` (Sessionize) and falls back to `/cfp`.
- **Never render a label the config cannot honour.** `lib/cta.ts` is the single place that decides
  this. While `ticketing.url` is null there is nowhere to buy a ticket, so the header and the
  closing CTA say "Tickets open soon" as inert text rather than showing a "Get Tickets" button
  that silently lands on `/agenda`.
- `site.config.ts` supports `date: null`, which renders "Date to be announced" everywhere at once.
  One switch, one truth, no possibility of the 2025 contradiction repeating. **The 2026 date is
  `2026-10-10`.** Change that one field and the hero, the agenda header and the ticket stub all
  follow; the session dates in `content/agenda.json` are the one thing that does *not*, so move
  them by hand at the same time. The FAQ deliberately no longer states the date — that is exactly
  the hand-written second copy that broke in 2025.
- **All dates and times render in `Asia/Kolkata`, pinned in `lib/format.ts`.** Not optional: these
  routes are statically generated and Vercel builds in UTC, so an unpinned `toLocaleTimeString`
  shipped 09:00 IST sessions to everyone as "03:30". The agenda components are client components
  too, so an unpinned formatter also made the server and the browser disagree at hydration.
- Gate whole routes on content: if `speakers.length === 0`, drop Speakers from the nav rather than
  linking to an empty page.
- The hallway runs on 2024 and 2025 archive photos, which already exist. This is the one showpiece
  you can finish now, which is a good reason to start there.

---

## Event-day requirements — `/agenda`

Non-negotiable:

- Statically generated. No client-side fetch on first paint. Under 100KB, no hero image.
- Service worker caching the route, so it opens on a dead connection. Someone who loaded it in the
  morning must be able to read it in a basement hall at 4pm.
- Current-session highlighting from the device clock, with an "on now" marker. Most-used feature,
  most-often forgotten.
- Track filter persisted in the URL so it survives reload and can be shared.
- Hall/room number at the same visual weight as the title. At the venue that's the thing people
  are actually looking for.
- Minimum 16px body, high contrast, generous tap targets.
- Test on a mid-range Android over throttled 3G before the event, not on your laptop.
- The path from "landed on the site" to "reading the agenda" should never require finishing an
  animation. **Currently unmet — this is a known gap, not a satisfied requirement:**
  - There is no header. `components/Header.tsx` and `HeaderNav.tsx` were removed pending a
    redesign, so `navRoutes` in `lib/routes.ts` currently has no consumer and `/agenda`, `/about`,
    `/cfp`, `/memories` and `/speakers` are reachable only from whatever links a given page
    happens to carry. Restoring site-wide navigation is the blocking item.
  - There is no skip control. `components/motion/IntroEscape.tsx` still exists and still handles
    both the "Skip intro" button and the Escape key, but nothing renders it — the intro can only
    be dismissed via the loader's "Enter" button. Mounting it is the fix; the component is done.

---

## Shared infrastructure

Built once in the root layout, consumed everywhere. **This lands before anything else.**

- **`<Frame>`** — every image on every route, including speaker headshots and sponsor logos.
- **The ink curtain** — route-transition sweeps between pages. The first-visit intro is its own
  full-screen white loader overlay (`components/motion/Loader.tsx`): the four brand dots bounce in
  a loop while assets decode, then morph into the DevFest `> <` mark, and an "Enter the DevFest
  experience" button hands off to a simulated smooth scroll through the hallway.
- **One Lenis instance** — created in the layout, never per-page, and **not created at all** for
  reduced-motion or lite. Smooth scrolling is motion: it used to run for everyone, so a visitor
  who had asked for no motion still got momentum smoothing, gliding PageDown/arrow keys, and
  find-in-page jumps that landed off-target. Without it ScrollTrigger simply reads native scroll
  events; the `lenis.on("scroll", ScrollTrigger.update)` wiring exists only because Lenis takes
  the scroll over.
- **`site.config.ts`** — single source of truth for every fact.
- **Lite mode** — `?lite=1` on, `?lite=0` off, either way persisted. The toggle drives the
  preference through the URL so the choice is linkable, testable and reversible. Shares its
  rendering path with reduced-motion and no-JS; see Part 4 of the motion spec. Site-wide, not a
  homepage feature.
  - **Reachable in four places, each on screen once** — under the loader's "Enter" CTA (where the
    choice is actually made), in `<IntroEscape>`'s corner during the flythrough, as the footer
    toggle (`aria-pressed`, visible on/off state) on every route, and — going the other way — a
    "Switch to the full experience" link in `<StaticHero>`. Lite is a preference, not a one-way
    door: verified end to end that `?lite=0` clears the stored value and the WebGL hero returns.
  - **What lite drops:** three.js (marquee + 3D title), the hallway, the preloader/intro, Lenis,
    and every photo — measured at **0 image requests vs 5.7 MB**, and 316 KB of JS vs 511 KB.
    `ExpectShowcase` renders brand halftone panels instead of its decorative archive photos,
    which alone were 1.76 MB of raw originals.
  - **Switching modes is always a full page load, never a client-side swap.** The footer toggle
    sets `window.location.href`; every other lite control is a plain `<a href="?lite=…">`, and
    `MotionProvider`'s link interceptor only hijacks hrefs starting with `/`, so these are never
    caught. That means there is nothing to tear down when you switch: the old document's GSAP
    tickers, Lenis instance, WebGL contexts and module registry all die with it, and the new
    document decides from scratch. Going lite → full cannot "crash from too many imports" — it is
    byte-for-byte a first visit. Verified end to end (canvases 3 → 0 → 3, no exceptions).
    - The dangerous pattern is the opposite one: flipping the preference *mid-session* and
      swapping components while a ScrollTrigger is pinned. That is what the hallway skill warns
      about. Nothing does it — the preference is read once per document.
  - **Known, deliberately not fixed:** roughly **125 KB of lite's 316 KB** is GSAP + ScrollTrigger
    + Lenis + the homepage's motion components, statically imported and never executed. Removing
    it is not a small change: `MotionProvider` lives in the **root layout**, so it reaches every
    route, and the homepage additionally imports eight components that pull GSAP at module scope.
    A real fix therefore needs both a dynamic import inside `MotionProvider` *and* a server-side
    branch in `app/page.tsx` — which means `cookies()` (giving up static prerendering for
    everyone) or a proxy rewrite plus a duplicate route tree.
    - **Not worth it right now.** The bandwidth argument is already won elsewhere: lite dropped
      **5.7 MB of images to zero**, ~45× the JS in question, and the JS is gzipped, cached once,
      and reused across every route. The cost lands on the root layout — the single
      highest-blast-radius file, holding the Lenis/ScrollTrigger wiring the whole site's motion
      depends on.
    - If it is ever picked up, do it in this order: (1) dynamic-import GSAP/Lenis inside
      `MotionProvider`'s effect, which is contained to one file and already sits behind a
      `shouldUseStaticBaseline()` early return; (2) only then consider the page-level branch.
      Step 1 alone buys the non-homepage routes; the homepage needs step 2.
- **Metadata** — per-route `generateMetadata`, one OG template with the route title composited in.
- **Fonts** — `public/fonts/google-sans-latin.woff2`, generated by `npm run fonts`. Never point
  `next/font/local` at the raw TTF in `Google_Sans/`: it copies the file byte for byte, so the
  4.6 MB source shipped 4.6 MB to every visitor — about nine times the entire hero photo payload.
  Subset to Latin and transcoded it is **95 KB, 98% smaller**, with the 100–900 variable axis
  intact. The italic face is deliberately not loaded; nothing renders italic, and its 4.6 MB was
  one stray `<em>` from being fetched. Re-run the script when the source font changes or the site
  needs characters outside Latin Extended-A.

### The hallway

`components/motion/usePhotoHallway.ts` drives both the homepage hero and `/memories`. It pins its
container, then flies the archive photos toward a virtual camera: each card fades in, scales up,
drifts out toward its own corner, and passes — several visible at different depths at once —
before the whole set settles into the closing pile.

Things to know before changing it:

- **Adding photos:** drop camera originals in `assets/` and run `npm run archive`. It resizes them
  into `public/archive/`, reads the capture year and dimensions, and appends entries to
  `content/archive.json` without touching captions you have already written. You then write a title
  and description for each new photo — the description is the alt text and cannot be generated. The
  section lengthens to match: card lifespans come from a depth model derived from the item count,
  not per-index windows, so pacing stays even instead of compressing as the archive grows.
  `assets/` is gitignored; only the web copies are committed.
- **Array order is art direction** — it is the order photos fly past the camera, and the homepage
  hero takes the first 12 (desktop) or 7 (mobile). The ingest script appends rather than sorts, so
  placing a new photo is a deliberate edit.
- **`width`/`height` are required in the JSON** so each card is shaped to its true ratio on the
  first frame. Measuring with `img.onLoad` instead reflows cards mid-scroll.
- **Pacing knob:** `perItemVh` — viewport heights of scroll per photo, default `0.3`. Standalone
  galleries of this kind use ~1.15; this one sits above a whole site, and at 1.15 the hero would
  eat roughly fourteen screens before a visitor reached any content.
- **The render loop is driven by a scrubbed proxy tween, not `onUpdate(self.progress)`.** A
  scrubbed ScrollTrigger only interpolates smoothly when it drives an actual animation; reading
  progress directly steps with every wheel notch. Do not "simplify" this away.
- **Reduced motion and lite mode skip it entirely** via `shouldUseStaticBaseline()` — the hero
  falls back to `StaticHero`, `/memories` to its year grids. (Save-Data does *not*: see
  `isSaveData` in `lib/motion-prefs.ts` for why that gate was removed.) That baseline is also
  what server-renders, so the motion path never unmounts a live pinned trigger after hydration.

---

## Asset payload & preloader failure policy

**Status: implemented.** Numbers are from a headless-Chrome run against a production build at
1440×900, counting `encodedDataLength` (over the wire).

### The measurement

Optimising lite was optimising the path almost nobody takes. **Main is the default** — a visitor
with no stored preference gets the full experience — so main is where payload actually matters.

| Path | JS | Images before | Images after |
| --- | --- | --- | --- |
| Main (first visit) | 511 KB | **5.76 MB** (5.04 MB of it raw `/archive/*.jpg`) | **1.08 MB**, zero raw |
| Reduced motion | 502 KB | 3.30 MB | **0.60 MB** |
| Lite | 316 KB | 0 KB | 0 KB (unchanged) |

**~4.7 MB off every first visit**, with the hero visually identical — verified by screenshot at
matched elapsed time, and by zero console errors/exceptions in all three modes.

### Where the 5 MB comes from

`useAssetsLoaded` warms its `assets` list by **raw URL**, and `HeroSection` passes
`archivePhotos.map(p => p.src)` — **all 15 originals**, 230–505 KB each. The justifying comment
says the raw list exists for two consumers that "cannot use `/_next/image`": the curved marquee's
three.js `TextureLoader`, and `ExpectShowcase`'s plain `<img>`.

Both halves of that are now false:

1. **`ExpectShowcase` no longer uses raw** — it renders through `next/image` (and brand halftone
   panels in lite). Its share of the raw warm is pure waste, and the page fetches optimised copies
   on top of it.
2. **`TextureLoader` can use `/_next/image` perfectly well.** It is a URL handed to an `Image`
   element; the browser still content-negotiates AVIF/WebP. Measured on a real archive photo:
   **517 KB raw → 72 KB at `w=1080`, an 86% reduction.**

And only **8** of the 15 are ever used as textures (`IMAGE_SRCS` slices to 8), so ~7 images
(~2 MB) are warmed and then rendered by nobody at that URL.

### Options considered

| | Approach | Verdict |
| --- | --- | --- |
| **A** | Marquee textures via `/_next/image`; narrow the warm list to exactly those 8 | **Chosen.** ~5.76 MB → ~1.3 MB, 3 files, reversible, no build-pipeline change |
| B | Stop warming marquee textures at all; let the marquee fill in progressively | Rejected — contradicts the deliberate "preloader holds until everything is ready, nothing pops in unloaded" decision. That is a product call, not a perf tweak |
| C | Build-time texture generation via a `scripts/` step, like `npm run fonts` / `npm run archive` | **Deferred, not dismissed.** Zero runtime optimiser cost, exact dimensions, no coupling to Next's image defaults, and warm/consumer URLs become literally the same static file. Costs a pipeline + committed binaries. Revisit if A's coupling causes trouble |
| D | Progressive marquee — 2–3 textures first, stream the rest | Rejected — complexity, and visible gaps in the strip |
| E | Single sprite atlas for all 8 textures | Rejected — best compression and 1 request, but needs UV maths changes inside the animation code. Too risky for the gain |

### Guardrail 1 — warm/consumer URL drift

The preloader is only useful if it warms **the exact URL the consumer later requests**. A mismatch
is silent and expensive: the dots keep bouncing on an asset nothing wants, then hand off to cards
that still have to fetch. That has already happened twice here (once for the flythrough's `Frame`s,
once for `unoptimized`).

A shared helper is not enough — two call sites can still pass different widths. **The consumer owns
the list:** `CurvedMarqueeHero` exports `MARQUEE_TEXTURES`, the exact URL array it hands to
`TextureLoader`, and `HeroSection` passes *that same array* to `useAssetsLoaded`. One array, no
second source of truth, drift impossible by construction rather than by convention. The single-width
URL builder (`optimizedSrc`) lives beside `DEVICE_SIZES` and `DEFAULT_QUALITY` in
`useAssetsLoaded.ts`, so the coupling to Next's image defaults stays in one file.

Optional dev-only check: after hand-off, compare each warmed URL against
`performance.getEntriesByType("resource")` and warn when one appears exactly once (warmed, never
consumed — a cache hit still logs a second entry). Development only, and advisory: entry counting
is not guaranteed across browsers.

### Guardrail 2 — fail fast, and fall back rather than hand off broken

Current behaviour, stated accurately: `Promise.allSettled` means a **definitive** failure (a 404,
a decode error) does *not* block — hand-off happens once every wait settles. `MAX_DURATION`
(15 s) only trips when something genuinely **stalls**. Three gaps remain:

1. **`fetch(TITLE_TYPEFACE)` cannot fail.** `fetch` rejects only on network failure; a 404 gives
   `ok: false` and `.arrayBuffer()` happily resolves on the error body. A missing typeface is
   therefore recorded as **success** — the preloader hands off and the 3D title silently never
   renders. Needs an explicit `if (!r.ok) throw`.
2. **No per-asset budget.** One stalled connection burns the whole 15 s even when everything else
   settled in 2 s. Each wait should carry its own shorter budget and be treated as failed past it.
3. **Nothing records *what* failed**, so nothing can distinguish "one minor image missing, carry
   on" from "the experience this intro exists to introduce cannot render".

Failure is now a **result**, not just an absence of waiting: `useAssetsLoaded` returns
`{ ready, degraded }`, where `degraded` means a load-bearing asset definitively failed —
the typeface, three.js, or *every* marquee texture. A single missing photo is deliberately not
degradation. `HeroSection` then renders `StaticHero` instead of `CurvedMarqueeHero`, and skips
`MIN_DURATION` (making someone watch a decorative beat before telling them the decoration is not
coming is the wrong trade).

This is newly worth doing **because `StaticHero` now exists**. Before it, "activate the fallback"
meant a black screen with two links, so waiting out the timeout was genuinely the better of two bad
options. It is not any more.

`SectionBoundary` already covers the case where a motion component *throws*. This covers the other
one: it did not throw, it just never arrived.

Verified by blocking each asset class in the browser:

| Injected fault | Hand-off | Hero shown |
| --- | --- | --- |
| none | 5.4 s | `CurvedMarqueeHero` |
| typeface 404 | 4.3 s | `StaticHero` |
| all marquee textures blocked | 4.3 s | `StaticHero` |
| three.js chunks blocked | 4.2 s | `StaticHero` |
| typeface stalls forever | 11.6 s | `StaticHero` |

### The bug this uncovered: the gate was never wired

`useAssetsLoaded` initialised its state with `useState(disabled)`. On the hydration render
`shouldUseStaticBaseline()` returns its **server** value `true`, so `showLoader` is false, so
`disabled` is true — and `ready` initialised to `true`. `useState` ignores later argument changes,
so when `disabled` flipped false a render later, nothing set `ready` back.

**The preloader therefore never waited for anything, and `MIN_DURATION` / `MAX_DURATION` were both
dead code.** It looked convincing because the bounce only hands off on a cycle boundary and then
plays a morph, so there were always a few plausible seconds of dots. It was caught by pausing the
typeface request forever and watching hand-off happen on schedule anyway.

`ready` is now derived (`disabled ? {ready:true} : state`) rather than seeded, so it tracks
`disabled` instead of freezing at whatever the first render saw. **Consequence worth knowing:** the
preloader now genuinely waits, so a slow connection sees a longer intro than it used to — which is
the documented intent ("holds until everything is ready rather than downgrading slow visitors"),
and is now bounded by `ASSET_BUDGET` per source rather than being unbounded.

---

## Brand compliance

DevFest and GDG branding is governed by Google's community program guidelines, and each year's
official DevFest brand kit specifies permitted logo lockups, colour usage, and required
attribution. Get the 2026 kit from the organiser dashboard and check it **before** finalising the
design — community events are typically required to state plainly that they're community-run
rather than a Google product, and there are usually constraints on how the four Google colours and
the Google logo may be used.

This matters practically because the loader mark (all four dots/pills) and the fallback panels
both lean on those four colours. If the kit restricts that usage, those are the two places to adapt, and it is much
cheaper to know now.

### The palette, as implemented

All four ramps live in `app/globals.css` as tokens. **Do not hand-mix new shades — pick from
these.** Core `#4285F4 #34A853 #F9AB00 #EA4335`, halftones `#57CAFF #5CDB6D #FFD427 #FF7DAF`,
pastels `#C3ECF6 #CCF6C5 #FFE7A5 #F8D8D8`, greyscale `--paper #F0F0F0` / `--ink #000`.

Four contrast constraints fall out of it, all measured:

- **Button labels are ink, not paper.** Paper on `#4285F4` is 3.56:1 and the label is 14px, which
  needs 4.5:1. Ink gives 4.68:1. The palette has no darker blue, so the label is what changes.
- **Fallback panels use halftones with an ink label** (7.0–11.7:1). They previously used four
  hand-mixed dark shades with a `paper/55` label at 1.49–2.33:1, which was unreadable. Pastels
  would score higher still but flash near-white against the dark page while a photo decodes.
- **The hero scrim is `bg-ink/65`, not `/45`.** Over a blown-out area of a photo, `/45` against
  the lighter `#1E1E1E` ink measures 2.47:1 under the small date line; `/65` restores 4.54:1.
- **The site is dark-only, and this is a decision — do not add a light theme.** A `--theme` custom
  property once scrubbed `--ink`/`--paper` from dark to light partway down the homepage. It was
  removed because the brand kit cannot support it: measured on white, the four core colours are
  blue 3.56:1, red 3.92:1, green 3.06:1 and yellow **1.93:1**, all under the 4.5:1 needed for text.
  That breaks `text-blue` links and all four `lib/track-color` track headings. There is no fix
  inside the kit — as the first constraint above notes it has no darker shades, and both other
  ramps (halftone, pastel) are *lighter*, not darker. On the dark page those same four measure
  5.89 / 5.35 / 6.87 / 10.85:1 and all pass. Reviving a light theme means first commissioning
  on-light brand variants; it is not a CSS change.

  The **intro loader is the deliberate exception**: a full-screen white field, so the four brand
  dots read at full saturation as they morph into the mark. It is a literal `bg-white` in
  `Loader.tsx` and does not touch these tokens, so it is unaffected by the above.

---

## Team split

- **Shared infrastructure** — `<Frame>`, curtain, Lenis, config, metadata. Lands first, unblocks
  everyone. If the motion person and the data person each build their own image component, you
  will be reconciling two of them in the last week.
- **`/` and `/memories`** — the motion work, following the entry-animation prompt.
- **`/agenda` and `/speakers`** — Sheets pipeline, Zod schemas, service worker, empty states.
