#!/usr/bin/env node
/**
 * Keeps the markdown twins (app/md/**), the pages that advertise them, and the Cloudflare
 * rewrite rule in step. The list lives in lib/markdown-routes.json.
 *
 *   npm run md:rule                       # print the two Cloudflare rules for that list
 *   npm run md:check                      # fail if app/md/** and the list disagree (runs on deploy)
 *   npm run md:check -- --live [origin]   # also ask the live site: does `Accept: text/markdown`
 *                                         # on each page really return markdown?
 *
 * Why it exists: the rewrite (`Accept: text/markdown` on /agenda -> serve /md/agenda) is a
 * Cloudflare Transform Rule in the dashboard (see docs/markdown-negotiation.md), which the repo
 * can't see. /partner got a twin a day after the rule was written and was never added to it.
 * The static check catches a handler and the list drifting; `--live` catches the dashboard.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const { pages, prefixes } = JSON.parse(readFileSync(join(ROOT, "lib/markdown-routes.json"), "utf8"));
const args = process.argv.slice(2);
const HOST = "devfest.gdgchennai.in";

/** URL path of every handler under app/md, e.g. app/md/speakers/[slug]/route.ts -> /speakers/[slug]. */
function handlerPaths() {
  const base = join(ROOT, "app/md");
  const found = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === "route.ts") {
        const rel = relative(base, dir).split(sep).join("/");
        found.push(rel ? `/${rel}` : "/");
      }
    }
  })(base);
  return found.sort();
}

function check() {
  const problems = [];
  const handlers = handlerPaths();
  const dynamic = handlers.filter((h) => h.includes("["));
  const fixed = handlers.filter((h) => !h.includes("["));

  for (const page of pages) {
    if (!fixed.includes(page)) problems.push(`"${page}" is in the list but has no handler (expected app/md${page === "/" ? "" : page}/route.ts)`);
  }
  for (const h of fixed) {
    if (!pages.includes(h)) problems.push(`app/md${h === "/" ? "" : h}/route.ts exists but "${h}" is not in lib/markdown-routes.json`);
  }
  for (const h of dynamic) {
    const prefix = h.slice(0, h.indexOf("[")); // /speakers/[slug] -> /speakers/
    if (!prefixes.includes(prefix)) problems.push(`app/md${h}/route.ts is dynamic but "${prefix}" is not in "prefixes"`);
  }
  for (const prefix of prefixes) {
    if (!dynamic.some((h) => h.startsWith(prefix))) problems.push(`prefix "${prefix}" has no dynamic handler under app/md`);
  }
  return { problems, handlers };
}

function rules() {
  const set = pages
    .filter((p) => p !== "/")
    .map((p) => `"${p}"`)
    .join(" ");
  const prefixTests = prefixes.map((p) => `(starts_with(http.request.uri.path, "${p}") and http.request.uri.path ne "${p}")`);
  const pathTest = [`http.request.uri.path in {${set}}`, ...prefixTests].join("\n      or ");
  return `Dashboard -> the gdgchennai.in zone -> Rules -> Transform Rules -> Rewrite URL

Rule 1 - "Markdown negotiation (home)"
  If (custom expression):
    http.host eq "${HOST}"
    and any(http.request.headers["accept"][*] contains "text/markdown")
    and http.request.uri.path eq "/"
  Then: Path -> Rewrite to -> Static: /md

Rule 2 - "Markdown negotiation (pages)"
  If (custom expression):
    http.host eq "${HOST}"
    and any(http.request.headers["accept"][*] contains "text/markdown")
    and (
      ${pathTest}
    )
  Then: Path -> Rewrite to -> Dynamic: concat("/md", http.request.uri.path)

(Leave Query unchanged on both rules.)`;
}

async function live(origin) {
  const bad = [];
  for (const page of pages) {
    const res = await fetch(origin + page, { headers: { Accept: "text/markdown" }, redirect: "manual" });
    const type = res.headers.get("content-type") ?? "";
    const ok = res.status === 200 && type.startsWith("text/markdown");
    console.log(`${ok ? "ok  " : "FAIL"} ${page.padEnd(18)} ${res.status} ${type}`);
    if (!ok) bad.push(page);
  }
  return bad;
}

const { problems, handlers } = check();
if (args.includes("--check") || args.includes("--live")) {
  if (problems.length) {
    console.error("Markdown twins are out of step:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    console.error("\nFix lib/markdown-routes.json and app/md/**, then update the Cloudflare rule (npm run md:rule).");
    process.exit(1);
  }
  console.log(`md:check ok - ${handlers.length} handlers match lib/markdown-routes.json (${pages.length} pages, ${prefixes.length} prefix).`);
  const at = args.indexOf("--live");
  if (at !== -1) {
    const next = args[at + 1] ?? "";
    const origin = next.startsWith("http") ? next.replace(/\/$/, "") : `https://${HOST}`;
    console.log(`\nAsking ${origin} for Accept: text/markdown on each page...`);
    const bad = await live(origin);
    if (bad.length) {
      console.error(`\nThe live site does not negotiate markdown for: ${bad.join(", ")}.\nThe Cloudflare rewrite rule is missing them - run \`npm run md:rule\` and paste it into the dashboard.`);
      process.exit(1);
    }
    console.log("\nAll pages negotiate markdown.");
  }
} else {
  console.log(rules());
  if (problems.length) console.error("\nWARNING - the list and app/md/** disagree:\n" + problems.map((p) => `  - ${p}`).join("\n"));
}
