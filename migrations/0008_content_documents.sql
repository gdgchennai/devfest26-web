-- Public site content (agenda, speakers, archive). Authoring stays in
-- content/*.json; `npm run content:sync` upserts those files into this table.
-- The Worker reads here at request time so a JSON edit + sync does not need a
-- full site rebuild. Applied with:
--   npx wrangler d1 migrations apply devfest-chennai-2026 --local
--   npx wrangler d1 migrations apply devfest-chennai-2026 --remote

CREATE TABLE content_documents (
  kind       TEXT PRIMARY KEY CHECK (kind IN ('agenda', 'speakers', 'archive')),
  payload    TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
