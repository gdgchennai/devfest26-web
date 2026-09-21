import { auth } from "@/auth";
import {
  saveGameScore,
  getGameLeaderboard,
  getOverallLeaderboard,
  getUserGameScores,
} from "@/lib/leaderboard";
import { claimForUser, releaseClaim } from "@/lib/game-sessions";
import { GAME_IDS, defaultVariant, isVariant, type GameId } from "@/lib/game-rules";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId") || "all";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50)) : 50;

  const session = await auth().catch(() => null);
  const currentUserId = session?.user?.uid;

  try {
    let leaderboard: unknown[] = [];
    let overallLeaderboard: unknown[] = [];

    if (gameId === "all") {
      overallLeaderboard = await getOverallLeaderboard(limit);
    } else if (GAME_IDS.includes(gameId as GameId)) {
      // Leaderboards are per board (grid size, card count, typing mode…); default to the first.
      const variant = searchParams.get("variant") ?? defaultVariant(gameId as GameId);
      if (!isVariant(gameId as GameId, variant)) return Response.json({ error: "Invalid variant" }, { status: 400 });
      leaderboard = await getGameLeaderboard(gameId, variant, limit);
    } else {
      return Response.json({ error: "Invalid gameId" }, { status: 400 });
    }

    let userScores: unknown[] = [];
    if (currentUserId) {
      userScores = await getUserGameScores(currentUserId);
    }

    return Response.json({
      gameId,
      leaderboard: gameId === "all" ? overallLeaderboard : leaderboard,
      userScores,
      authenticated: !!currentUserId,
      currentUserId: currentUserId ?? null,
    });
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
