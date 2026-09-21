# Working on this repo with AI coding tools

People here use **Claude Code**, **Cursor** and **Google Antigravity** (and others).
The project is set up so they all get the *same* instructions from *one* place, and
nobody has to maintain a per-tool copy that drifts.

> **The rule:** put project guidance in [`AGENTS.md`](../AGENTS.md) (or a doc it
> links to). Don't add it to a tool-specific file. `AGENTS.md` is a plain-Markdown
> convention that all three tools read.

## At a glance

| | Claude Code | Cursor | Antigravity |
|---|---|---|---|
| **Reads project instructions from** | `CLAUDE.md`, which imports `AGENTS.md` (`@AGENTS.md`) | `AGENTS.md` (root and nested) | `AGENTS.md` (IDE 1.20.5+) and/or `GEMINI.md` |
| **Auto-loads `.claude/skills/`** | Yes | Yes (compatibility path) | **No** — read the two project skills by path (below) |
| **Project rule files** | — | `.cursor/rules/*.mdc` (not used here, see below) | `.agents/rules/*.md` (not used here, see below) |

Everything below is sourced from each tool's own docs (links at the end). These
tools change quickly; if something here stops matching your tool, trust the tool's
docs and please fix this page.

## First run (any tool)

```bash
npm install                  # required: AGENTS.md points at node_modules/next/dist/docs/
cp .env.example .env.local   # see docs/environment.md — the site runs without most values
npm run dev                  # http://localhost:3000
```

Then open the repo in your tool and confirm it has picked up `AGENTS.md` — ask it
*"What does this project say I must check before saying I'm done?"* It should answer
with typecheck, lint baseline, browser check at desktop **and** phone width, and
`?lite=1`. If it doesn't, see "If your tool isn't picking it up".

## Claude Code

- Reads [`CLAUDE.md`](../CLAUDE.md), which is one line — `@AGENTS.md` — importing the
  shared file. Don't add content to `CLAUDE.md`.
- Auto-loads the skills in [`.claude/skills/`](../.claude/skills) when a task matches
  their descriptions.
- [`.claude/launch.json`](../.claude/launch.json) tells the Claude desktop app how to
  start the dev server for its built-in browser. Other tools ignore it.

## Cursor

- Reads `AGENTS.md` from the repo root natively — nothing to configure. Nested
  `AGENTS.md` files (if a folder ever gets its own) are combined with the root one.
- Loads `.claude/skills/` as skills too, so the GSAP, three.js and project skills
  work without copying anything.
- **`.cursor/` is git-ignored** (see `.gitignore`), so your personal Cursor settings
  and MCP config never get committed. That also means project `.mdc` rules can't be
  committed unless the ignore is loosened. We deliberately don't use them:
  `AGENTS.md` is the shared source, and a second copy in `.mdc` would drift. If a
  scoped rule is ever worth having (e.g. "only when editing `components/motion/**`"),
  ignore `.cursor/*` but not `.cursor/rules/`, keep it small (Cursor advises under
  500 lines) and point it at `AGENTS.md` rather than restating it.
- Cursor ignores plain `.md` files in `.cursor/rules/`; rules must be `.mdc` with
  `description` / `globs` / `alwaysApply` frontmatter.

## Google Antigravity

- Reads `AGENTS.md` from the workspace root from **IDE 1.20.5**. On an older build,
  update it. It also reads `GEMINI.md`; we don't ship one because Google hasn't
  documented which wins when both exist, and one file is easier to keep true.
- **Skills:** Antigravity looks for project skills in `.agents/skills/` (and the older
  `.agent/skills/`), not `.claude/skills/`. So it won't auto-load our skills. That's
  fine — they're ordinary Markdown, and `AGENTS.md` links the two that are specific
  to this project:
  - [`.claude/skills/hallway/SKILL.md`](../.claude/skills/hallway/SKILL.md) — the
    pinned scroll hallway on the homepage and `/memories`
  - [`.claude/skills/rolling-text/SKILL.md`](../.claude/skills/rolling-text/SKILL.md)
    — the rolling-text hover effect on the CTAs

  Tell the agent to read them before it touches those areas. (The `gsap-*` and
  `threejs-*` skills are general API references for those libraries; the agent can
  read them the same way, or use its own knowledge.)
- **Want them auto-loaded anyway?** Make `.agents/skills` point at the same folder
  locally, and keep that out of git via `.git/info/exclude` (your machine only, not
  a repo change):

  ```bash
  # macOS / Linux
  mkdir -p .agents && ln -s ../.claude/skills .agents/skills
  # Windows (PowerShell, no admin needed)
  New-Item -ItemType Directory -Force .agents | Out-Null
  New-Item -ItemType Junction -Path .agents\skills -Target .claude\skills
  # then
  echo ".agents/" >> .git/info/exclude
  ```
- Antigravity rule files (`.agents/rules/`) are capped at **12,000 characters each**.
  `AGENTS.md` is about 7,000, which is one reason it stays short and links out.

## If your tool isn't picking it up

1. It may not support `AGENTS.md` (most current agent tools do). Point it at the file
   explicitly — paste "Read `AGENTS.md` and follow it" into its instructions, or
   attach the file to the chat.
2. Run `npm install`, so `node_modules/next/dist/docs/` exists.
3. Confirm you opened the **repo root**, not `app/` or a subfolder — `AGENTS.md` is
   read from the workspace root.

## What agents get wrong here (and where the guardrails are)

These are the mistakes that keep recurring, all covered in `AGENTS.md`:

| Mistake | Why it hurts |
|---|---|
| Writing Next.js from memory | This Next 16 has breaking changes; the docs ship in `node_modules/next/dist/docs/` |
| `runtime = "edge"` on a route | OpenNext on Cloudflare can't run it — the deploy fails |
| Adding `middleware.ts` / a big dependency | The free-plan Worker cap is 3 MiB gzipped; middleware alone is ~1.2 MiB |
| Motion with no lite path | Reduced-motion visitors are lite by default; the page must work without it |
| `Lenis` used without `?.` | It's `null` in lite mode |
| Trusting a client-sent game score | Scores are computed on the server — see [`games.md`](./games.md) |
| `bg-[var(--blue)]`, hex, `font-mono` | Use the Tailwind v4 theme tokens |
| "Fixing" unrelated lint errors | There is a known baseline; keep diffs focused |
| Declaring both `backdrop-filter` prefixes | The build keeps only the prefixed one; the blur silently vanishes |

## Reviewing AI-written changes

Same bar as any PR ([`CONTRIBUTING.md`](../CONTRIBUTING.md)), plus:

- **Watch it run.** For anything visual or animated, load it in a browser at desktop
  and phone width and with `?lite=1`. Type-checking can't tell you it looks right.
- **Read the diff for drive-by edits.** Agents like to "tidy" neighbouring code.
- **Check docs moved with the code** — a new env var, route or constraint belongs in
  `docs/` and, if it's a rule agents must follow, in `AGENTS.md`.
- **No secrets** in code, logs or screenshots: `.env*` and `.dev.vars` stay local.
- **Commits** carry your own git identity and no AI attribution or tool names.

## Keeping this working

- Adding a rule or gotcha? Edit **`AGENTS.md`** (keep it under ~10,000 characters;
  put long explanations in `docs/` and link).
- Adding a skill? Put it in `.claude/skills/<name>/SKILL.md` (folder name = the
  `name:` in its frontmatter, plus a `description:` saying when to use it). Cursor and
  Claude Code load it automatically; add a row to `AGENTS.md`'s "Where to read more"
  table so Antigravity users find it too.
- Don't create `GEMINI.md`, `.cursorrules` or per-tool copies of `AGENTS.md`.

## Sources

Checked September 2026.

- Cursor — [Rules](https://cursor.com/docs/rules) (`AGENTS.md`, `.cursor/rules/*.mdc`,
  frontmatter, the 500-line guidance) and [Agent Skills](https://cursor.com/docs/skills)
  (`.agents/skills`, `.cursor/skills`, `.claude/skills` compatibility)
- Antigravity — [Rules & Workflows](https://antigravity.google/docs/rules-workflows/)
  (`.agents/rules`, `~/.gemini/GEMINI.md`, the 12,000-character cap) and
  [Skills](https://antigravity.google/docs/skills/); `AGENTS.md` support from IDE 1.20.5
  is from Google's changelog as reported in
  [this guide](https://thepromptshelf.dev/blog/google-antigravity-agents-md-rules-guide-2026/),
  and skill locations are from
  [Where does Antigravity look for Agent Skills?](https://atamel.dev/posts/2026/07-01_where_agy_agent_skills/)
