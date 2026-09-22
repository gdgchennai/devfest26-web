import { auth } from "@/auth";
import { saveGameScore, getGameLeaderboard, getUserGameScores } from "@/lib/leaderboard";
import { clearBoards, getBoard, parseBoard } from "@/lib/leaderboard-cache";
import { claimForUser, releaseClaim } from "@/lib/game-sessions";

export const runtime = "nodejs";

/**
 * GET is the same for everyone (no sign-in, nothing personal), so besides the per-isolate
 * cache in lib/leaderboard-cache.ts, `Cache-Control` lets browsers and any cache rule on the
 * zone hold it for a few seconds too. A player's own rank is `/api/games/scores/me`.
 */
const CACHE_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=10, s-maxage=30, stale-while-revalidate=60",
};

/**
 * GET ?gameId=all|jigsaw|crossword|memory|typing[&variant=…][&limit=…]
 *
 * Leaderboards are per board (`variant`, e.g. jigsaw "4" or "3s", memory "8", typing
 * "time-30"); see GAME_VARIANTS in lib/game-rules.ts. Leave it out for the first one.
 * `all` is the cross-game total and takes no variant.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const board = parseBoard(searchParams);
  if (!board.ok) return Response.json({ error: board.error }, { status: 400 });

  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50)) : 50;

  try {
    const rows = await getBoard(board.gameId, board.variant);
    return new Response(
      JSON.stringify({ gameId: board.gameId, variant: board.variant, leaderboard: rows.slice(0, limit) }),
      { headers: CACHE_HEADERS },
    );
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    return Response.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}

/**
 * POST { sessionId } → publish a finished run to the leaderboard.
 *
 * The body carries no score, time or moves: those were fixed by the server when
 * the run finished (see /api/games/session/finish), so there is nothing here for a
 * client to edit. This only binds that stored result to the signed-in user, once.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.uid) {
    return Response.json(
      { error: "unauthorized", message: "Authentication required to publish score to leaderboard." },
      { status: 401 },
    );
  }
  const userId = session.user.uid;

  const body = (await req.json().catch(() => null)) as { sessionId?: unknown } | null;
  if (!body || typeof body.sessionId !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const claim = await claimForUser(body.sessionId, userId);
  if (!claim.ok) {
    const status = claim.reason === "unknown_session" ? 404 : 409;
    const message =
      claim.reason === "already_published"
        ? "This run has already been published."
        : claim.reason === "not_finished"
          ? "This run was not finished."
          : "Unknown game session.";
    return Response.json({ error: claim.reason, message }, { status });
  }

  try {
    const { result } = claim;
    const record = await saveGameScore({
      id: body.sessionId,
      userId,
      gameId: result.gameId,
      score: result.score,
      timeMs: result.timeMs,
      moves: result.moves,
      levelData: result.levelData.slice(0, 500),
      variant: result.variant ?? "",
    });
    clearBoards();

    const updatedLeaderboard = await getGameLeaderboard(result.gameId, result.variant ?? "", 50);
    const userScores = await getUserGameScores(userId);

    return Response.json({ ok: true, record, leaderboard: updatedLeaderboard, userScores });
  } catch (error) {
    console.error("Failed to save score:", error);
    // Let the player try again instead of burning their run.
    await releaseClaim(body.sessionId);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
