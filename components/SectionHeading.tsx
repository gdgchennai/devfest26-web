import { Eyebrow, type DotColor } from "@/components/Eyebrow";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  dotColor?: DotColor;
};

export function SectionHeading({ eyebrow, title, dotColor = "blue" }: SectionHeadingProps) {
  return (
    <div className="mb-8">
      <Eyebrow dotColor={dotColor} className="mb-2">
        {eyebrow}
      </Eyebrow>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
    </div>
  );
}
