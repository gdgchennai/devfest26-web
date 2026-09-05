import { getBrandShapes } from "@/lib/brandShapes";
import { EventJsonLd } from "@/components/EventJsonLd";
import { HomeBody } from "@/components/motion/HomeBody";
import { getArchivePhotos } from "@/lib/content";
import { pageMetadata, siteDescription } from "@/lib/seo";
import { siteConfig } from "@/site.config";

// Public marketing page. Content (archive photos) comes from D1 via
// lib/content.ts; `revalidate` lets a `content:sync` show up without a rebuild.
export const revalidate = 300;

export const metadata = pageMetadata({
  title: siteConfig.name,
  description: siteDescription,
  path: "/",
});

export default async function Home() {
  const archivePhotos = await getArchivePhotos();
  return (
    <>
      <EventJsonLd />
      <HomeBody brandShapes={getBrandShapes()} archivePhotos={archivePhotos} />
    </>
  );
}
