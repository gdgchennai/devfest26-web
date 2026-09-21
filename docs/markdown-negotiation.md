# Markdown content negotiation

A request for a canonical page with `Accept: text/markdown` should get the
markdown version of that page (per acceptmarkdown.com) at the **same URL**.

- The markdown itself is served by route handlers under `app/md/**`
  (`/md/agenda`, `/md/speakers/<slug>`, …), built from the same content JSON
  as the HTML pages via `lib/markdown.ts`. Each sets
  `Content-Type: text/markdown; charset=utf-8` and `Vary: Accept`.
- The **rewrite** — `Accept: text/markdown` on `/agenda` → serve `/md/agenda`
  — used to live in `proxy.ts` (Next middleware). It was moved to a
  **Cloudflare Transform Rule** because Next middleware compiles to ~1.2 MiB
  gzipped in the OpenNext Worker bundle (enough on its own to blow the 3 MiB
  free-plan limit). The rule does exactly what `proxy.ts` did, at the edge,
  for free.

## The Transform Rules

Dashboard → the `gdgchennai.in` zone → **Rules → Transform Rules → Create
rule → Rewrite URL**. Two rules (one dynamic rule can't special-case `/` →
`/md` without `regex_replace()`, which needs a Business/WAF-Advanced plan).

### Rule 1 — `Markdown negotiation (home)`

*If* — Custom filter expression:

```
http.host eq "devfest.gdgchennai.in"
and any(http.request.headers["accept"][*] contains "text/markdown")
and http.request.uri.path eq "/"
```

*Then* — Path → Rewrite to → **Static**: `/md`

### Rule 2 — `Markdown negotiation (pages)`

*If* — Custom filter expression:

```
http.host eq "devfest.gdgchennai.in"
and any(http.request.headers["accept"][*] contains "text/markdown")
and (
  http.request.uri.path in {"/agenda" "/speakers" "/tickets" "/tickets/select" "/partner" "/contact" "/creators" "/memories"}
  or (starts_with(http.request.uri.path, "/speakers/") and http.request.uri.path ne "/speakers/")
)
```

*Then* — Path → Rewrite to → **Dynamic**: `concat("/md", http.request.uri.path)`

Leave **Query** unchanged on both.

## Keeping the rule in step

Three things have to agree, and one of them lives in the dashboard where the repo can't see it:

| | Where |
|---|---|
| The twins | `app/md/**` route handlers |
| The pages that advertise one (`<link rel="alternate" type="text/markdown">`) | `lib/seo.ts` |
| The rewrite rule above | Cloudflare dashboard |

The first two share **one list**, [`lib/markdown-routes.json`](../lib/markdown-routes.json)
(`pages` for exact paths, `prefixes` for dynamic ones like `/speakers/<slug>`). To add a
markdown twin:

1. Add the handler under `app/md/`.
2. Add its path to `lib/markdown-routes.json`.
3. Run `npm run md:rule` and paste the rule it prints into the dashboard (or just add the
   path to Rule 2's set).
4. Run `npm run md:check -- --live` to confirm the live site really negotiates it.

`npm run md:check` also runs automatically before `preview`, `deploy` and `upload`: it fails
if a handler has no entry in the list, or the list names a page with no handler. That covers
the repo half. Only `--live` can see the dashboard half, so run it after any rule change.

This exists because `/partner` got a twin a day after the rule was written and was left out
of it: pages advertised a markdown version that `Accept: text/markdown` couldn't reach.

(The list is the one the old `proxy.ts` had as `MARKDOWN_ROUTES`, before the rewrite moved to
Cloudflare to keep the Worker under its size limit.)

## Verify (after deploy)

```bash
# markdown variant
curl -s  https://devfest.gdgchennai.in/agenda -H 'Accept: text/markdown' | head
curl -sI https://devfest.gdgchennai.in/agenda -H 'Accept: text/markdown' | grep -i 'content-type\|vary'
# normal request still gets HTML
curl -sI https://devfest.gdgchennai.in/agenda | grep -i 'content-type'
```
