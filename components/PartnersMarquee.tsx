import Image from "next/image";
import { uiCopy } from "@/site.config";

const { heading, items } = uiCopy.partnersMarquee;

// Enough logos per half that it always spans wider than the screen, so the
// loop never shows a gap — a short list is simply repeated.
const MIN_PER_HALF = 8;

function Half({ dupe }: { dupe?: boolean }) {
  const repeats = Math.max(1, Math.ceil(MIN_PER_HALF / items.length));
  const list = Array.from({ length: repeats }, () => items).flat();
  return (
    <ul
      aria-hidden={dupe || undefined}
      className={`flex shrink-0 items-center gap-16 pr-16 sm:gap-24 sm:pr-24 ${dupe ? "partners-dupe" : ""}`}
    >
      {list.map((p, i) => {
        const logo = (
          <Image
            src={p.logo}
            alt={dupe || i >= items.length ? "" : p.name}
            width={320}
            height={120}
            unoptimized={p.logo.endsWith(".svg")}
            className="h-12 w-auto max-w-[11rem] object-contain sm:h-14 sm:max-w-[15rem]"
          />
        );
        return (
          <li key={i} className="shrink-0">
            {p.href ? (
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={dupe || i >= items.length ? -1 : undefined}
                className="block opacity-70 transition-opacity hover:opacity-100"
              >
                {logo}
              </a>
            ) : (
              logo
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Community-partner logo marquee on the homepage, between the sponsors and
 * "See you there!". CSS-only (see `.partners-track` in globals.css); lite mode swaps it
 * for a static wrapped row. Renders nothing until
 * `uiCopy.partnersMarquee.items` has entries.
 */
export function PartnersMarquee() {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="partners-heading" className="flex flex-col items-center gap-10 pb-8 pt-16 sm:gap-12 sm:pt-24">
      <h2
        id="partners-heading"
        className="px-6 text-center text-[clamp(2rem,6vw,4rem)] font-bold leading-none tracking-tight text-paper"
      >
        {heading}
      </h2>
      <div className="partners-marquee relative w-full overflow-hidden">
        <div className="partners-track flex w-max items-center">
          <Half />
          <Half dupe />
        </div>
      </div>
    </section>
  );
}
