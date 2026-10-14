import Image from "next/image";
import { uiCopy } from "@/site.config";

const { heading, tiers } = uiCopy.sponsorsSection;

const SIZE = {
  lg: "h-16 max-w-[14rem] sm:h-24 sm:max-w-[22rem]",
  md: "h-12 max-w-[10rem] sm:h-16 sm:max-w-[16rem]",
  sm: "h-10 max-w-[8rem] sm:h-12 sm:max-w-[12rem]",
} as const;

/**
 * Sponsor logos, grouped by tier (Platinum, Gold, ...), between the mood
 * sections and "See you there!". Plain static markup (no motion), so it needs
 * no lite-mode path. Renders nothing until a tier in
 * `uiCopy.sponsorsSection.tiers` has sponsors. Logos sit on the black page
 * backdrop, so they should be white/light artwork.
 */
export function SponsorsSection() {
  const shown = tiers.filter((t) => t.sponsors.length > 0);
  if (shown.length === 0) return null;

  return (
    <section
      aria-labelledby="sponsors-heading"
      className="relative flex flex-col items-center gap-12 px-6 py-16 text-center sm:px-10 sm:py-24"
    >
      <div className="flex flex-col items-center gap-3">
        <h2
          id="sponsors-heading"
          className="text-[clamp(2rem,6vw,4rem)] font-bold leading-none tracking-tight text-paper"
        >
          {heading}
        </h2>
      </div>

      {shown.map((tier) => (
        <div key={tier.label} className="flex flex-col items-center gap-6">
          <h3 className="text-sm font-medium uppercase tracking-widest text-paper/60">{tier.label}</h3>
          <ul className="flex max-w-5xl flex-wrap items-center justify-center gap-x-12 gap-y-8 sm:gap-x-16">
            {tier.sponsors.map((s) => {
              const logo = (
                <Image
                  src={s.logo}
                  alt={s.name}
                  width={480}
                  height={180}
                  unoptimized={s.logo.endsWith(".svg")}
                  className={`w-auto object-contain ${SIZE[tier.size]}`}
                />
              );
              return (
                <li key={s.name}>
                  {s.href ? (
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block opacity-80 transition-opacity hover:opacity-100"
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
        </div>
      ))}
    </section>
  );
}
