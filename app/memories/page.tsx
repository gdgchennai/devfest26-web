import type { Metadata } from "next";
import { getArchivePhotos } from "@/lib/content";
import { fallbackColorFor, type FallbackColor } from "@/lib/fallback-color";
import { Frame } from "@/components/Frame";
import { SectionBoundary } from "@/components/SectionBoundary";
import { MemoriesHallway } from "@/components/motion/MemoriesHallway";
import { BracketsField } from "@/components/motion/BracketsField";
import { uiCopy } from "@/site.config";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Memories",
  description: uiCopy.memoriesPage.body,
  path: "/memories",
});
export const revalidate = 300;

export default async function MemoriesPage() {
  const archivePhotos = await getArchivePhotos();
  let previousColor: FallbackColor | undefined;

  const photosWithColor = archivePhotos.map((photo) => {
    const priorColor = previousColor;
    previousColor = fallbackColorFor(photo.title, priorColor);
    return { photo, priorColor };
  });

  return (
    <>
      {/* Same 3D brand-shape backdrop the homepage/tickets/agenda pages mount:
          page-agnostic, drives off scroll and #footer-logo, so it settles the
          extruded wordmark and brackets into the footer here too. mode="settled"
          skips the drift-then-land intro. Under reduced-motion / lite / save-data
          it no-ops and FooterLogo falls back to the flat SVG. */}
      <BracketsField mode="settled" />
      <div className="relative z-10 px-4 py-12 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{uiCopy.memoriesPage.heading}</h1>
        <p className="mt-2 max-w-xl text-paper/70">{uiCopy.memoriesPage.body}</p>

        {/* Contained: if the hallway animation throws, it just vanishes and the
            static year grids below still render, no fallback needed. */}
        <div className="mt-8">
          <SectionBoundary label="memories-hallway">
            <MemoriesHallway photos={archivePhotos} />
          </SectionBoundary>
        </div>

        {[2025, 2024].map((year) => (
          <div key={year} className="mt-10">
            <h2 className="mb-4 font-mono text-sm uppercase tracking-wide text-paper/60">{year}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {photosWithColor
                .filter(({ photo }) => photo.year === year)
                .map(({ photo, priorColor }) => (
                  <Frame
                    key={photo.src}
                    src={photo.src}
                    alt={photo.description}
                    title={photo.title}
                    previousColor={priorColor}
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
