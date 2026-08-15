import { faq } from "@/lib/content";

export function Faq() {
  // bg-surface: this panel had no background at all, so the homepage's 3D
  // backdrop scrolled behind the questions and answers.
  return (
    <div className="divide-y divide-paper/10 rounded-lg border border-paper/10 bg-surface">
      {faq.map((item) => (
        <details key={item.question} className="group p-4">
          <summary className="cursor-pointer list-none font-medium marker:hidden">
            <span className="mr-2 text-blue group-open:hidden">+</span>
            <span className="mr-2 hidden text-blue group-open:inline">−</span>
            {item.question}
          </summary>
          <p className="mt-2 text-sm text-paper/70">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
