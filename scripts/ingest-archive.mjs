#!/usr/bin/env node
/**
 * Ingests camera originals from assets/ into public/archive/ and merges them
 * into content/archive.json.
 *
 *   npm run archive
 *
 * Why a script and not a runtime read: content/archive.json is imported through
 * lib/content.ts, which is pulled into the client bundle by the "use client"
 * hero — so nothing in that path can touch fs. The mechanical fields (file,
 * dimensions, year) are generated here; titles and descriptions stay authored,
 * because a generated alt text like "AJI02236" is an accessibility regression
 * rather than a convenience.
 *
 * Idempotent: each entry records the original it came from, so re-running only
 * picks up files that are genuinely new and never disturbs your captions.
 *
 * macOS only — uses sips, which ships with the OS, to avoid an image
 * dependency for what is a local authoring step rather than part of the build.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIR = join(ROOT, "assets");
const OUT_DIR = join(ROOT, "public", "archive");
const JSON_PATH = join(ROOT, "content", "archive.json");

/** Long edge, in px, of the web copy. The hallway never shows a card wider than ~44vw. */
const MAX_EDGE = 1920;
const JPEG_QUALITY = 72;
const SOURCE_EXTS = new Set([".jpg", ".jpeg", ".png", ".heic"]);

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

function sips(args) {
  return execFileSync("sips", args, { encoding: "utf8" });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** EXIF capture year, falling back to the file's mtime when the shot has no date. */
function captureYear(file) {
  const match = sips(["-g", "creation", file]).match(/creation:\s*(\d{4})/);
  if (match) return Number(match[1]);
  return new Date(statSync(file).mtime).getFullYear();
}

function dimensions(file) {
  const out = sips(["-g", "pixelWidth", "-g", "pixelHeight", file]);
  const width = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (!width || !height) fail(`Could not read dimensions from ${basename(file)}`);
  return { width, height };
}

function resize(from, to) {
  sips(["-Z", String(MAX_EDGE), "-s", "format", "jpeg", "-s", "formatOptions", String(JPEG_QUALITY), from, "--out", to]);
}

/** One entry per line — diffs stay readable when a photo is added. */
function serialise(entries) {
  const lines = entries.map((e) => `  ${JSON.stringify(e)}`);
  return `[\n${lines.join(",\n")}\n]\n`;
}

function main() {
  try {
    execFileSync("sips", ["--help"], { stdio: "ignore" });
  } catch {
    fail("sips not found. This script is macOS-only; resize by hand and edit content/archive.json instead.");
  }
  if (!existsSync(SRC_DIR)) fail(`No assets/ directory at ${SRC_DIR}. Put the camera originals there.`);
  mkdirSync(OUT_DIR, { recursive: true });

  const entries = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  const seen = new Set(entries.map((e) => e.source).filter(Boolean));
  const usedSlugs = new Set(entries.map((e) => basename(e.src, ".jpg")));

  const sources = readdirSync(SRC_DIR)
    .filter((f) => SOURCE_EXTS.has(extname(f).toLowerCase()))
    .sort();

  const added = [];
  let regenerated = 0;

  for (const file of sources) {
    const from = join(SRC_DIR, file);

    if (seen.has(file)) {
      // Known original: only redo the web copy if it has gone missing.
      const entry = entries.find((e) => e.source === file);
      const to = join(OUT_DIR, basename(entry.src));
      if (!existsSync(to)) {
        resize(from, to);
        Object.assign(entry, dimensions(to));
        regenerated += 1;
      }
      continue;
    }

    const year = captureYear(from);
    let slug = `${year}-${slugify(basename(file, extname(file)))}`;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${year}-${slugify(basename(file, extname(file)))}-${n++}`;
    usedSlugs.add(slug);

    const to = join(OUT_DIR, `${slug}.jpg`);
    resize(from, to);
    const { width, height } = dimensions(to);

    const entry = {
      src: `/archive/${slug}.jpg`,
      title: "",
      description: "",
      year,
      width,
      height,
      source: file,
    };
    entries.push(entry);
    added.push(entry);
  }

  // Deliberately unsorted: array order is the order photos fly past the camera,
  // which is art direction. New entries land at the end for you to place.
  writeFileSync(JSON_PATH, serialise(entries));

  console.log(`\n  ${sources.length} original(s) in assets/, ${entries.length} entr(ies) in the archive.`);
  if (regenerated) console.log(`  Regenerated ${regenerated} missing web cop(ies).`);
  if (added.length === 0) {
    console.log("  Nothing new to ingest.\n");
    return;
  }

  console.log(`  Added ${added.length}:`);
  for (const e of added) console.log(`    ${e.src}  (${e.year}, ${e.width}x${e.height})`);

  const needCaptions = entries.filter((e) => !e.title || !e.description);
  if (needCaptions.length) {
    console.log(
      `\n  ⚠ ${needCaptions.length} entr(ies) still need a title and description in content/archive.json.` +
        `\n    The description is the image's alt text — it cannot be generated. Until it is written,` +
        `\n    these photos ship to screen readers as unlabelled.\n`,
    );
    for (const e of needCaptions) console.log(`    ${e.src}`);
    console.log("");
  }
}

main();
