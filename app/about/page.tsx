import type { Metadata } from "next";
import { about } from "@/lib/content";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">About {siteConfig.chapter}</h1>
      <p className="mt-6 text-lg text-paper/85">{about.body}</p>
    </div>
  );
}
