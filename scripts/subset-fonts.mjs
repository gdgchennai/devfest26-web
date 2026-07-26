#!/usr/bin/env node
/**
 * Subsets the Google Sans variable font to Latin and writes a WOFF2 into
 * public/fonts/.
 *
 *   npm run fonts
 *
 * Why this exists: `next/font/local` self-hosts and preloads, but it copies the
 * file byte for byte — it does not transcode and does not subset. Pointing it
 * at the 4.6 MB source TTF therefore shipped 4.6 MB to every visitor, roughly
 * nine times the entire hero photo payload. `display: swap` meant text still
 * painted immediately in a fallback, so this was never a blank screen — it was
 * bandwidth, and a late reflow when the real font finally landed.
 *
 * Run this whenever the source font is replaced, or when the site starts
 * needing characters outside the range below.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = join(ROOT, "Google_Sans", "GoogleSans-VariableFont_GRAD,opsz,wght.ttf");
const OUT_DIR = join(ROOT, "public", "fonts");
const OUT = join(OUT_DIR, "google-sans-latin.woff2");

/**
 * Deliberately a *range*, not the exact characters currently on the site.
 * Subsetting to today's copy would break the moment a speaker with an accented
 * name is added, and that failure is silent — the glyph just renders as tofu.
 * Latin-1 plus Extended-A covers European names; the rest are characters the
 * design actually uses (· in the date line, → in links, the arrows and dashes).
 */
const RANGES = [
  [0x0020, 0x007e], // Basic Latin
  [0x00a0, 0x00ff], // Latin-1 Supplement — accented names
  [0x0100, 0x017f], // Latin Extended-A
  [0x2010, 0x2027], // dashes, quotes, ellipsis, bullet
  [0x2030, 0x205e], // per-mille, primes, misc punctuation
  [0x20b9, 0x20b9], // ₹
  [0x2190, 0x2193], // ← ↑ → ↓
  [0x2212, 0x2212], // minus
];

function characters() {
  let out = "";
  for (const [from, to] of RANGES) {
    for (let c = from; c <= to; c += 1) out += String.fromCodePoint(c);
  }
  return out;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`\n  ✗ Source font not found at ${SOURCE}\n`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const source = readFileSync(SOURCE);
  const subset = await subsetFont(source, characters(), {
    targetFormat: "woff2",
    // Keep the variable axes: the site uses weight 100–900 from this one file,
    // so pinning to a static instance would cost every weight but one.
    variationAxes: undefined,
  });

  writeFileSync(OUT, subset);

  const before = statSync(SOURCE).size;
  const after = statSync(OUT).size;
  console.log(`\n  ${SOURCE.replace(ROOT, "")}  ${kb(before)}`);
  console.log(`  -> public/fonts/google-sans-latin.woff2  ${kb(after)}`);
  console.log(`  ${(100 - (after / before) * 100).toFixed(1)}% smaller\n`);
}

main().catch((error) => {
  console.error(`\n  ✗ ${error.message}\n`);
  process.exit(1);
});
