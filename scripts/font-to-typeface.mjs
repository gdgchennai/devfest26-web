#!/usr/bin/env node
/**
 * Converts Google Sans Bold (static TTF) into a subset typeface JSON that
 * three.js's FontLoader + TextGeometry can extrude into 3D text.
 *
 *   node scripts/font-to-typeface.mjs
 *
 * The conversion is ported verbatim from three's TTFLoader `convert()` so the
 * output is guaranteed compatible with FontLoader — but run here at build time
 * (against a locally installed opentype.js) so we never pull opentype from a
 * CDN at runtime, and the committed JSON is subset to A–Z/a–z + space, a few KB
 * rather than the whole font.
 */
import opentype from "opentype.js";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "Google_Sans/static/GoogleSans-Bold.ttf");
const OUT = join(root, "public/fonts/google-sans-bold.typeface.json");

const allowed = new Set([" "]);
for (let c = 65; c <= 90; c += 1) allowed.add(String.fromCharCode(c)); // A–Z
for (let c = 97; c <= 122; c += 1) allowed.add(String.fromCharCode(c)); // a–z

const round = Math.round;

function convert(font) {
  const glyphs = {};
  const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
  const glyphIndexMap = font.encoding.cmap.glyphIndexMap;

  for (const unicode of Object.keys(glyphIndexMap)) {
    const ch = String.fromCodePoint(Number(unicode));
    if (!allowed.has(ch)) continue;

    const glyph = font.glyphs.glyphs[glyphIndexMap[unicode]];
    const token = {
      ha: round(glyph.advanceWidth * scale),
      x_min: round(glyph.xMin * scale),
      x_max: round(glyph.xMax * scale),
      o: "",
    };

    glyph.path.commands.forEach((command) => {
      const type = command.type.toLowerCase() === "c" ? "b" : command.type.toLowerCase();
      token.o += type + " ";
      if (command.x !== undefined && command.y !== undefined)
        token.o += round(command.x * scale) + " " + round(command.y * scale) + " ";
      if (command.x1 !== undefined && command.y1 !== undefined)
        token.o += round(command.x1 * scale) + " " + round(command.y1 * scale) + " ";
      if (command.x2 !== undefined && command.y2 !== undefined)
        token.o += round(command.x2 * scale) + " " + round(command.y2 * scale) + " ";
    });

    glyphs[ch] = token;
  }

  return {
    glyphs,
    familyName: font.getEnglishName("fullName") || "Google Sans",
    ascender: round(font.ascender * scale),
    descender: round(font.descender * scale),
    underlinePosition: font.tables.post.underlinePosition,
    underlineThickness: font.tables.post.underlineThickness,
    boundingBox: {
      xMin: font.tables.head.xMin,
      xMax: font.tables.head.xMax,
      yMin: font.tables.head.yMin,
      yMax: font.tables.head.yMax,
    },
    resolution: 1000,
    original_font_information: font.tables.name,
  };
}

const buffer = readFileSync(SRC);
const font = opentype.parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
);
const json = convert(font);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(json));
console.log(`wrote ${OUT} — ${Object.keys(json.glyphs).length} glyphs`);
