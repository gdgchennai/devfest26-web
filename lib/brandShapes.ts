/**
 * Public URLs of the brand-shape SVGs in public/brand-shapes.
 *
 * This used to list the directory with `fs.readdirSync` at render time, but
 * the Workers runtime has no real filesystem for `public/` (assets are
 * served through the ASSETS binding), so that crashed on every ISR
 * revalidation in production. Add or remove an SVG here when the directory
 * changes.
 */
const BRAND_SHAPE_FILES = [
  "angle.svg",
  "dot.svg",
  "double_slash.svg",
  "left_bracket.svg",
  "right_bracket.svg",
  "small_plus.svg",
];

export function getBrandShapes(): string[] {
  return BRAND_SHAPE_FILES.map((file) => `/brand-shapes/${file}`);
}
