# DevFest 2026 Chennai Website

![Home](docs/screenshot.png)

Enter the DevFest experience!

Built with Next.js 16, React 19, Tailwind v4, GSAP, Lenis and three.js. Runs on
Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare),
with D1 (accounts, tickets, game scores and runs) and R2 (ISR cache).

## Local development

Needs Node 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # fill AUTH_SECRET + the two Google values (only needed for sign-in)
npm run dev                  # http://localhost:3000
```

The pages work without any secrets. Sign-in needs the three `AUTH_*` values. The
database is a local D1 that Wrangler creates for you under `.wrangler/`; the
mini-games at `/games` use it to keep score, and fall back to in-memory storage in
dev if it isn't there.

Using an AI coding tool? Claude Code, Cursor and Antigravity all read
[`AGENTS.md`](AGENTS.md); see [`docs/ai-tools.md`](docs/ai-tools.md).

## Docs

| | |
|---|---|
| [`docs/deployment.md`](docs/deployment.md) | Cloudflare setup, the two Workers, secrets, migrations, Google auth |
| [`docs/environment.md`](docs/environment.md) | Every environment variable — type, home, example |
| [`docs/accounts-and-favorites.md`](docs/accounts-and-favorites.md) | Google sign-in + saved sessions internals |
| [`docs/games.md`](docs/games.md) | The mini-games and how their scores are kept honest |
| [`docs/ai-tools.md`](docs/ai-tools.md) | Working here with Claude Code, Cursor or Antigravity |
| [`AGENTS.md`](AGENTS.md) | The rules AI coding agents follow in this repo |
| [`docs/markdown-negotiation.md`](docs/markdown-negotiation.md) | The `/md/*` markdown twins |
| [`devfest-2026-site-architecture.md`](devfest-2026-site-architecture.md) | Route map, the motion system, content model, audit log |
| [`workers/ticketing/README.md`](workers/ticketing/README.md) | The KonfHub webhook Worker |

## Common commands

```bash
npm run dev                      # Next dev server
npx tsc --noEmit                 # typecheck
npm run lint                     # ESLint (has a known baseline, see AGENTS.md)
npm run preview                  # build + run on the local Workers runtime
npm run deploy                   # build + deploy the site to Cloudflare
npm run cf-typegen               # regenerate cloudflare-env.d.ts after changing bindings
npm run worker:ticketing:deploy  # deploy the standalone ticketing Worker
```

There is no automated test suite; check changes by typechecking, linting and
trying them in the browser (desktop and phone width, and `?lite=1`).
