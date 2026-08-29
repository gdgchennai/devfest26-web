---
name: deploy-bundle-size
description: Why proxy.ts was deleted and the markdown rewrite moved to a Cloudflare Transform Rule
metadata:
  type: project
---

The main app deploys to Cloudflare Workers via OpenNext. The **free plan caps the Worker script at 3 MiB gzipped**; paid is 10 MiB.

2026-08-29: the bundle hit **3218 KiB gz** (over). Cause: `proxy.ts` (Next middleware, doing only `Accept: text/markdown` → `/md/*` URL rewrite) — OpenNext inlines the whole Next middleware runtime, **~1224 KiB gz on its own**. `next-auth` adds ~300–500 KiB gz but removing it isn't an option.

Fix: **deleted `proxy.ts`** → bundle dropped to **1994 KiB gz** (deploys on free plan). The `app/md/**` route handlers stay (they're cheap and already set `Content-Type` + `Vary: Accept`). The rewrite moved to a Cloudflare **Transform Rule (Rewrite URL)** on the zone — see `docs/markdown-negotiation.md` for the exact expression. The user creates the rule in the dashboard.

Do not re-add `middleware.ts`/`proxy.ts` on the free plan without checking the bundle — it costs ~1.2 MiB gz.
