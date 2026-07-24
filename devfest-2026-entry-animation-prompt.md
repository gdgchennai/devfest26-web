# Implementation prompt — DevFest Chennai 2026 entry sequence + zoom-scroll gallery

> Paste everything below into Claude Code / Cursor as the initial build prompt.
> Timing values are a tuned starting point, not gospel — see "Calibration" at the end.

---

## Context

Build the **landing page** for **Google Developer Group Chennai — DevFest 2026**. It has not been
started; this is a greenfield build. The hero uses photography from **DevFest 2025** for both the
entry reveal and a scroll-driven zoom gallery.

This is the front door of a multi-page site — see `devfest-2026-site-architecture.md` for routes,
content model, and which pages get motion. **This document governs `/` only.** Two things here are
site-wide and must be built as shared infrastructure rather than page-local: the ink curtain
overlay (reused for route transitions) and the `<Frame>` component (used by every image on every
page).

The reference for motion feel is `podium.global` — a cinematic, load-gated entry: a loading
indicator over black, then a single frame opening out to full bleed while masked text lines rise
into place, then smooth scroll hands over to the user. **No 3D / perspective work anywhere.**

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + GSAP (`useGSAP`, ScrollTrigger) +
Lenis. No animation library beyond these. Deploy target is Vercel.

---

## Design tokens

```
--ink        #0A0A0B   page base, near-black, not pure black
--paper      #FFFFFF   type on ink
--blue       #4285F4
--red        #EA4335
--yellow     #FBBC04
--green      #34A853

/* muted variants — used only for image fallback panels, see below */
--fb-blue    #3B6FD4
--fb-red     #C93A2E
--fb-yellow  #D9A004
--fb-green   #2C8348
```

The four Google colours are **markers, not fills**. Outside the loader dot and the fallback
panels, they appear only on: eyebrow dots, link hover underlines, and focus rings. Everything else
is ink and paper. Do not build gradients from them.

**Type:**
- Display: `Google Sans Display` if the chapter's brand kit is available, else `Familjen Grotesk`.
- Body: `Google Sans Text`, else `Inter`.
- Utility/numerals: `JetBrains Mono`, `font-variant-numeric: tabular-nums`.

Monospace numerals are deliberate — it's a developer conference, and tabular figures stop the
counter jittering as digit widths change.

**Signature element:** the hero photo opens from a small centred frame to full bleed. The same
frame-opening logic reappears in the zoom gallery, and the fallback panels use the same frame. One
idea, stated three times, is the whole visual argument.

---

## Part 1 — The entry sequence

### Phase A: gated load (before t=0)

A fixed full-viewport `--ink` overlay covers everything. `<body>` has `overflow: hidden` and Lenis
is **not** started yet.

Bottom-left, on one baseline, in JetBrains Mono at clamp(2.5rem, 6vw, 5rem):

```
●  47%
```

**The dot cycles through the Google colours, and its speed is the progress bar.**

- 10px circle, `border-radius: 50%`, sitting to the left of the counter with `1ch` gap.
- Colour order: blue → red → yellow → green, looping.
- Swap interval interpolates with progress: `interval = 480 - (320 * progress/100)` ms. So it
  ticks lazily at ~480ms when loading starts and accelerates to ~160ms as it completes. The dot
  gets visibly more urgent as the page gets closer to ready — the colour cycle *is* the progress
  indicator, not decoration next to one.
- Instant colour swap, no crossfade. At 160ms a crossfade turns to mud. Optional: a
  `scale(1 → 1.15 → 1)` micro-pulse on each swap, but cut it if it reads as busy.
- Drive the swap from the same `requestAnimationFrame` loop as the counter, accumulating elapsed
  time. Do **not** use `setInterval` with a changing delay — it drifts and fights the counter.
- **At 100% the dot settles on green** and holds 180ms before the reveal starts. Green means done;
  that's the only moment the colour carries a literal meaning, and it's the handoff cue.

**Progress is real, not faked.** Preload an explicit manifest:

```ts
const HERO_ASSETS = [
  '/hero/devfest-2025-01.avif',
  // ...only assets needed for the first viewport
];

// per asset: new Image() → .decode() → increment loaded count
// target = loaded / total
```

Smooth the counter so it never jumps or stutters:

```ts
current += (target - current) * 0.06;
if (Math.abs(target - current) < 0.1) current = target;
setDisplay(Math.floor(current));
```

Two hard guards:
- **Minimum duration 1200ms.** On a fast connection the counter would otherwise flash, the dot
  would never get to cycle, and the reveal would look like a bug.
- **Maximum duration 5000ms.** If assets haven't resolved by then, force `target = 100` and
  proceed. A visitor on Chennai mobile data must never be stuck behind a loader.

Set `sessionStorage['devfest-intro-seen']`. On any subsequent mount in the same session, skip
Phase A and B entirely and render the settled state.

### Phase B: the reveal (t=0 is the dot settling green)

| t (ms) | Element | From → To | Duration | Easing |
|---|---|---|---|---|
| 0 | — | hold on green | 180 | — |
| 180 | Dot + counter (inside `overflow:hidden` mask) | `y: 0 → -110%` | 620 | `cubic-bezier(0.16, 1, 0.3, 1)` |
| 320 | Ink curtain | `clip-path: inset(0 0 0 0) → inset(0 0 100% 0)` | 1100 | `cubic-bezier(0.76, 0, 0.24, 1)` |
| 420 | Hero frame | `clip-path: inset(38% 34% 38% 34% round 6px) → inset(0 0 0 0 round 0)` | 1250 | `cubic-bezier(0.16, 1, 0.3, 1)` |
| 420 | Hero `<img>` inside frame | `scale(1.35) → scale(1)` | 1700 | `cubic-bezier(0.16, 1, 0.3, 1)` |
| 980 | Headline lines (each masked, `overflow:hidden` parent) | `y: 110% → 0` | 900 | `cubic-bezier(0.16, 1, 0.3, 1)`, stagger 80 |
| 1400 | Nav, date/venue block, "Scroll" cue | `opacity: 0 → 1`, `y: 12 → 0` | 600 | `cubic-bezier(0.22, 1, 0.36, 1)` |
| 1500 | — | unlock scroll, `lenis.start()` | — | — |

Three details that carry most of the effect:

1. **The image outlives its frame.** The frame finishes opening at 1670ms; the image is still
   settling until 2120ms. That 450ms overhang is what reads as depth rather than a CSS transition.
2. **The curtain and the frame overlap.** The frame starts opening 100ms before the curtain has
   cleared, so the reveal feels like one gesture, not two.
3. **The headline starts before the image settles.** Sequential beats feel like a slideshow;
   overlapping beats feel choreographed.

Total: roughly 2.1s of visible motion after load completes.

### The curtain is site-wide

Build the ink curtain in the root layout, not in the home page component. It has two modes:

- **Intro mode** (first load of the session only): the full Phase A + B sequence above.
- **Transition mode** (every client-side route change): curtain sweeps in
  `inset(100% 0 0 0) → inset(0 0 0 0)` over 500ms `cubic-bezier(0.76, 0, 0.24, 1)`, route commits
  behind it, sweeps out `inset(0 0 0 0) → inset(0 0 100% 0)` over 600ms. No counter, no dot, no
  hero frame. Total under 1.2s.

Transition mode must never block a link click for longer than it takes to sweep in. If the next
route's data isn't ready, show the destination's own loading state behind the curtain rather than
holding the curtain closed — a visitor tapping "Schedule" at the venue should not stare at a black
screen because the network stalled.

### Hero copy

The overlay text below sits on top of the hallway (Part 3) and is visible from the first frame
after the reveal. It does not wait for a scroll.

```
Wordmark (display):            DevFest Chennai 2026
Eyebrow (mono, uppercase):     GDG Chennai
Tagline (display, smaller):    Build. Learn. Connect          [carried from 2025]
Facts (mono):                  [date] · IITM Research Park, Taramani   [venue TBC]
Actions:                       [Get Tickets]  [View Agenda]
Cue (mono, bottom-centre):     Scroll
```

Every bracketed value comes from `site.config.ts`. Not one of them is typed into a component.

The 2025 site is the argument for this rule: its hero states November 8, while its FAQ still says
the date will be announced. Two hardcoded copies of one fact, and one of them was never updated.

---

## Part 2 — Image fallback system

Every photo on the site renders through one `<Frame>` component. If the image errors, is still
loading, or the visitor is on Save-Data, the frame fills with a flat Google-colour panel instead
of a broken-image icon or a grey box. The page should never stop looking finished.

**Rules:**

- Colour is **deterministic per image**, derived from a small hash of the filename, not
  `Math.random()`. Random breaks SSR/client hydration and reshuffles on every re-render.
- Walk a permutation rather than picking freely, so **no two adjacent frames get the same colour**.
  Track the previous index and skip a collision.
- Use the muted `--fb-*` tones, not the full-saturation brand colours. A single #EA4335 rectangle
  looks intentional; a wall of twelve looks like an error state.
- The panel keeps the frame's exact `aspect-ratio` — a fallback must never cause layout shift.
- Print the photo's `title` in the panel, bottom-left, mono, 0.75rem, `--paper` at 55% opacity.
  A failed image should still tell you what it was going to show.
- The same panel doubles as the pre-load placeholder, cross-fading to the photo on decode
  (`opacity` 250ms linear). One component, three states, no separate skeleton.

**Exception — the hero.** If the hallway photos fail, do **not** fill the viewport with flat
colour panels flying past; it reads as an error. Fall back to a static `--ink` hero with the
wordmark, facts, and CTAs — which is a legitimate design in its own right, and still tells someone
the date.

### Photo metadata

Each archive photo carries the shape the 2025 site already uses for its Memories section:

```ts
type ArchivePhoto = {
  src: string;
  title: string;        // "Opening ceremony"
  description: string;  // used as alt
  year: 2024 | 2025;
};
```

Write real descriptions. These are photographs of identifiable people who attended, the alt text
is read aloud by screen readers, and the same string is what shows in the fallback panel.

---

## Part 3 — The hallway (hero) and the pile

### The intro is a backdrop, not a gate

The hallway of photos is the **background of the hero**, pinned, with the wordmark, date, venue and
CTAs held on top of it the entire time. Nothing is gated behind it.

This is the one structural point worth defending. Most people arriving here have been sent a link
in a WhatsApp group and want one of three facts: when, where, how do I get a ticket. If the date
lives 320vh below the fold, they scroll, or they don't, and either way the site made them work for
the thing it most needed to tell them. Running the hallway *behind* the facts costs nothing —
you get the whole cinematic sequence, and someone who never scrolls still leaves knowing the date.

### Structure

One pinned section. `pin: true, start: 'top top', end: '+=340%', scrub: 1`.

**Back layer — the hallway.** 12 archive photos, the 2D scale-and-drift zoom:

- Each photo absolutely positioned with a normalised offset `(ox, oy)` from centre, roughly −0.6
  to 0.6. Scatter off the centre axis and off the diagonals; symmetry reads as a screensaver.
- Photo `i` runs over `[i * 0.055, i * 0.055 + 0.42]` of scrub progress, so they arrive in
  sequence rather than all at once.
- Within its window, `scale` goes `0.15 → 3.2` on `cubic-bezier(0.4, 0, 1, 1)` — an accelerating
  curve, because something approaching you covers more ground per second the closer it gets. A
  linear scale reads as an effect; an accelerating one reads as movement.
- **The offset multiplies by the scale:**
  `translate3d(calc(var(--ox) * var(--s) * 50vw), calc(var(--oy) * var(--s) * 50vh), 0) scale(var(--s))`
  Growing *and* drifting outward is the whole trick. Growing in place looks like a hover state.
- Opacity fades in over the first 15% of each window and out over the last 20%.
- An `--ink` scrim at 45% sits between this layer and the text. Non-negotiable — white type over
  arbitrary event photography is unreadable about a third of the time.

**Front layer — the facts.** The hero copy block, fixed for the full pin, no motion at all while
the hallway runs. It is the still point. Everything moving is behind it.

### The pile

At scrub **0.74** the hallway stops flying and starts collecting:

- Remaining photos decelerate on `cubic-bezier(0.16, 1, 0.3, 1)` and settle into a loose
  overlapping stack at centre — each at scale ~0.42, rotated between −8° and 8°, offset by a few
  percent, like prints dropped on a table.
- Deal them in reverse z-order so the last photo lands on top.

At scrub **0.88** the pile resolves and hands off:

- Pile compresses to a horizontal strip across the top, ~14vh, photos overlapping edge to edge.
- Hero copy lifts away masked, `y: 0 → -110%`, 600ms.
- Sticky header materialises: `opacity 0 → 1`, `y: -8 → 0`.
- Unpin. Content flows normally.

### Where I'd push back

You described the pile staying sticky above the header for the rest of the site. I'd cap that at
the first 100vh of `/` and then let it scroll away, for one reason: it costs permanent vertical
space, and this site's most-used page is an agenda read on a phone at the venue. A 14vh strip on a
667px screen is roughly one session row, gone, forever, on every page. That trade is fine for the
ten seconds someone is admiring the intro and bad for the four hours they're using the site as a
tool.

Compromise that keeps the look: the compressed strip becomes the **header's background** — photos
visible behind an ink scrim at 88%, inside the header's own 64px, taking no extra space. Same
image, zero cost. On routes other than `/`, the header is plain ink.

### Mobile and reduced motion

**Mobile (`max-width: 1023px`):** same code path, 7 photos, `end: '+=220%'`, max scale 2.4. The
facts layer stays fixed exactly as on desktop.

**`prefers-reduced-motion: reduce`:** no pin, no scrub, no preloader. Hero renders static with one
archive photo behind the scrim; the other eleven appear as a plain responsive grid further down.

---

## Part 4 — Escape hatches and the static baseline

### The inversion that matters most

**The loader must be added by JavaScript, not removed by it.**

If the overlay ships in the server-rendered HTML and JS removes it on load, then any JS failure —
a blocked CDN, a chunk that 404s, a parse error, a hung connection — leaves the visitor staring at
a black screen with a dot on it, forever. That is the worst possible failure for this site: total,
silent, and indistinguishable from the site being down.

Invert it. Server-render the complete page — wordmark, date, venue, ticket link, agenda link, all
of it — as real HTML. Then:

```html
<!-- inline in <head>, before any paint -->
<script>document.documentElement.classList.add('js')</script>
```
```css
.loader { display: none }
.js .loader { display: flex }
```

Now JS failure degrades to a plain, fast, working page instead of a void. The cinematic layer is
strictly additive. Nothing a visitor needs is ever inside it.

Add a watchdog on top: if the reveal timeline has not run by **6000ms**, tear the overlay out of
the DOM unconditionally, whatever the asset state says. Two independent guards, because the
5000ms progress cap only fires if the progress loop is still alive.

### One static baseline, four triggers

The reduced-motion fallback, the low-connectivity version, and the no-JS version are all the same
rendering. Build it once and route four conditions into it — this is why it costs almost nothing:

| Trigger | Detection |
|---|---|
| No / broken JS | The `.js` class never lands |
| Reduced motion | `matchMedia('(prefers-reduced-motion: reduce)')` |
| Save-Data or slow network | `navigator.connection.saveData`, or `effectiveType` of `2g` / `slow-2g` |
| Explicit user choice | `?lite=1`, persisted to `localStorage` |

**The static baseline:** no loader, no Lenis, no pin, no scrub. Hero renders immediately with one
archive photo behind the scrim and all the facts on top. The other photos become a plain
responsive grid further down the page. Every link works. It loads in well under a second.

Expose the fourth trigger as a **"Lite version"** link in the footer of every route. Someone on a
metered prepaid plan should be able to opt out permanently rather than fighting the site each
visit. Once set, it holds until they clear it.

### Skip, done properly

Do not build a bespoke "Skip intro" button. Build the standard skip link — the first focusable
element on the page, visually hidden until focused:

```
Skip to content
```

It already needs to exist for keyboard users under WCAG 2.4.1. Point it at the content below the
pinned hero and it serves both audiences with one affordance, no novel UI to learn, and no button
sitting in the corner announcing that the intro you just built is something to be escaped.

For pointer users, the "Scroll" cue is the counterpart. Make it a real anchor to the same target,
so clicking it jumps past the hallway. Someone who wants out gets out in one tap; someone who
doesn't never notices it was possible.

### The escape hatch during load

If loading is genuinely slow, offer the exits — but only then.

At **1500ms** of elapsed load time, fade in a single row along the bottom of the loader, mono,
0.8rem, `--paper` at 70%:

```
Agenda   ·   Tickets   ·   Skip
```

Real `<a>` elements, present in the server HTML, working without JS. The 1500ms threshold is the
point: on a fast connection the loader is already gone by 1200ms and this never appears, so the
intro stays clean for the people it works for. The escape hatch shows up exactly when it has been
earned by the site failing to be quick.

### Don't preload the whole hallway

Phase A's manifest should contain the **first two or three** hallway photos and nothing else. The
remaining nine stream in lazily as the scrub approaches them.

This is the difference between a 1.5-second loader and a 15-second one, and it composes with the
fallback system from Part 2: a photo that hasn't arrived yet renders as its muted Google-colour
panel and cross-fades to the photograph when it lands. Someone on 3G scrolls a hallway of coloured
panels that progressively become photographs — which reads as a deliberate visual device rather
than a degraded experience, because it is built from the same components as the finished state.

---

## Engineering requirements

**Animate only `transform`, `opacity`, and `clip-path`.** No `width`, `height`, `top`, or `left`
in any tween.

**Lenis + ScrollTrigger wiring:**
```ts
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```
Instantiate Lenis but call `.stop()` until the reveal completes.

**One Lenis instance for the whole site**, created in the root layout and kept alive across route
changes — re-instantiating per page causes a scroll-position jump and leaks rAF loops. On each
route change: `lenis.scrollTo(0, { immediate: true })` while the curtain is closed, then
`ScrollTrigger.refresh()` after the new page paints. Kill every page-local ScrollTrigger on
unmount; a leaked trigger from `/speakers` will fight the scrub on `/`.

**Images:** `next/image`, AVIF with WebP fallback, max 1600px wide for gallery assets, `priority`
on the hero only. Everything else lazy. Give every DevFest 2025 photo a real `alt` describing the
moment — these are photos of actual people at your event, not decoration, and the alt text is
visible in the fallback panel.

**`will-change: transform`** added on ScrollTrigger `onEnter`, removed on `onLeave`.

**Cleanup:** all GSAP work inside `useGSAP` with a scope ref so timelines and ScrollTriggers are
reverted on unmount. Kill Lenis and the loader rAF loop on unmount.

**Accessibility floor:**
- `aria-busy="true"` on `<main>` during load; one visually-hidden "Loading" label. Do not put the
  percentage in a live region — it would announce ~100 times.
- The cycling dot is `aria-hidden`; it carries no information a screen reader needs.
- Visible `:focus-visible` ring in `--blue`, 2px offset.
- Scroll lock released by the 5000ms timeout regardless of asset state.
- Full keyboard reachability of nav and CTA once revealed.

**No layout shift.** Reserve hero, gallery, and fallback aspect ratios with `aspect-ratio`, not JS.

---

## Build order

1. `site.config.ts` + tokens + fonts + a static, unanimated page that is complete and correct.
2. The `<Frame>` component with its fallback panel — build this before anything consumes images.
3. Lenis, stopped by default.
4. Loader: real asset progress, cycling dot, both guards.
5. Reveal timeline.
6. Hero hallway + pile.
7. The static baseline and its four triggers.
8. Lighthouse pass; tune only after it's correct.

Ship step 1 as something you'd be willing to publish on its own. If the motion layer fails on some
device, that's what visitors get.

---

## Acceptance checklist

- [ ] Counter reflects real load progress; never decreases; never jumps more than ~8 points a frame
- [ ] Dot cycle visibly accelerates as progress rises, and settles green at 100%
- [ ] Fast connection still shows ≥1200ms of loader; slow connection never exceeds 5000ms
- [ ] Scroll is locked during the loader and released exactly once
- [ ] Reveal reads as one continuous gesture — no visible seam between curtain, frame, and text
- [ ] Second visit in the same session skips the intro
- [ ] Block all image requests in DevTools → page still looks designed, no broken icons, no shift
- [ ] Fallback colours are stable across reloads and never repeat side by side
- [ ] Date, venue and ticket CTA are readable without scrolling, on a 360px phone
- [ ] Hallway photos never make the overlay type unreadable — check against the brightest photo
- [ ] Pile deals in reverse z-order and settles without a visible snap
- [ ] Sustained 60fps on the hallway scrub (Performance panel, 6x CPU throttle)
- [ ] `prefers-reduced-motion` renders the settled page with zero motion
- [ ] Lighthouse: CLS 0, LCP under 2.5s on Slow 4G
- [ ] Tab through the whole page with a visible focus ring at every stop
- [ ] Disable JavaScript entirely → full page renders, every link works, no black screen
- [ ] Throttle to Slow 3G → escape-hatch row appears, Tickets and Agenda are reachable
- [ ] Block the JS chunks in DevTools → watchdog is irrelevant because no loader ever appeared
- [ ] Save-Data enabled → static baseline, no loader, no scrub
- [ ] `?lite=1` persists across routes and reloads until cleared
- [ ] Skip link is the first tab stop and lands below the pinned hero

---

## Calibration

The timing values above are reconstructed from the reference's page structure and the conventions
of this genre — a well-tuned starting point, not measured frames. To match `podium.global`
precisely:

1. Screen-record the load at 60fps, step frame by frame, count frames between beats
   (frames ÷ 60 × 1000 = ms).
2. DevTools → Sources → search the JS chunks for `gsap`, `cubic-bezier`, `clip-path`, `lerp`.
3. DevTools → Animations panel captures running timelines with real durations.

Match the *ratios* between beats before the absolute durations — the overlaps are what make it
feel expensive, not the exact millisecond counts.
