import type { Metadata } from "next";
import { getAllLiveHalls } from "@/lib/hall-status";
import { LiveHallBoard } from "@/components/live/LiveHallBoard";
import { HeaderTitle } from "@/components/HeaderTitleContext";
import { BracketsField } from "@/components/motion/BracketsField";
import { Eyebrow } from "@/components/Eyebrow";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Live",
  description: "Real-time hall occupancy, running sessions, and announcements across DevFest Chennai.",
  path: "/live",
});

export const dynamic = "force-static";

export default async function LivePage() {
  const halls = await getAllLiveHalls();

  return (
    <>
      <HeaderTitle title="Live" />
      <BracketsField mode="settled" />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-8 sm:pt-28">
        <div className="max-w-2xl">
          <Eyebrow dotColor="green">Real-time Status</Eyebrow>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-paper sm:text-4xl">
            Live Hall Status
          </h1>
          <p className="mt-2 text-sm text-paper/60 sm:text-base">
            Track real-time hall capacities, active sessions, and announcements so you can pick your next destination with ease.
          </p>
        </div>

        <div className="mt-8">
          <LiveHallBoard initialHalls={halls} />
        </div>
      </main>
    </>
  );
}
