import type { Metadata } from "next";
import { codeOfConduct } from "@/lib/content";
import { uiCopy } from "@/site.config";

export const metadata: Metadata = { title: "Code of Conduct" };

export default function CodeOfConductPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{uiCopy.codeOfConductPage.heading}</h1>

      {codeOfConduct.isPlaceholder && (
        <p className="mt-3 rounded-lg border border-yellow/30 bg-yellow/10 p-3 font-mono text-xs text-yellow">
          {uiCopy.codeOfConductPage.placeholderNotice}
        </p>
      )}

      <div className="mt-8 space-y-8">
        {codeOfConduct.sections.map((section) => (
          <div key={section.heading}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            <p className="mt-2 text-paper/80">{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
