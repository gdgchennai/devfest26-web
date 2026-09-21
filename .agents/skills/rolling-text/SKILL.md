---
name: rolling-text
description: >-
  The rolling-text hover effect on the DevFest CTAs — a label whose characters
  roll up and swap for an identical incoming copy, left-to-right, once per hover
  and reversing on leave. Use when adding the effect to a new button or link,
  touching components/motion/RollingText.tsx, or when the roll clips wrong, loops
  instead of playing once, doesn't reverse, or announces its label twice to
  screen readers. reference/rolling-text.html is a dependency-free demo of the
  same mechanism.
---

# Rolling text

`components/motion/RollingText.tsx` wraps a plain-string label so its characters
**roll** on hover: the resting copy rolls up and out through a clip while an
identical copy rolls up into its place, left-to-right with a per-character
stagger. It plays through **once** per hover and **reverses** along the same path
on leave. Modelled on [demos.gsap.com/demo/rolling-text](https://demos.gsap.com/demo/rolling-text).

Used today on three CTAs: the loader's "Enter the DevFest experience →"
(`Loader.tsx`) and the hero's "Get Tickets →" / "See Agenda →"
(`CurvedMarqueeHero.tsx`).

## The construction

Three things stacked in a single clipped box, and the whole effect falls out of
their geometry:

- **The box clips to one line** (`overflow: hidden`, `inline-block`). It is as
  tall as the label, so anything a line above or below is invisible.
- **Two identical copies**, `data-roll="top"` (resting, in flow — it sets the
  box's width) and `data-roll="bottom"` (`position: absolute; left/top: 0`,
  stacked exactly over the first).
- **`SplitText` breaks each copy into per-character elements** so they can
  stagger. The bottom copy's chars start at `yPercent: 100` — one line down,
  waiting just under the clip.

A hover rolls **both** sets up by one line together: top chars `yPercent: 0 →
-100` (out the top), bottom chars `yPercent: 100 → 0` (into view). Because the
clip is exactly one line tall, a char mid-roll shows its top half exiting and the
new char's bottom half arriving — that half-and-half is the rolling read, and the
stagger turns it into a left-to-right wave.

## Things not to "simplify"

- **The timeline is built `paused`, then `.play()` on enter / `.reverse()` on
  leave.** That is what makes a hover *one* roll instead of a loop, and what lets
  a fast in-out reverse from wherever it got to rather than snapping. Don't swap
  it for `gsap.to` on each event — you lose the mid-flight reversal and re-trigger
  from scratch every time.
- **`children` is typed `string`, not `ReactNode`.** The label is duplicated and
  fed to `SplitText`, which splits text nodes — an element child would be
  cloned into the aria-hidden copy and split in ways that don't survive
  `revert()`. Keep callers passing a bare string.
- **The bottom copy is `aria-hidden`.** It is the same words twice; without it
  every CTA is announced doubled.
- **`SplitText` is reverted in the `useGSAP` cleanup.** It rewrites the DOM into
  wrapper divs; leaving them behind means the next split nests splits, and React
  reconciliation trips over nodes it didn't render. `revert()` restores the
  original text node.
- **The whole effect is gated on `prefersReducedMotion()`.** Under reduce, no
  split, no timeline — the label renders as plain static text and the hover
  handlers no-op (the timeline ref stays null).
- **`align-bottom` on the box.** An `inline-block` sits on the baseline by
  default, leaving a descender strip below it that offsets the clip from the
  visible text. Bottom-aligning removes that gap so the roll starts flush.

## Applying it to a new CTA

Wrap the label string; drop any `hover:opacity-*` transition on the host so the
roll is the sole hover effect:

```tsx
import { RollingText } from "@/components/motion/RollingText";

<Link href="/schedule">
  <RollingText>View Schedule →</RollingText>
</Link>;
```

`RollingText` is a `<span>` and inherits the host's font, size and colour, so
style the button/link as usual and let the text ride along.

## Tuning

| Knob | Default | Effect |
|---|---|---|
| `duration` | `0.5` | Seconds for one character to roll a full line. |
| `ease` | `power4.inOut` | Roll curve. `inOut` keeps entry and exit symmetric so the reverse feels identical. |
| `stagger` | `0.025` | Seconds between adjacent characters — the width of the left-to-right wave. `0` rolls every char at once. |

All three live in the `ROLL` constant at the top of `RollingText.tsx`.

## Reference

`reference/rolling-text.html` is the same mechanism as a single standalone file —
GSAP + SplitText from a CDN, two buttons, no build step, no React. Open it to see
the effect in isolation or to lift the timeline into a non-React context. It
mirrors the component's structure (clipped box, two copies, `yPercent` roll,
paused timeline played/reversed on hover) so changes should stay in step with it.
