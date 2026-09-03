import type { Metadata } from "next";
import { BracketsField } from "@/components/motion/BracketsField";
import { SectionDivider } from "@/components/SectionDivider";
import { partnership, ASSET_PENDING } from "@/lib/partnership";

export const metadata: Metadata = {
  title: partnership.heading,
  description:
    "Team up with GDG Chennai on DevFest Chennai — promote the event, host a Roadshow, and get passes, discounts, stage time and more in return.",
};
export const dynamic = "force-static";

/**
 * /partner — the community partnership doc. A community-to-community deal
 * (not sponsorship, see lib/routes.ts's retired /sponsors) between GDG Chennai
 * and other tech communities around the city.
 *
 * All copy lives in lib/partnership.ts, shared with the markdown twin served
 * at /md/partner (partnerMarkdown()), so the two never drift.
 */
export default function PartnerPage() {
  const { heading, lede, what, why, asks, benefits, finePrint, timeline, assets, contact } = partnership;

  return (
    <>
      {/* Same settled 3D brand-shape backdrop the other content routes mount
          (agenda, tickets, memories) — page-agnostic, see BracketsField. */}
      <BracketsField mode="settled" />

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-16 sm:px-8">
        <p className="font-mono text-xs uppercase tracking-wider text-paper/50">Community</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
        <p className="mt-4 text-lg text-paper/80">{lede}</p>

        {/* What */}
        <Section title={what.heading}>
          {what.body.map((p) => (
            <p key={p} className="text-paper/80">
              {p}
            </p>
          ))}
        </Section>

        {/* Why */}
        <Section title={why.heading}>
          <p className="text-paper/80">{why.intro}</p>
          <ul className="ml-5 list-disc space-y-1.5 text-paper/80 marker:text-paper/40">
            {why.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="text-paper/80">{why.outro}</p>
        </Section>

        {/* What we ask */}
        <Section title={asks.heading}>
          <ol className="space-y-6">
            {asks.items.map((item, i) => (
              <li key={item.title} className="flex gap-4">
                <span className="mt-0.5 shrink-0 font-mono text-sm text-paper/40 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="space-y-2">
                  <h3 className="font-semibold text-paper">
                    {item.title}
                    {"note" in item && item.note ? (
                      <span className="ml-2 font-normal text-paper/45">({item.note})</span>
                    ) : null}
                  </h3>
                  <p className="text-paper/80">{item.body}</p>
                  {"points" in item && item.points ? (
                    <ul className="ml-5 list-disc space-y-1 text-paper/80 marker:text-paper/40">
                      {item.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  ) : null}
                  {"link" in item && item.link ? (
                    <a
                      href={item.link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-blue underline underline-offset-4 hover:decoration-2"
                    >
                      {item.link.label}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* What partners get */}
        <Section title={benefits.heading}>
          <ul className="space-y-3">
            {benefits.items.map((item) => (
              <li key={item.lead} className="text-paper/80">
                <span className="font-semibold text-paper">{item.lead}</span>
                {" — "}
                {item.detail}
              </li>
            ))}
          </ul>
        </Section>

        {/* Good to know */}
        <Section title={finePrint.heading}>
          <p className="text-paper/80">{finePrint.intro}</p>
          <ul className="ml-5 list-disc space-y-2 text-paper/80 marker:text-paper/40">
            {finePrint.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Section>

        {/* Timeline */}
        <Section title={timeline.heading}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-paper/80">
              <thead>
                <tr className="border-b border-paper/15 text-sm uppercase tracking-wide text-paper/50">
                  <th className="py-2 pr-4 font-medium">Activity</th>
                  <th className="py-2 font-medium">Window</th>
                </tr>
              </thead>
              <tbody>
                {timeline.rows.map((row) => (
                  <tr key={row.activity} className="border-b border-paper/10">
                    <td className="py-2.5 pr-4">{row.activity}</td>
                    <td className="py-2.5 tabular-nums">{row.window}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-paper/60">{timeline.note}</p>
        </Section>

        {/* Assets */}
        <Section title={assets.heading}>
          <p className="text-paper/80">{assets.intro}</p>
          <ul className="space-y-2">
            {assets.items.map((item) => {
              const link = item.href && (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue underline underline-offset-4 hover:decoration-2"
                >
                  {"linkText" in item && item.linkText ? item.linkText : item.label}
                </a>
              );

              // `href` with no `linkText` — the label is the link, on its own.
              if (item.href && !("linkText" in item && item.linkText)) {
                return <li key={item.label}>{link}</li>;
              }

              // Everything else reads "Label — <value>".
              return (
                <li key={item.label} className="text-paper/80">
                  <span className="font-semibold text-paper">{item.label}</span>
                  {" — "}
                  {link ? (
                    link
                  ) : "text" in item && item.text ? (
                    <span className="break-words">{item.text}</span>
                  ) : (
                    <span className="text-paper/50">{ASSET_PENDING}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        {/* Questions */}
        <Section title={contact.heading}>
          <p className="text-paper/80">{contact.body}</p>
          <a
            href={`mailto:${contact.email}`}
            className="inline-block text-lg text-blue underline underline-offset-4 hover:decoration-2"
          >
            {contact.email}
          </a>
        </Section>
      </div>
    </>
  );
}

/** One titled block: the drawing rule, the heading, then its content. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <SectionDivider />
      <h2 className="mb-4 mt-6 text-xl font-semibold tracking-tight text-paper sm:text-2xl">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
