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
| `HERO_X` / `HERO_SCALE` | `0.46` / `0.74` | Where the stack parks in the hero, and how much it shrinks getting there. |
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

## The copy belongs to the hero, not the tunnel

The hero copy starts hidden whenever the tunnel will run — including for a
returning visitor who skips the loader but still travels the hallway — and is
revealed by `setCopyShown(true)` when the hook reports phase `hero`. The
timeline is built once and reversed if the visitor scrolls back into the tunnel.

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
