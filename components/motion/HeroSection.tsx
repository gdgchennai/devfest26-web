"use client";

import dynamic from "next/dynamic";
import { isLiteMode, shouldSkipHeavyAssets } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { StaticHero } from "@/components/motion/StaticHero";

/**
 * The WebGL intro + curved marquee. Loaded only when `shouldSkipHeavyAssets`
 * is false (wide screens, not lite). `ssr: false` so the first HTML — and the
 * PageSpeed LCP element — is always the server-rendered StaticHero heading,
 * not a blank canvas waiting on three.js. Desktop hydrates StaticHero, then
 * swaps in this chunk; the GSAP Loader covers that swap on first visit.
 */
const HeroMotion = dynamic(() => import("./HeroMotion").then((m) => ({ default: m.HeroMotion })), {
  ssr: false,
  loading: () => <StaticHero />,
});

/**
 * Chooses the hero. SSR and no-JS always get StaticHero (the `true` default on
 * `shouldSkipHeavyAssets`). After hydration, lite mode and narrow viewports
 * stay on that HTML; wide screens load HeroMotion in a separate chunk so
 * phones never download three.js / the hallway just to show a title.
 */
export function HeroSection() {
  const skipHeavy = useClientValue(shouldSkipHeavyAssets, true);
  const lite = useClientValue(isLiteMode, false);
  if (skipHeavy) return <StaticHero offerFullExperience={lite} />;
  return <HeroMotion />;
}
