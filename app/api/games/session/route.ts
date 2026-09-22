import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCrosswordPuzzles, getTechCards } from "@/lib/games-content";
import {
  JIGSAW_SIZES,
  MEMORY_PAIRS,
  TYPING_TIME_LIMITS,
  TYPING_WORD_LIMITS,
  dailyPuzzleIndex,
  generateJigsawTiles,
  generateMemoryLayout,
  mulberry32,
  toPublicPuzzle,
  typingWordCount,
  type GameId,
} from "@/lib/game-rules";
import { createSession } from "@/lib/game-sessions";
import { newGameSessionId } from "@/lib/id";
import { clientKey, rateLimited } from "@/lib/rate-limit";
import { generateTypingText } from "@/lib/typing-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A flood guard, deliberately loose: at the venue hundreds of attendees share one
 * wifi IP, and typing re-deals a run whenever the tab loses focus. Anything tighter
 * would quietly push real players into unranked practice. The scarce resource is
 * Gemini quota, and that gets its own, tighter limit below.
 */
const START_LIMIT = 1500;
const START_WINDOW_MS = 60_000;
/** Per client, per minute, before typing text comes from the local generator instead. */
const GEMINI_LIMIT = 10;

const oneOf = <T extends number | string>(allowed: readonly T[], v: unknown): T | null =>
  allowed.includes(v as T) ? (v as T) : null;

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

const bad = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * POST { gameId, config } → a new run. The server deals the game (tiles, card
 * layout, puzzle, typing text), remembers it, and returns what the browser needs
 * to render it plus a `sessionId` to send moves against. The run's clock starts
 * here (typing: on its first keystroke — see [action]/begin).
 */
export async function POST(req: Request) {
  if (rateLimited(`start:${clientKey(req)}`, START_LIMIT, START_WINDOW_MS)) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const body = (await req.json().catch(() => null)) as { gameId?: unknown; config?: Record<string, unknown> } | null;
  if (!body || typeof body !== "object") return bad("invalid_body");
  const config = body.config && typeof body.config === "object" ? body.config : {};
  const gameId = body.gameId as GameId;
  const id = newGameSessionId();
  const now = Date.now();

  try {
    switch (gameId) {
      case "jigsaw": {
        const size = oneOf(JIGSAW_SIZES, config.gridSize);
        if (!size) return bad("invalid_grid_size");
        const slide = config.slide === true;
        const tiles = generateJigsawTiles(size, slide, mulberry32(randomSeed()));
        await createSession({ id, gameId, config: { size, slide }, state: { tiles }, begunAt: now }, now);
        return Response.json({ sessionId: id, tiles });
      }

      case "memory": {
        const pairs = oneOf(MEMORY_PAIRS, config.pairs);
        if (!pairs) return bad("invalid_pairs");
        const pool = (await getTechCards()).map((c) => c.id);
        if (pool.length < pairs) return bad("not_enough_cards", 500);
        const layout = generateMemoryLayout(pool, pairs, mulberry32(randomSeed()));
        await createSession({ id, gameId, config: { pairs }, state: { layout }, begunAt: now }, now);
        return Response.json({ sessionId: id, layout });
      }

      case "crossword": {
        const puzzles = await getCrosswordPuzzles();
        const puzzle = puzzles[dailyPuzzleIndex(puzzles.length, now)] ?? puzzles[0];
        if (!puzzle) return bad("no_puzzle", 500);
        await createSession({ id, gameId, config: {}, state: { puzzleId: puzzle.id }, begunAt: now }, now);
        return Response.json({ sessionId: id, puzzle: toPublicPuzzle(puzzle) });
      }

      case "typing": {
        const mode = oneOf(["time", "words"] as const, config.mode);
        const timeLimit = oneOf(TYPING_TIME_LIMITS, config.timeLimit);
        const wordLimit = oneOf(TYPING_WORD_LIMITS, config.wordLimit);
        if (!mode || !timeLimit || !wordLimit) return bad("invalid_typing_config");
        const { env } = await getCloudflareContext({ async: true });
        // Over the Gemini budget: not an error, just deal the local paragraph instead.
        const overBudget = rateLimited(`gemini:${clientKey(req)}`, GEMINI_LIMIT, START_WINDOW_MS);
        const { text } = await generateTypingText(
          typingWordCount(mode, timeLimit, wordLimit),
          overBudget ? { ...env, GEMINI_API_KEY: undefined } : env,
        );
        // begunAt stays null: the clock starts on the first keystroke.
        await createSession({ id, gameId, config: { mode, timeLimit, wordLimit }, state: { text }, begunAt: null }, now);
        return Response.json({ sessionId: id, text });
      }

      default:
        return bad("unknown_game");
    }
  } catch (error) {
    console.error("Failed to start game session:", error);
    return bad("session_unavailable", 500);
  }
}
