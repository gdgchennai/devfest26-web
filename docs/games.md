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

Because publishing sends only a session id, a run played before signing in still
works: the id waits in `localStorage` (`devfest_pending_score`) until after OAuth.

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
