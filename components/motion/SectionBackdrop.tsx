"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll-driven background cycle.
 *
 * From "Why join" down, the single fixed backdrop (BracketsField) reads
 * --page-bg. This scrubs that property through the pastel cycle as each marked
 * section — any element carrying `data-bg-cycle` — reaches the middle of the
 * viewport. Nothing autoplays: the colour only ever moves with the scroll, and
 * reverses as you scroll back up.
 *
 * The cycle itself is configured in globals.css as --bg-cycle-1, -2, … (edit
 * those to recolour or reorder; add or remove one to change the length). Each
 * marked section is assigned a colour by its order, wrapping round the list, so
 * a 5th section reuses colour 1.
 *
 * Design note — one writer, not one-per-section. An earlier version created a
 * ScrollTrigger per section, each scrubbing --page-bg. That is fragile: on
 * ScrollTrigger.refresh() the triggers' onUpdates fire in creation order and the
 * last one wins, so the backdrop could be left the wrong colour for a frame
 * (e.g. the hero flashing a pastel at the top of the page). Instead a single
 * trigger spanning the page owns --page-bg and computes the colour from the
 * scroll position against each section's measured fade window — correct at any
 * scroll position and after any refresh, with no ordering to get wrong.
 *
 * Renders nothing. It is mounted as the first child of the homepage's content
 * wrapper so its trigger exists before WhyJoin's load-bearing
 * ScrollTrigger.refresh() runs — that refresh is what re-measures the fade
 * windows once ExpectShowcase's pin spacer has changed the document height.
 */
export function SectionBackdrop() {
  useGSAP(() => {
    const sections = gsap.utils.toArray<HTMLElement>("[data-bg-cycle]");
    if (sections.length === 0) return;

    const root = document.documentElement;

    // Resolve any CSS value (including var() chains) to a concrete rgb() string
    // so GSAP can interpolate between colours frame by frame. Reading the custom
    // property directly is unreliable — browsers may hand back the unresolved
    // "var(--…)" token — so we let a throwaway node compute it for us.
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;left:-9999px;width:0;height:0";
    document.body.appendChild(probe);
    const resolve = (value: string) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };

    // Read --bg-cycle-1, -2, … in order until one is missing. Falls back to the
    // four brand pastels if the config block was removed entirely.
    const rootStyles = getComputedStyle(root);
    const cycle: string[] = [];
    for (let i = 1; rootStyles.getPropertyValue(`--bg-cycle-${i}`).trim(); i++) {
      cycle.push(resolve(`var(--bg-cycle-${i})`));
    }
    if (cycle.length === 0) {
      cycle.push(
        resolve("var(--blue-pastel)"),
        resolve("var(--green-pastel)"),
        resolve("var(--yellow-pastel)"),
        resolve("var(--red-pastel)"),
      );
    }
    probe.remove();

    // The dark backdrop the page carries above the first marked section.
    const dark = resolve("var(--black)");

    // Each section's fade: from the previous colour to its own, over an absolute
    // scroll window. The window (section top from 50% → 10% of the viewport)
    // mirrors WhyJoin's --theme scrub, so on the first section the text darkening
    // and the background tint move in lockstep. Rebuilt on every refresh, since
    // the pin spacer above changes where each section sits.
    type Fade = { start: number; end: number; lerp: (p: number) => string };
    let fades: Fade[] = [];
    const measure = () => {
      const vh = window.innerHeight;
      fades = sections.map((el, i) => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        const from = i === 0 ? dark : cycle[(i - 1) % cycle.length];
        const to = cycle[i % cycle.length];
        return { start: top - vh * 0.5, end: top - vh * 0.1, lerp: gsap.utils.interpolate(from, to) };
      });
    };

    const setBg = gsap.quickSetter(root, "--page-bg");
    const apply = (y: number) => {
      // Walk the fades in order. Below the first, the page stays dark; inside a
      // window we cross-fade; past a window we hold that section's colour until
      // the next window begins. Because the windows never overlap, the loop ends
      // on whichever fade the scroll position currently sits in or just past.
      let color = dark;
      for (const f of fades) {
        if (y <= f.start) break;
        const p = y >= f.end ? 1 : (y - f.start) / (f.end - f.start);
        color = f.lerp(p);
      }
      setBg(color);
    };

    const st = ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        measure();
        apply(self.scroll());
      },
      onUpdate: (self) => apply(self.scroll()),
    });

    // Paint the correct colour immediately, before the first scroll event.
    measure();
    apply(st.scroll());
  }, []);

  return null;
}
