import { getCrosswordPuzzles } from "@/lib/games-content";
import {
  MAX_WPM,
  crosswordCheck,
  crosswordComplete,
  crosswordScore,
  jigsawScore,
  memoryScore,
  replayJigsaw,
  replayMemory,
  solutionLetters,
  typingStats,
  type GameResult,
} from "@/lib/game-rules";
import { finishSession, getSession, markBegun, spend, type GameSession } from "@/lib/game-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A run that has been open longer than this is not a run any more. */
const MAX_RUN_MS = 6 * 60 * 60 * 1000;
/** Time Attack must be finished inside its window; a little slack for the round trip. */
const TIME_EARLY_SLACK_MS = 1500;
const TIME_LATE_SLACK_MS = 4000;
/**
 * Fastest a human can plausibly finish, as a fixed part (take in the board, first
 * click) plus a per-move part. Without the fixed part a board that needs only a
 * few moves would have a floor below the 1s minimum time and could be blitzed.
 */
const jigsawMinMs = (moves: number) => 1500 + moves * 200;
const memoryMinMs = (attempts: number) => 2000 + attempts * 300;
const crosswordMinMs = (typedCells: number) => 3000 + typedCells * 100;

const MAX_HINTS = 60;
const MAX_CHECKS = 15;
const MAX_FINISH_ATTEMPTS = 40;
const MAX_GRID = 30;

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ error, ...extra }, { status });

type Body = Record<string, unknown>;

/**
 * Everything a run does after it starts, addressed by `sessionId`:
 *  - begin  (typing) start the clock on the first keystroke
 *  - hint   (crossword) reveal one letter — counted against the score here
 *  - check  (crossword) which filled cells are right — capped
 *  - finish send the evidence (moves / flips / grid / typed text); the server
 *           scores it and hands back the result. That result — never anything the
 *           browser computed — is what later gets published.
 */
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.sessionId !== "string") return bad("invalid_body");

  const session = await getSession(body.sessionId);
  if (!session) return bad("unknown_session", 404);

  switch (action) {
    case "begin":
      return begin(session);
    case "hint":
      return hint(session, body);
    case "check":
      return check(session, body);
    case "finish":
      return finish(session, body);
    default:
      return bad("unknown_action", 404);
  }
}

async function begin(s: GameSession) {
  if (s.gameId !== "typing") return bad("not_applicable");
  if (s.finishedAt !== null) return bad("already_finished", 409);
  // Idempotent: the clock started the first time; a repeat keeps that time.
  await markBegun(s.id);
  return Response.json({ ok: true });
}

async function crosswordFor(s: GameSession) {
  if (s.gameId !== "crossword") return null;
  const puzzles = await getCrosswordPuzzles();
  return puzzles.find((p) => p.id === s.state.puzzleId) ?? null;
}

async function hint(s: GameSession, body: Body) {
  const puzzle = await crosswordFor(s);
  if (!puzzle) return bad("not_applicable");
  if (s.finishedAt !== null) return bad("already_finished", 409);
  const { row, col } = body;
  if (!Number.isInteger(row) || !Number.isInteger(col)) return bad("invalid_cell");
  const letter = solutionLetters(puzzle).get(`${row},${col}`);
  if (!letter) return bad("invalid_cell");

  const hints = await spend(s.id, "hints", MAX_HINTS);
  if (hints === null) return bad("hint_limit", 429);
  return Response.json({ letter, hints });
}

async function check(s: GameSession, body: Body) {
  const puzzle = await crosswordFor(s);
  if (!puzzle) return bad("not_applicable");
  if (s.finishedAt !== null) return bad("already_finished", 409);
  if (!Array.isArray(body.grid) || body.grid.length > MAX_GRID) return bad("invalid_grid");

  const checks = await spend(s.id, "checks", MAX_CHECKS);
  if (checks === null) return bad("check_limit", 429, { checksLeft: 0 });
  return Response.json({ results: crosswordCheck(puzzle, body.grid), checksLeft: MAX_CHECKS - checks });
}

async function finish(s: GameSession, body: Body) {
  if (s.finishedAt !== null) return bad("already_finished", 409);
  if (s.begunAt === null) return bad("not_begun");

  const now = Date.now();
  const elapsed = now - s.begunAt;
  if (elapsed > MAX_RUN_MS) return bad("expired");
  const timeMs = Math.max(1000, elapsed);
  const evidence = (body.evidence && typeof body.evidence === "object" ? body.evidence : {}) as Body;

  const scored = await score(s, evidence, timeMs);
  if (!scored.ok) return bad("invalid_run", 400, { reason: scored.reason });

  // Once: a second finish (or a concurrent one) loses here and gets `already_finished`.
  if (!(await finishSession(s.id, scored.result, now))) return bad("already_finished", 409);
  return Response.json({ ok: true, sessionId: s.id, result: scored.result });
}

type Scored = { ok: true; result: GameResult } | { ok: false; reason: string };

async function score(s: GameSession, evidence: Body, timeMs: number): Promise<Scored> {
  switch (s.gameId) {
    case "jigsaw": {
      const size = s.config.size as number;
      const slide = s.config.slide === true;
      const replay = replayJigsaw(s.state.tiles as number[], size, slide, evidence.moves);
      if (!replay.ok) return replay;
      if (timeMs < jigsawMinMs(replay.moves)) return { ok: false, reason: "too_fast" };
      return {
        ok: true,
        result: {
          gameId: "jigsaw",
          gameTitle: "Jigsaw Puzzle",
          score: jigsawScore(size, timeMs, replay.moves),
          timeMs,
          moves: replay.moves,
          levelData: `${size}x${size} Grid`,
        },
      };
    }

    case "memory": {
      const layout = s.state.layout as string[];
      const replay = replayMemory(layout, evidence.flips);
      if (!replay.ok) return replay;
      if (timeMs < memoryMinMs(replay.moves)) return { ok: false, reason: "too_fast" };
      const pairs = layout.length / 2;
      return {
        ok: true,
        result: {
          gameId: "memory",
          gameTitle: "Tech Memory Matrix",
          score: memoryScore(replay.points, pairs, timeMs),
          timeMs,
          moves: replay.moves,
          levelData: `${pairs * 2} Cards • Max Streak ${replay.maxStreak}x`,
        },
      };
    }

    case "crossword": {
      const puzzle = await crosswordFor(s);
      if (!puzzle) return { ok: false, reason: "unknown_puzzle" };
      if (!Array.isArray(evidence.grid) || evidence.grid.length > MAX_GRID) return { ok: false, reason: "invalid_grid" };
      if (!crosswordComplete(puzzle, evidence.grid)) {
        // Wrong answers are normal play (the client sends the grid to find out), but bounded.
        if ((await spend(s.id, "attempts", MAX_FINISH_ATTEMPTS)) === null) return { ok: false, reason: "too_many_attempts" };
        return { ok: false, reason: "incorrect" };
      }
      // Hints are typed in by the player, so they don't count as filling time.
      const cells = solutionLetters(puzzle).size;
      if (timeMs < crosswordMinMs(Math.max(0, cells - s.hints))) return { ok: false, reason: "too_fast" };
      return {
        ok: true,
        result: {
          gameId: "crossword",
          gameTitle: `Tech Crossword: ${puzzle.title}`,
          score: crosswordScore(timeMs, s.hints),
          timeMs,
          moves: s.hints,
          levelData: `${puzzle.title} • ${puzzle.clues.length} Clues`,
        },
      };
    }

    case "typing": {
      const text = s.state.text as string;
      const mode = s.config.mode as "time" | "words";
      const limitMs = (s.config.timeLimit as number) * 1000;
      if (typeof evidence.typed !== "string") return { ok: false, reason: "invalid_text" };
      // Same normalisation the game applies as you type.
      const typed = evidence.typed.toLowerCase().replace(/[^a-z\s]/g, "");
      if (typed.length === 0 || typed.length > text.length) return { ok: false, reason: "invalid_text" };

      if (mode === "words") {
        if (typed.length !== text.length) return { ok: false, reason: "not_finished" };
      } else {
        if (timeMs < limitMs - TIME_EARLY_SLACK_MS) return { ok: false, reason: "too_fast" };
        if (timeMs > limitMs + TIME_LATE_SLACK_MS) return { ok: false, reason: "too_late" };
      }

      const stats = typingStats(text, typed, timeMs);
      if (stats.wpm > MAX_WPM) return { ok: false, reason: "wpm_too_high" };
      return {
        ok: true,
        result: {
          gameId: "typing",
          gameTitle: "Speed Typer",
          score: stats.score,
          timeMs,
          moves: typed.length,
          levelData: `${stats.wpm} WPM | ${stats.accuracy}% ACC`,
        },
      };
    }
  }
}
