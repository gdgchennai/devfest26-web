import type { Metadata } from "next";
import { archivePhotos } from "@/lib/content";
import { fallbackColorFor, type FallbackColor } from "@/lib/fallback-color";
import { Frame } from "@/components/Frame";
import { SectionBoundary } from "@/components/SectionBoundary";
import { MemoriesHallway } from "@/components/motion/MemoriesHallway";
import { uiCopy } from "@/site.config";

export const metadata: Metadata = { title: "Memories" };

export default function MemoriesPage() {
  let previousColor: FallbackColor | undefined;

  const photosWithColor = archivePhotos.map((photo) => {
    const priorColor = previousColor;
    previousColor = fallbackColorFor(photo.title, priorColor);
    return { photo, priorColor };
  });

  return (
    <div className="px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{uiCopy.memoriesPage.heading}</h1>
      <p className="mt-2 max-w-xl text-paper/70">{uiCopy.memoriesPage.body}</p>

      {/* Contained: if the hallway animation throws, it just vanishes and the
          static year grids below still render — no fallback needed. */}
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
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
