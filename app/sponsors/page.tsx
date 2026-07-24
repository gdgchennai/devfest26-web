import type { Metadata } from "next";
import { sponsorsByTier } from "@/lib/content";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "Sponsors" };

const TIERS = [
  { tier: "gold" as const, label: "Gold" },
  { tier: "associate" as const, label: "Associate" },
  { tier: "community" as const, label: "Community Partners" },
];

export default function SponsorsPage() {
  return (
    <div className="px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sponsors</h1>
      <p className="mt-2 max-w-xl text-paper/70">
        DevFest Chennai 2026 is made possible by the organisations that back it. 2026 sponsors are
        still being confirmed.
      </p>

      <div className="mt-8 space-y-10">
        {TIERS.map(({ tier, label }) => {
          const tierSponsors = sponsorsByTier(tier);
          return (
            <div key={tier}>
              <h2 className="mb-4 text-xl font-semibold">{label}</h2>
              {tierSponsors.length === 0 ? (
                <EmptyState message={`${label} sponsors will be announced soon.`} />
              ) : (
                <div className="flex flex-wrap gap-8">
                  {tierSponsors.map((s) => (
                    <a
                      key={s.name}
                      href={s.url ?? undefined}
                      className="text-lg text-paper/85 hover:text-paper"
                    >
                      {s.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-sm text-paper/60">
        Interested in sponsoring? Reach out via the{" "}
        <a href="/contact" className="text-blue hover:underline">
          contact page
        </a>{" "}
        for the sponsorship brochure.
      </p>
    </div>
  );
}
