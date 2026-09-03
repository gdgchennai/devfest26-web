import type { Metadata } from "next";
import { siteConfig, uiCopy } from "@/site.config";

export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-static";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{uiCopy.contactPage.heading}</h1>
      <p className="mt-4 text-paper/80">
        {uiCopy.contactPage.bodyPrefix}
        {siteConfig.chapter}
        {uiCopy.contactPage.bodySuffix}
      </p>
      <a
        href={`mailto:${siteConfig.contact.email}`}
        className="mt-6 inline-block text-lg text-blue underline underline-offset-4 hover:decoration-2"
      >
        {siteConfig.contact.email}
      </a>
    </div>
  );
}
