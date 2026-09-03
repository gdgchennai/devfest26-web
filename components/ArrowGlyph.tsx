export type ArrowDirection = "down" | "up" | "left" | "right";

const ROTATION: Record<ArrowDirection, number> = {
  down: 0,
  right: -90,
  up: 180,
  left: 90,
};

export function ArrowGlyph({ direction }: { direction: ArrowDirection }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      style={{ transform: `rotate(${ROTATION[direction]}deg)`, transition: "transform 220ms ease" }}
    >
      <path
        d="M5 9l7 7 7-7"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
