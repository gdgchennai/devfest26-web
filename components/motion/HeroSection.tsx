"use client";

import dynamic from "next/dynamic";
import { isLiteMode, shouldSkipHeavyAssets } from "@/lib/motion-prefs";
import { useClientValue } from "@/lib/useClientValue";
import { StaticHero } from "@/components/motion/StaticHero";
import type { ArchivePhoto } from "@/lib/schemas";

/**
 * The WebGL intro + curved marquee. Loaded only when `shouldSkipHeavyAssets`
 * is false (not lite). `ssr: false` so the first HTML is always StaticHero;
 * the chunk (and three.js inside it) loads after hydration. The GSAP Loader
 * covers that swap on first visit. Import is async — a failed chunk falls
 * through SectionBoundary to StaticHero.
 */
const HeroMotion = dynamic(() => import("./HeroMotion").then((m) => ({ default: m.HeroMotion })), {
  ssr: false,
  loading: () => <StaticHero />,
});

/**
 * Chooses the hero. SSR and no-JS always get StaticHero (the `true` default on
 * `shouldSkipHeavyAssets`). After hydration, lite stays on that HTML; everyone
 * else loads HeroMotion in a separate chunk, including phones.
 */
export function HeroSection({ photos }: { photos: ArchivePhoto[] }) {
  const skipHeavy = useClientValue(shouldSkipHeavyAssets, true);
  const lite = useClientValue(isLiteMode, false);
  if (skipHeavy) return <StaticHero offerFullExperience={lite} />;
  return <HeroMotion photos={photos} />;
}
