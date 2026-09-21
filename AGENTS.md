<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# DevFest Chennai 2026 — guide for AI coding agents

Read by Claude Code, Cursor, Antigravity and any other tool that supports `AGENTS.md`. It is the **single source of truth**: `CLAUDE.md` only imports it, and nothing tool-specific should restate it. Keep it short — depth lives in `docs/` (linked below). Setup per tool: [`docs/ai-tools.md`](docs/ai-tools.md).

## What this is

The DevFest Chennai 2026 site: Next.js 16 (App Router, React 19, TypeScript, Tailwind v4) deployed to **Cloudflare Workers** with `@opennextjs/cloudflare`, D1 for data and R2 for the ISR cache. Heavy motion layer: GSAP + Lenis + three.js. Sign-in is Auth.js v5 (Google). Needs Node ≥ 20.9 and `npm install` first (the Next docs path above only exists after that).

## Commands

```bash
npm run dev               # http://localhost:3000 (Next will refuse a second dev server)
npx tsc --noEmit          # typecheck — must be clean
npm run lint              # ESLint — no new problems (see "Before you say done")
npm run preview           # build + run on the local Workers runtime (slow; use for Worker-only issues)
npm run cf-typegen        # regenerate cloudflare-env.d.ts after changing wrangler.jsonc bindings
```

There is **no test suite**. Verify by typechecking, linting, and exercising the change in the browser.

## Before you say "done"

1. `npx tsc --noEmit` is clean.
2. `npm run lint` shows **no new** problems. The repo has a known baseline (about 15 errors in `components/motion/*`, `TicketsList`, `HamburgerMenu`, `HeaderTitleContext`, and `TypingGame`). Don't add to it, and don't "fix" unrelated files in the same change.
3. UI change → run it and look, at desktop **and** phone width, and with `?lite=1` (see "Motion and styling rules"). An AI agent can't judge animation from code: watch it play.
4. Docs updated if you changed behaviour, an env var, a route, or a hard constraint below.

## Repo map

- `app/` routes + `app/api/**`. **`lib/routes.ts` is the one route list** (nav, 404 grid, sitemap all read it).
- `components/motion/` GSAP/Lenis/three.js sections; `components/games/` mini-games; `components/auth/`, `components/favorites/`.
- `lib/` logic. Notable: `motion-prefs.ts` (lite / reduced-motion gates), `gpu.ts`, `game-rules.ts` + `game-sessions.ts` (game scoring), `db.ts` (D1), `image-sizes.ts`.
- `site.config.ts` = every fact about the event (dates, links, copy). `content/*.json` = agenda, archive, games content.
- `migrations/` D1 schema (numbered, additive). `workers/ticketing/` is a **separate Worker** — its own `wrangler.jsonc`/`tsconfig`, excluded from root lint and typecheck, and it owns all writes to `tickets`.

## Hard constraints (each one cost someone a debugging session)

- **Worker size.** The free plan caps the Worker at 3 MiB gzipped. Adding `middleware.ts`/`proxy.ts` costs ~1.2 MiB; the `/md` rewrite is a Cloudflare Transform Rule for exactly this reason. Check bundle size before adding a dependency. (`docs/markdown-negotiation.md`, `memory/deploy-bundle-size.md`)
- **Runtime.** Route handlers that touch D1, auth or Node APIs export `runtime = "nodejs"`. **Never `"edge"`** — OpenNext on Cloudflare doesn't run it. `cacheComponents` is off; public pages use `export const dynamic = "force-static"`.
- **Markdown twins** (`app/md/**`): the one list of which pages have one is `lib/markdown-routes.json`; the Cloudflare rewrite rule is a dashboard setting the repo can't see. After adding a twin run `npm run md:rule` (prints the rule) and `npm run md:check -- --live`. `md:check` runs on deploy. See `docs/markdown-negotiation.md`.
- **Don't run two Miniflare instances** on one state dir (`npm run dev` + `npm run worker:ticketing:dev` together poisons the D1 stub). One at a time.
- **Game scores are decided on the server.** Change rules only in `lib/game-rules.ts`; never accept a score, time or move count from the client; crossword answers never leave the server. Read `docs/games.md` first.
- **Images:** always `next/image`. Variants come from Cloudflare Images via `/_next/image`; widths are `IMAGE_DEVICE_SIZES` (max 1920). Source files needn't be wider than ~2400px. `optimizedSrc()` in `useAssetsLoaded.ts` must build the same URLs the loader does.
- **Env vars:** every new one goes in `docs/environment.md` and the matching template. Which file: read through `process.env` → `.env.local` (`.env.example`); read through `getCloudflareContext().env` → `.dev.vars` (`.dev.vars.example`), even under `npm run dev`, which ignores `.env*` for that object. Never commit `.env*` (except the template) or `.dev.vars`, and never paste a key into code.

## Motion and styling rules

- **Every motion feature needs a non-motion path.** Gate on `shouldUseStaticBaseline()` (lite or reduced-motion — reduced-motion now *is* lite by default). Test `?lite=1` (on) and `?lite=0` (off); the choice is remembered in `localStorage`.
- **Lenis can be `null`** (lite, reduced-motion, before it loads). Always `lenisRef.current?.…`. Scroll locks in `VenueReveal`/hero depend on it being present in full mode.
- **GPU work is gated** on `html.gpu` (`lib/gpu.ts`) — don't add unconditional `will-change` / `force3D`.
- **Tailwind v4 tokens, not literals:** `bg-blue`, `text-paper`, `text-ink`, `bg-ink/60`. No `bg-[var(--blue)]`, no hex, no `font-mono` (everything is Google Sans). `text-white`/`text-black` only on solid brand fills.
- **CSS build quirk:** never write both `backdrop-filter` and `-webkit-backdrop-filter` in one rule — the build keeps only the prefixed one, which Chrome and Firefox ignore. Write the standard property and let the build prefix it.
- Skills for the scroll "hallway" and the rolling-text CTA effect are below — read them **before** touching those files.

## Git

- Don't commit or push unless asked. One focused change per commit; the message explains *why*.
- Author commits as the developer's own configured git identity. Don't add AI co-author trailers or tool names to commit messages or PR text.
- PRs target `main`. See `CONTRIBUTING.md`.

## Where to read more

| Topic | File |
|---|---|
| All AI-tool setup (Claude Code, Cursor, Antigravity) | [`docs/ai-tools.md`](docs/ai-tools.md) |
| Route map, motion system, content model, audit log | [`devfest-2026-site-architecture.md`](devfest-2026-site-architecture.md) |
| Deploy, Workers, secrets, migrations | [`docs/deployment.md`](docs/deployment.md) |
| Every env var | [`docs/environment.md`](docs/environment.md) |
| Sign-in, saved sessions, tickets | [`docs/accounts-and-favorites.md`](docs/accounts-and-favorites.md) |
| Mini-games and score integrity | [`docs/games.md`](docs/games.md) |
| `/md/*` markdown twins | [`docs/markdown-negotiation.md`](docs/markdown-negotiation.md) |
| Scroll hallway (homepage hero + `/memories`) | [`.claude/skills/hallway/SKILL.md`](.claude/skills/hallway/SKILL.md) |
| Rolling-text hover effect on CTAs | [`.claude/skills/rolling-text/SKILL.md`](.claude/skills/rolling-text/SKILL.md) |
| GSAP / three.js API reference | `.claude/skills/gsap-*/SKILL.md`, `.claude/skills/threejs-*/SKILL.md` |

The skill files are ordinary Markdown: if your tool doesn't load `.claude/skills` automatically, just open them by path. The `memory/` folder holds longer project notes (auth/tickets wiring, the Worker size incident) worth reading before changing those areas.
