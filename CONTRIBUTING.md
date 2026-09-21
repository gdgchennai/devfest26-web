# Contributing to DevFest Chennai 2026

Thanks for your interest in contributing to the DevFest Chennai 2026 website.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the site running locally.

This project is built with Next.js, React, TypeScript, Tailwind CSS, and GSAP.

## Making changes

1. Fork the repo and create a branch from `main` for your change.
2. Keep changes focused — one feature or fix per pull request.
3. Typecheck and lint before committing:

   ```bash
   npx tsc --noEmit
   npm run lint
   ```

   `tsc` should be clean. `lint` has a known set of older errors in `components/motion/*`,
   `TicketsList`, `HamburgerMenu` and a couple of others: don't add to it, and leave
   unrelated files alone.

4. Make sure the site builds successfully:

   ```bash
   npm run build
   ```

5. If your change is visual (layout, animation, styling), verify it in the browser at a few viewport sizes, including mobile.

## Commit messages

Write clear, descriptive commit messages that explain the intent of the change, not just what was changed.
Commit under your own git identity; don't add AI co-author trailers or tool names to commit messages or PR text.

## Using an AI coding tool

Claude Code, Cursor and Antigravity all work here and read the same instructions from
[`AGENTS.md`](AGENTS.md). Setup for each is in [`docs/ai-tools.md`](docs/ai-tools.md). Whoever
wrote the code, the bar is the same: you've run it, looked at it (desktop and phone width, and
`?lite=1` for anything visual), and you can explain the diff.

## Submitting a pull request

- Open a PR against `main` in [gdgchennai/devfest26-web](https://github.com/gdgchennai/devfest26-web).
- Describe what the change does and why.
- Link any related issue.

## Reporting issues

If you find a bug or have a suggestion, please open an issue with steps to reproduce (for bugs) or a clear description of the proposal (for suggestions).

## Code of conduct

Be respectful and constructive. This project is maintained by and for the GDG Chennai community.
