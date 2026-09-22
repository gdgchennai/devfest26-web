import type { Metadata } from "next";
import { BracketsField } from "@/components/motion/BracketsField";
import { GamesHub } from "@/components/games/GamesHub";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Mini Games",
  description:
    "Play DevFest Chennai tech mini-games: Archive Jigsaw, Tech Crosswords, Memory Matrix and Speed Typer. Authenticate to compete on the global leaderboard.",
  path: "/games",
});

export const dynamic = "force-dynamic";

export default function GamesPage() {
  return (
    <>
      <BracketsField mode="settled" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-8 sm:pt-28">
        <p className="mb-8 text-center text-base text-paper/70 sm:text-lg">
          Play mini-games: Archive Jigsaw, Tech Crosswords, Memory Matrix and Speed Typer. Compete on the global leaderboard!
        </p>

        {/* Interactive Hub */}
        <GamesHub />
      </div>
    </>
  );
}
