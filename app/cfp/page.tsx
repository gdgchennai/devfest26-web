import type { Metadata } from "next";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = { title: "Call for Proposals" };

export default function CfpPage() {
  // Server Component: this reads wall-clock time once per request/build to
  // decide CFP status, not during a client re-render — react-hooks/purity
  // doesn't apply the same way here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const opensAt = siteConfig.cfp.opensAt ? new Date(siteConfig.cfp.opensAt).getTime() : null;
  const closesAt = siteConfig.cfp.closesAt ? new Date(siteConfig.cfp.closesAt).getTime() : null;

  const isOpen = opensAt !== null && now >= opensAt && (closesAt === null || now <= closesAt);
  const isClosed = closesAt !== null && now > closesAt;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Call for Proposals</h1>
      <p className="mt-4 text-paper/80">
        DevFest Chennai is looking for speakers across four tracks: AI, Cloud, Mobile, and Web. We
        welcome first-time speakers as much as conference regulars.
      </p>

      <div className="mt-8 rounded-lg border border-paper/10 p-6">
        {isClosed && <p className="font-mono text-sm uppercase text-red">CFP closed</p>}
        {isOpen && siteConfig.cfp.formUrl && (
          <a
            href={siteConfig.cfp.formUrl}
            className="inline-block rounded-full bg-blue px-6 py-3 text-sm font-medium text-paper hover:opacity-90"
          >
            Submit a proposal
          </a>
        )}
        {!isOpen && !isClosed && (
          <p className="font-mono text-sm uppercase tracking-wide text-yellow">Opening soon</p>
        )}
      </div>
    </div>
  );
}
