/**
 * Builds a one-glyph three.js typeface for the shaped Tamil lockup "சென்னை".
 * TextGeometry cannot compose Tamil vowel signs from loose Unicode, so the
 * whole word is shaped with fontkit and stored as a single PUA glyph (U+E000).
 *
 *   node scripts/build-tamil-typeface.mjs
 */
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fontkit = require("fontkit");

const WORD = "சென்னை";
const PUA = "\uE000";
const RESOLUTION = 1000;
const FONT_URL =
  "https://fonts.gstatic.com/s/notosanstamil/v31/ieVc2YdFI3GCY6SyQy1KfStzYKZgzN1z4LKDbeZce-0429tBManUktuex7shpL0R.ttf";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "public/fonts/noto-sans-tamil-chennai.typeface.json");

function cmdOf(c) {
  return c.command || c.code || c.type;
}

function argsOf(c) {
  if (Array.isArray(c.args)) return c.args;
  const a = [];
  for (const k of ["x1", "y1", "x2", "y2", "x", "y"]) {
    if (typeof c[k] === "number") a.push(c[k]);
  }
  return a;
}

function appendPath(out, path, dx, dy, scale) {
  const commands = path.commands || path;
  for (const c of commands) {
    const cmd = String(cmdOf(c));
    const a = argsOf(c).map((n, i) => (i % 2 === 0 ? n + dx : n + dy) * scale);
    const r = (n) => Math.round(n * 100) / 100;
    switch (cmd) {
      case "moveTo":
      case "M":
        out.push("m", r(a[0]), r(a[1]));
        break;
      case "lineTo":
      case "L":
        out.push("l", r(a[0]), r(a[1]));
        break;
      case "quadraticCurveTo":
      case "Q":
        // typeface q: dest, then control (see FontLoader.createPath)
        out.push("q", r(a[2]), r(a[3]), r(a[0]), r(a[1]));
        break;
      case "bezierCurveTo":
      case "C":
        out.push("b", r(a[4]), r(a[5]), r(a[0]), r(a[1]), r(a[2]), r(a[3]));
        break;
      case "closePath":
      case "Z":
      case "z":
        out.push("z");
        break;
      default:
        throw new Error(`Unhandled path command: ${cmd}`);
    }
  }
}

const res = await fetch(FONT_URL);
if (!res.ok) throw new Error(`font download ${res.status}`);
const font = fontkit.create(Buffer.from(await res.arrayBuffer()));
const run = font.layout(WORD);
const scale = RESOLUTION / font.unitsPerEm;
const outline = [];
let penX = 0;
let penY = 0;
let xMin = Infinity;
let yMin = Infinity;
let xMax = -Infinity;
let yMax = -Infinity;

for (let i = 0; i < run.glyphs.length; i++) {
  const glyph = run.glyphs[i];
  const pos = run.positions[i];
  const dx = penX + pos.xOffset;
  const dy = penY + pos.yOffset;
  const bbox = glyph.path.bbox;
  if (bbox) {
    xMin = Math.min(xMin, (bbox.minX + dx) * scale);
    yMin = Math.min(yMin, (bbox.minY + dy) * scale);
    xMax = Math.max(xMax, (bbox.maxX + dx) * scale);
    yMax = Math.max(yMax, (bbox.maxY + dy) * scale);
  }
  appendPath(outline, glyph.path, dx, dy, scale);
  penX += pos.xAdvance;
  penY += pos.yAdvance;
}

const ha = Math.round(penX * scale);
const data = {
  glyphs: {
    [PUA]: {
      ha,
      x_min: Math.round(xMin),
      x_max: Math.round(xMax),
      o: `${outline.join(" ")} `,
    },
  },
  familyName: "Noto Sans Tamil Bold (சென்னை)",
  ascender: Math.round(font.ascent * scale),
  descender: Math.round(font.descent * scale),
  underlinePosition: -100,
  underlineThickness: 50,
  boundingBox: {
    xMin: Math.round(xMin),
    xMax: Math.round(xMax),
    yMin: Math.round(yMin),
    yMax: Math.round(yMax),
  },
  resolution: RESOLUTION,
  original_font_information: { fullName: { en: "Noto Sans Tamil Bold" } },
};

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(data));
console.log(`Wrote ${outFile} (${run.glyphs.length} shaped glyphs, ha=${ha})`);
