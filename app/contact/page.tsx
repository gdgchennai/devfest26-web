import type { Metadata } from "next";
import { siteConfig, uiCopy } from "@/site.config";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: `Contact ${siteConfig.chapter} about ${siteConfig.name} — speaking, volunteering, partnership, or tickets. ${siteConfig.contact.email}`,
  path: "/contact",
});
export const dynamic = "force-static";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-24 text-center sm:px-8 sm:pt-28">
      <p className="text-base text-paper/80 sm:text-lg">
        {uiCopy.contactPage.bodyPrefix}
        {siteConfig.chapter}
        {uiCopy.contactPage.bodySuffix}
      </p>
      <a
        href={`mailto:${siteConfig.contact.email}`}
        className="mt-6 inline-block text-lg text-blue underline underline-offset-4 hover:decoration-2 sm:text-xl"
      >
        {siteConfig.contact.email}
      </a>
    </div>
  );
}
