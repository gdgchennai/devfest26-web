import { getBrandShapes } from "@/lib/brandShapes";
import { EventJsonLd } from "@/components/EventJsonLd";
import { HomeBody } from "@/components/motion/HomeBody";

// Public marketing page — same HTML for every visitor. Prerender at build and
// serve from the Worker/R2 cache (see open-next.config.ts). Do NOT add this to
// the root layout: /profile and /my-agenda call auth() and must stay dynamic.
export const dynamic = "force-static";

export default function Home() {
  return (
    <>
      <EventJsonLd />
      <HomeBody brandShapes={getBrandShapes()} />
    </>
  );
}
