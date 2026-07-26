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
different depths at once — then settles the whole set into a pile.

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
| `PILE_START` / `PILE_END` | `0.74` / `0.88` | Where the fly-through hands off to the closing pile. |
| `WIDTHS` | 23–44vw cycle | Card widths. **Varied widths are what read as depth** — the photos are all ~3:2, so aspect ratio alone does nothing. |

`perItemVh` is deliberately far below the 1.15 a standalone gallery of this kind
would use: this sits above a whole site, and at 1.15 the hero would eat roughly
fourteen screens before a visitor reached any content.

Every card is visible by `PILE_START`, so the pile crossfades them back in over
its first third — without that, all twelve pop in on a single frame.

## The baseline

`shouldUseStaticBaseline()` (reduced motion, Save-Data, `?lite=1`) skips the
hallway entirely: the hero falls back to `StaticHero`, `/memories` to its year
grids. **That baseline is also what server-renders**, and the motion path only
engages after hydration confirms it should. Do not invert this — mounting the
motion hero first and downgrading after hydration unmounts an already-pinned
ScrollTrigger and crashes React's reconciliation.

Both hero variants share `HeroCopy.tsx`. Change the tagline or CTAs there, once.

## Not implemented yet

Video cards (`type: "video"`, muted/looping, playing only near the camera).
The `image-flythrough-gallery` skill in `~/.claude/skills/` covers it; wire it
in when there is actual footage in `assets/`.
