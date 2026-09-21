# Mini games: how scores are kept honest

The Jigsaw, Crossword, Memory and Speed Typer games score **on the server**. The
browser never sends a score, a time or a move count for anyone to edit — it sends
what the player *did*, and the server works out the rest.

## The flow

```
POST /api/games/session          start a run
      → server deals the game (tiles / card layout / puzzle / typing text),
        stores it in game_sessions, starts the clock, returns { sessionId, … }

  … play …  (Crossword: POST …/hint and …/check go through the server too;
             Typing: POST …/begin on the first keystroke starts the clock)

POST /api/games/session/finish   { sessionId, evidence }
      evidence = move log (Jigsaw) · flip log (Memory) · filled grid (Crossword) · typed text (Typing)
      → server replays it against what IT dealt, times it with ITS clock, scores it,
        stores the result once, returns { result }

POST /api/games/scores           { sessionId }        (signed in)
      → binds that stored result to the user, once, and writes the leaderboard row
        (its id is the session id, so a run can only ever land once)
```

Each result also carries a **variant** — the board it was played on (jigsaw grid size and
slide/swap, memory card count, typing mode and length; empty for Crossword), stamped by the server from the
config it dealt. Ids are in `GAME_VARIANTS` in `lib/game-rules.ts`.

Because publishing sends only a session id, a run played before signing in still
works: the id waits in `localStorage` (`devfest_pending_score`) until after OAuth.

## Leaderboards

Ranked **per board**, so a 3×3 jigsaw never competes with a 5×5, or 15 s of typing with 60 s.
Jigsaw and Speed Typer each have two modes with their own sizes — Jigsaw: Tile Swap / Classic
Slide × 3×3 / 4×4 / 5×5; Speed Typer: Time Attack (15 / 30 / 60 s) / Words Count (200 / 400 / 500) —
shown as a mode toggle with a size toggle under it. Memory (card count) gets one row.
`GET /api/games/scores?gameId=jigsaw&variant=4s` — leave `variant` out for the game's first
board (`GAME_VARIANTS[game][0]`); an unknown one is a 400. Crossword has one puzzle a day and
no variants. `gameId=all` is the cross-game total: the sum of each player's best score in
each game, whichever board it was on (the scoring already gives bigger boards bigger bases).

The page shows one ranked list of the **top 10** (`TOP_N` in `LeaderboardView.tsx`). It's the
same for everyone (no sign-in, nothing personal), so `lib/leaderboard-cache.ts` reads each
board once — to `BOARD_DEPTH` (1000) rows — and each Worker isolate keeps it for 20 s;
`Cache-Control` lets a browser or a zone cache rule do the same. A publish clears the
isolate's copy, so expect a rank to lag by up to about half a minute on another isolate.

A signed-in player's own place comes from a separate, never-cached
`GET /api/games/scores/me?gameId=…&variant=…` → `{ rank, entry, total }`, read from that same
cached board. The list is borderless (no card, no dividers): the top three rows are larger
with a gold / silver / bronze ring, and the player's own row gets the site's four-colour ring
(no glow), which wins over a medal ring. A player in the top 10 is marked in place; one below it
gets **one extra row** after a dotted gap, with their exact rank. Nobody else outside the top 10
is shown. Someone ranked below `BOARD_DEPTH` on a huge board gets no rank. The ring CSS is the
`.lb-*` block at the end of `app/globals.css`.

`game_scores.variant` is added lazily by `lib/leaderboard.ts` (like `attempt_number`), not by
a migration: it runs on every cold start, so a migration doing the same `ALTER` would fail
with a duplicate column. Older jigsaw and memory rows are given their board from
`level_data`; older typing rows (mode never recorded) and slide-mode jigsaw rows stay on
the empty / swap board.

## What stops what

| Attack | Why it fails |
|---|---|
| Edit `score` / `timeMs` / `moves` in the request | Those fields don't exist — the server computes them |
| Claim a faster time | Time is `finish − begin` on the server's clock |
| Send moves that don't solve the board | The replay must end solved, with every move legal |
| Replay a finished run / publish twice | `finish` and `publish` are single guarded `UPDATE`s; the second loses |
| Publish someone else's run | Session ids are unguessable, and the first claim binds the user |
| Crossword: read the answers from the page or the API | They never leave the server (`toPublicPuzzle`); hints, checks and the win test are server calls |
| Crossword: skip hints / brute-force letters | Hints are counted server-side; `check` is capped per run (15) and so are wrong finishes (40) |
| Typing: superhuman speed | Rejected above 300 WPM; the run must be finished within its time window |

Rules for each game live in one pure module, [`lib/game-rules.ts`](../lib/game-rules.ts),
so the server's replay and the scoring formulas can't drift from the game.

## What it can't stop

It stops edited numbers and replayed requests. It can't stop a **bot that plays
correctly** — an auto-typer under 300 WPM, a script that solves the jigsaw from the
tiles it was dealt, an LLM solving crossword clues. Doing that would need per-move
server round trips or proof-of-humanity checks. The plausibility floors (minimum
time per move, the WPM cap) just make the cheap versions obvious.

## Operations

- Table: `game_sessions` (created lazily, plus `migrations/0010_game_sessions.sql`).
  Rows older than 7 days are pruned opportunistically when a run starts.
- Local dev without a D1 binding falls back to in-memory sessions (per process).
  Production never does: a D1 error is thrown, because per-isolate memory would lose
  runs between Workers. Production must have D1, as it already does for scores.
- If the server can't be reached the games fall back to an **unranked practice**
  run and say so — except Crossword, which can't run without the answers.
- If you change a game's scoring or rules, change `lib/game-rules.ts` — the client
  and server both use it.
