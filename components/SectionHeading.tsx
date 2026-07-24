const EYEBROW_DOT: Record<string, string> = {
  blue: "bg-blue",
  red: "bg-red",
  yellow: "bg-yellow",
  green: "bg-green",
};

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  dotColor?: keyof typeof EYEBROW_DOT;
};

export function SectionHeading({ eyebrow, title, dotColor = "blue" }: SectionHeadingProps) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-paper/60">
        <span className={`h-2 w-2 rounded-full ${EYEBROW_DOT[dotColor]}`} />
        {eyebrow}
      </div>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
    </div>
  );
}
