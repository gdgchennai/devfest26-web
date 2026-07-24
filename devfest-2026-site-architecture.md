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
- **Payload.** The agenda must load without the hallway's twelve photos in the bundle.

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
| `/sponsors` | Tiers + logos + brochure | Light fade-ups | Tiers known, logos TBD |
| `/memories` | 2024 + 2025 archive | Hallway lives here too | Photos exist |
| `/cfp` | Call for speakers | Light fade-ups | New; time-gated |
| `/contact` | Chapter contact | None | Carried from 2025 |
| `/code-of-conduct` | Required policy | None | Required |

Build priority, which is deliberately not the order above:
`/agenda` → shared infrastructure → `/` → `/speakers` → the rest.

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

### Sponsor tiers

Gold → Associate → Community Partners. 2025 filled these with Poshmark (gold); Codewalla,
Rezoomex, Dinodial (associate); and Women Techmakers Chennai, Kotlin Users Group Chennai, JS Lovers
Chennai, Chennai ReactJS (community). **All 2026 sponsors TBD.** Keep the tier structure and the
sponsorship brochure link; build the page so an empty Gold tier renders gracefully rather than
leaving a hole, because it will be empty for months.

### Sections on the 2025 homepage, and what to do with each

| 2025 section | Verdict |
|---|---|
| Hero — date, tagline, two CTAs | Keep. Now overlaid on the hallway. |
| "What you'll get" — Talks / Hiring / Workshops / Community | Keep, four items, tight |
| "Why join us" — 12-item scrolling marquee | **Cut to 4.** See below. |
| Event highlights — 4 items | Merge into "What you'll get"; they overlap heavily |
| Agenda preview — first few sessions | Keep, pulls from the same data as `/agenda` |
| Insider tips — 9-item marquee | Keep, but move to `/agenda` where it's actually useful |
| Tracks — 4 lanes | Keep |
| Sponsors | Keep |
| Venue — address, map, amenities | Keep, link to `/venue` |
| FAQ — 5 questions | Keep, expand |
| Memories — 11 photos from 2024 | **This becomes the hallway.** |
| Final CTA | Keep |
| Social footer — X, LinkedIn, Instagram, YouTube, GitHub, Discord | Keep |

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
- `site.config.ts` supports `date: null`, which renders "Date to be announced" everywhere at once.
  One switch, one truth, no possibility of the 2025 contradiction repeating.
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
- Reachable in one tap from the loader's escape-hatch row and from the header on every route. The
  path from "landed on the site" to "reading the agenda" should never require finishing an
  animation.

---

## Shared infrastructure

Built once in the root layout, consumed everywhere. **This lands before anything else.**

- **`<Frame>`** — every image on every route, including speaker headshots and sponsor logos.
- **The ink curtain** — intro mode on first session load, transition mode on route change.
- **One Lenis instance** — created in the layout, never per-page.
- **`site.config.ts`** — single source of truth for every fact.
- **Lite mode** — `?lite=1` plus a persisted preference, exposed as a "Lite version" link in the
  footer of every route. Shares its rendering path with reduced-motion and no-JS; see Part 4 of
  the motion spec. Site-wide, not a homepage feature.
- **Metadata** — per-route `generateMetadata`, one OG template with the route title composited in.

---

## Brand compliance

DevFest and GDG branding is governed by Google's community program guidelines, and each year's
official DevFest brand kit specifies permitted logo lockups, colour usage, and required
attribution. Get the 2026 kit from the organiser dashboard and check it **before** finalising the
design — community events are typically required to state plainly that they're community-run
rather than a Google product, and there are usually constraints on how the four Google colours and
the Google logo may be used.

This matters practically because the loader dot and the fallback panels both lean on those four
colours. If the kit restricts that usage, those are the two places to adapt, and it is much
cheaper to know now.

---

## Team split

- **Shared infrastructure** — `<Frame>`, curtain, Lenis, config, metadata. Lands first, unblocks
  everyone. If the motion person and the data person each build their own image component, you
  will be reconciling two of them in the last week.
- **`/` and `/memories`** — the motion work, following the entry-animation prompt.
- **`/agenda` and `/speakers`** — Sheets pipeline, Zod schemas, service worker, empty states.
