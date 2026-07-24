import type { Metadata } from "next";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Contact</h1>
      <p className="mt-4 text-paper/80">
        Questions about DevFest Chennai 2026 — sponsorship, speaking, volunteering, or anything
        else? Reach the {siteConfig.chapter} organising team directly.
      </p>
      <a
        href={`mailto:${siteConfig.contact.email}`}
        className="mt-6 inline-block text-lg text-blue underline-offset-4 hover:underline"
      >
        {siteConfig.contact.email}
      </a>
    </div>
  );
}
