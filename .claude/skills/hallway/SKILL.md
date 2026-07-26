---
name: hallway
description: >-
  Work on the DevFest Chennai scroll hallway — the pinned, scroll-scrubbed
  section where archive photos fly toward the camera on the homepage hero and
  /memories. Use when adding or reordering archive photos, changing the pacing
  or feel of the fly-through, touching usePhotoHallway.ts, HeroSection.tsx,
  MemoriesHallway.tsx or content/archive.json, or when the motion looks choppy,
  photos are cropped wrong, or the section scrolls for too long. Also covers the
  reduced-motion / Save-Data / lite-mode baseline that replaces it.
---

# The hallway

`components/motion/usePhotoHallway.ts` drives two sections: the homepage hero
(`HeroSection.tsx`) and `/memories` (`MemoriesHallway.tsx`). It pins its
container and flies the archive photos toward a virtual camera — each card fades
in, scales up, drifts toward its own corner and passes, several visible at
different depths at once — then settles the whole set into a **browsable stack**.

## Two disjoint sets

`content/archive.json` gives every photo a `role`:

- **`hallway`** (10 today) — flies past the camera.
- **`stack`** (5 today) — the destination, visible in the distance from the very
  first frame and approached throughout.

**They must not overlap.** A photo cannot both be approaching and have already
gone by; that contradiction is why an earlier version used one set and needed a
crossfade kludge to bring everything back from `opacity: 0` at the end. With two
sets there is nothing to bring back — the stack simply arrives.

`lib/content.ts` exports `hallwayPhotos` and `stackPhotos`; nothing should
re-derive the split.

## The corridor

Flying photos hang on the walls of a short tube and tilt toward its axis, so
they read as things you are passing rather than cards thrown at the lens. The
middle stays clear, because that is where the destination sits.

- **`CORRIDOR_LAYOUT`** switches `"walls"` (left and right only, current) and
  `"tube"` (all round). **Both are the same construction** — a direction on a
  ring around the axis, differing only in how the angles are distributed — so
  switching is this one constant and nothing else.
- **`CORRIDOR_X` / `CORRIDOR_Y` (0.24 / 0.16)** are the clear channel, as a
  fraction of the half-viewport, *before* any outward drift. This floor is the
  whole point: without it `drift` and `scale` both go to zero at birth, so every
  photo was born exactly at the vanishing point — which is where the stack is.
  Measured, a card sat dead-centre on the destination at **every** sampled
  moment of the tunnel. Elliptical because the stack is 3:2.
- **`TILT_Y` / `TILT_X` (34° / 22°)** turn each photo to face the axis,
  sharpening across its life as the angle grows oblique. **The signs are not
  symmetric and that is deliberate:** `rotateY(θ)` takes a front normal
  `(0,0,1)` to `(sinθ,0,cosθ)`, so θ>0 faces *right* and a right-wall card must
  face left — hence `-ux` on Y. `rotateX(θ)` gives `(0,−sinθ,cosθ)`, so θ>0
  faces *up*, already correct for a card below the axis. Don't "tidy" them to
  match.
- **`PRIMED` (0.55)** is how far inside the corridor the camera already stands
  when the curtain lifts. At 0.35 it opened on two small photos near the middle,
  which read as *looking at* a corridor rather than *being in* one; at 0.65 the
  nearest card is already half out of frame.
- **`.hallway-corridor`** carries the `perspective` and wraps *only* the flying
  photos. The backdrop, beacon and stack stay outside it; perspective on a
  shared ancestor would skew them too.

`tube` needs roughly twice the photos to read as *lined* rather than
*scattered* — about 18 in the hallway role against the 10 that fill two walls.
Measured occlusion with 10 photos: walls blocks the destination in 5 of 15
sampled frames (1 in the first half), tube in 11 of 15 (6 in the first half).
Revisit `tube` once the archive has grown.

## The progress map

```
0 ─────────────── TUNNEL_END (.72) ─────── HANDOFF_END (.9) ──── 1
fly-through,                        stack slides right,        browse
stack approaching in distance       hero copy reveals          window
```

`heroHandoff` controls that middle leg: the homepage slides the stack aside to
make room for the copy, `/memories` has no copy so its stack stays centred.

## The stack

Past `HANDOFF_END` it **holds** rather than dissolving, and becomes interactive:

- `usePhotoHallway` returns `{ cycle }`. `cycle(±1)` rotates the deck by
  rewriting `stackPos` (position 0 = top card) and re-rendering from the current
  playhead. **DOM order is never touched**, so each card keeps its identity and
  its scatter offset as it moves through the deck.
- The top card straightens up (`rotate: 0`) and sits proud (`TOP_SCALE`), so
  cycling is visible rather than an invisible z-index swap.
- `onSettledChange(settled)` fires on crossing `PILE_END` in either direction.
  `StackControls.tsx` uses it to enable Prev/Next plus arrow keys.
- **Browsing the stack never captures scroll.** The pin releases as normal and
  the page scrolls past at any moment; advancing a card is an explicit action.
- **Fade the group, never the cards.** `.hallway-stack` carries one opacity and
  the approach transform; `.stack-card` children stay fully opaque with an ink
  backing. Fading them individually stacks semi-transparent photos into mud —
  overlapping *opaque* rectangles are what read as depth. Card geometry (offset,
  slight rotation, `pos * 0.045` recede) does the rest.
- Motion for the cycle comes from a CSS transition on `.hallway-card.is-settled`,
  **not** GSAP: `render()` owns the inline `transform` outright, so a tween on
  those elements gets overwritten. The class is only applied while settled, which
  keeps the scroll-driven phase writing instantly instead of smeared.

Roughly 1.5 viewport-heights of scrolling keep the stack on screen. Lower
`PILE_END` to lengthen that if browsing feels rushed.

## Why there is no progress bar

The approaching stack **is** the progress indicator: how much further to go is
legible from how close the destination looks, with no chrome. The loading phase
has the `%` counter in `Loader` for the same job.

A progress rail was built and removed for duplicating both. An abstract glow was
built and demoted for the same reason — `HALLWAY_BEACON_CLASS` survives only as
faint atmosphere behind the distant stack, so a speck at 7% scale still reads as
*something out there*. It peaks mid-approach (`bloom * (1 - bloom)`) and is gone
by the time the stack is real.

Only `opacity` and `transform` are animated on it — re-rasterising a large
radial gradient every frame is the same trap as a blurred box-shadow on a moving
card. It needs a dark field; there is no "light at the end" on white.

## Getting out

`IntroEscape.tsx` is the persistent way out, and the only accessible one.

- **Portalled to `document.body`, not into the curtain.** The curtain is
  `aria-hidden`, so the old hatch inside `Loader` was focusable-but-invisible to
  screen readers and its `role="status"` loading announcement never fired.
- **It must not unmount between phases.** The old one lived in `Loader` and
  vanished the instant the reveal finished — exactly when someone watching a
  dozen photos would want it.
- **Bottom-right is the only free corner:** hero copy and CTAs own bottom-left,
  `StackControls` and both Scroll hints own bottom-centre.
- Skip routes through `releaseIntro()`, shared with the reveal's `onComplete`,
  so both exits leave the page identical — scroll restored, `aria-busy` cleared,
  `INTRO_SEEN_KEY` set. During the wait it cuts the reveal to its finished
  state; afterwards it scrolls to `#after-hero` **via Lenis**, since Lenis owns
  the scroll and going around it desyncs ScrollTrigger.
- `Esc` is a shortcut on top of the button, never the only route.

## Adding photos

```
cp ~/photos/*.JPG assets/     # camera originals, gitignored
npm run archive               # resize → public/archive/, append to content/archive.json
```

Then write a `title` and `description` for each new entry. **The description is
the alt text.** The script leaves both blank and warns, because a generated
string like `AJI02236` is an accessibility regression, not a convenience.

- `npm run archive` is idempotent — each entry records the `source` filename it
  came from, so re-running only picks up genuinely new files and never disturbs
  captions.
- It **appends, never sorts.** Array order is the order photos fly past the
  camera, and the hero takes the first 12 on desktop / 7 on mobile. Placing a new
  photo is a deliberate edit.
- `width`/`height` are required. They shape each card to its true ratio on the
  first frame; measuring with `img.onLoad` instead reflows cards mid-scroll.
- macOS only (uses `sips`). It is an authoring step, not part of `next build`.

## Why it cannot read `assets/` at runtime

`content/archive.json` is imported through `lib/content.ts`, which the
`"use client"` hero pulls into the client bundle. Nothing on that path can touch
`fs`, and Next has no `import.meta.glob`. Hence a script.

## Things not to "simplify"

- **The render loop is driven by a scrubbed proxy tween, not
  `onUpdate(self.progress)`.** A scrubbed ScrollTrigger only interpolates
  smoothly when it drives an actual animation; reading progress directly steps
  with every wheel notch. The one-unit dummy timeline is load-bearing.
- **Direct `el.style` writes, not `gsap.set()`,** inside the loop — it runs for
  every card every frame, and `gsap.set` re-parses unit strings each time.
- **Off-camera cards early-out** before any transform work.
- **`will-change`/`backface-visibility` belong on the cards** (`.hallway-card`
  in `globals.css`), not the pinned container, which never transforms. No
  blurred `box-shadow` on the cards — re-rendering a large blur on a dozen
  scaling elements every frame is what tanks the frame rate.
- **Cards are queried from the scoped container**, not threaded in as a ref
  array — the React Compiler lint (`react-hooks/immutability`) rejects mutating
  elements read from a ref prop.

## Tuning

| Knob | Default | Effect |
|---|---|---|
| `perItemVh` | `0.3` | Viewport heights of scroll per photo. Section length = count × this. |
| `maxScale` | `3.2` hero desktop, `2.4` mobile, `2.6` memories | How large a card gets as it passes. |
| `SPACING` | `0.5` | Depth gap between cards. Smaller = more on screen at once. |
| `APPROACH` / `PASS` | `1.2` / `0.9` | Depth spent fading in before / lingering after the camera plane. |
| `TUNNEL_END` / `HANDOFF_END` | `0.72` / `0.9` | Where the fly-through ends and where the stack finishes moving aside. |
| `STACK_FAR_SCALE` | `0.07` | How small the destination is at the far end. |
| `STACK_APPROACH` | `2.4` | Exponent on the approach. Above 1 it stays a distant speck and arrives late, which is what reads as *getting closer*. At 1 it grows steadily and gives away the ending. |
| `ROW_SPAN` / `ROW_GAP` | `0.92` / `1.06` | How much of the width the spread row covers, and the gap between cards. |
| `ROW_RISE` | `-0.3` | How far up the row travels, as a fraction of viewport height. |
| `RISE_FROM` | `0.45` | How far the hero copy rises from, same units. |
| `STACK_VISIBLE_BY` / `STACK_MIN_OPACITY` | `0.45` / `0.18` | Where the destination reaches full opacity, and how visible it is on frame one. **Ramped on `approach`, never on `bloom`** — see the note in the source. |
| `WIDTHS` | 23–44vw cycle | Card widths. **Varied widths are what read as depth** — the photos are all ~3:2, so aspect ratio alone does nothing. |

`perItemVh` is deliberately far below the 1.15 a standalone gallery of this kind
would use: this sits above a whole site, and at 1.15 the hero would eat roughly
fourteen screens before a visitor reached any content.

Every card is invisible by `PILE_START` — the camera has passed all of them — so
the stack crossfades them back in over the first third of its forming window.
Without that, all twelve pop in on a single frame.

## The baseline

`shouldUseStaticBaseline()` (reduced motion, Save-Data, `?lite=1`) skips the
hallway entirely: the hero falls back to `StaticHero`, `/memories` to its year
grids. **That baseline is also what server-renders**, and the motion path only
engages after hydration confirms it should. Do not invert this — mounting the
motion hero first and downgrading after hydration unmounts an already-pinned
ScrollTrigger and crashes React's reconciliation.

Both hero variants share `HeroCopy.tsx`. Change the tagline or CTAs there, once.

## The curtain opens onto the corridor, not onto a photo

There used to be a single hero image that clip-path opened and dissolved between
the loader and the hallway. It made the intro hand off to *one picture* rather
than to the space the whole thing is about, so it is gone — `startReveal` is now
just the loader mask lifting and the curtain sweeping.

`useIntroProgress` waits on **exactly what is on screen when it lifts** — the
first three wall photos plus the front of the stack. It used to wait on
`archivePhotos.slice(0, 3)`, which after the role split no longer matched what
was visible, so a card could still be decoding when the corridor appeared.

## The copy belongs to the hero, not the tunnel

The hero copy starts hidden in CSS (`.hallway-rise`) and is raised by the hook
across the same scroll leg as the row, **as one sheet** — not line by line.

Two decisions worth keeping:

- **Scrubbed, not triggered.** An earlier version played a GSAP timeline when
  the phase flipped, so the row moved with the visitor's scroll while the text
  ran on its own clock. Driving it from `render()` means the visitor physically
  pulls the page up under the row.
- **One block, no per-line stagger.** The tunnel spends four viewport heights
  establishing a space to travel through; ending that with five words each
  emerging from their own clip switches to a fussier, purely typographic
  language at the exact moment the spatial one should pay off. `HeroCopy` has no
  animation hooks at all now — that is deliberate, don't add them back.
- Only the copy moves. The sections below are off-screen behind the pinned hero,
  so translating them would animate a tall subtree, force paint on all of it,
  and fight the real scroll position on pin release — for no visible gain.

This is load-bearing, not decoration. With the copy pinned over the flying
photos, "Skip intro" was meaningless: the site was already on screen, so there
was nothing to skip to. It also meant the first thing a visitor read was
"Date to be announced · venue TBC" — the two facts `site.config.ts` does not yet
have — instead of a photo of a packed auditorium.

Consequently `skipReveal` (skip during the wait) deliberately does **not** show
the copy: it drops you at the mouth of the tunnel. Skipping the tunnel itself is
the other branch of `onSkip`, which scrolls to `#after-hero`.

## Not implemented yet

Video cards (`type: "video"`, muted/looping, playing only near the camera).
The `image-flythrough-gallery` skill in `~/.claude/skills/` covers it; wire it
in when there is actual footage in `assets/`.
