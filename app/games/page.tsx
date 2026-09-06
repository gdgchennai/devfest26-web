import type { Metadata } from "next";
import { BracketsField } from "@/components/motion/BracketsField";
import { GamesHub } from "@/components/games/GamesHub";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Mini Games",
  description:
    "Play DevFest Chennai tech mini-games: Archive Jigsaw, Tech Crosswords, and Memory Matrix. Authenticate to compete on the global leaderboard.",
  path: "/games",
});

export const dynamic = "force-dynamic";

export default function GamesPage() {
  return (
    <>
      <BracketsField mode="settled" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-8 sm:pt-8">
        <h1 className="mb-4 sm:mb-6 text-2xl font-semibold tracking-tight text-paper sm:text-3xl md:text-4xl">
          Mini Games
        </h1>

        {/* Interactive Hub */}
        <GamesHub />
      </div>
    </>
  );
}
