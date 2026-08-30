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
  http.request.uri.path in {"/agenda" "/speakers" "/tickets" "/tickets/select"}
  or (starts_with(http.request.uri.path, "/speakers/") and http.request.uri.path ne "/speakers/")
)
```

*Then* — Path → Rewrite to → **Dynamic**: `concat("/md", http.request.uri.path)`

Leave **Query** unchanged on both. Keep the route list in sync with the
`app/md/**` handlers (it's the same list the old `proxy.ts` had as
`MARKDOWN_ROUTES`).

## Verify (after deploy)

```bash
# markdown variant
curl -s  https://devfest.gdgchennai.in/agenda -H 'Accept: text/markdown' | head
curl -sI https://devfest.gdgchennai.in/agenda -H 'Accept: text/markdown' | grep -i 'content-type\|vary'
# normal request still gets HTML
curl -sI https://devfest.gdgchennai.in/agenda | grep -i 'content-type'
```
