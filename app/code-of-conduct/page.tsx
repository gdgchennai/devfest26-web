import type { Metadata } from "next";
import { codeOfConduct } from "@/lib/content";

export const metadata: Metadata = { title: "Code of Conduct" };

export default function CodeOfConductPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Code of Conduct</h1>

      {codeOfConduct.isPlaceholder && (
        <p className="mt-3 rounded-lg border border-yellow/30 bg-yellow/10 p-3 font-mono text-xs text-yellow">
          Placeholder policy — pending review by the organising team before publication.
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
