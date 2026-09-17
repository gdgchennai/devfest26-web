import { auth } from "@/auth";
import {
  saveGameScore,
  getGameLeaderboard,
  getOverallLeaderboard,
  getUserGameScores,
} from "@/lib/leaderboard";

export const runtime = "nodejs";

const VALID_GAME_IDS = new Set(["jigsaw", "crossword", "memory", "typing", "all"]);

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
    } else if (VALID_GAME_IDS.has(gameId)) {
      leaderboard = await getGameLeaderboard(gameId, limit);
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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.uid) {
    return Response.json(
      { error: "unauthorized", message: "Authentication required to publish score to leaderboard." },
      { status: 401 },
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const { gameId, score, timeMs, moves, levelData } = body as {
      gameId?: unknown;
      score?: unknown;
      timeMs?: unknown;
      moves?: unknown;
      levelData?: unknown;
    };

    if (typeof gameId !== "string" || !["jigsaw", "crossword", "memory", "typing"].includes(gameId)) {
      return Response.json({ error: "invalid_game_id" }, { status: 400 });
    }

    const parsedScore = Number(score);
    const parsedTimeMs = Number(timeMs);
    const parsedMoves = moves !== undefined ? Number(moves) : 0;

    if (isNaN(parsedScore) || parsedScore < 0 || isNaN(parsedTimeMs) || parsedTimeMs <= 0) {
      return Response.json({ error: "invalid_score_metrics" }, { status: 400 });
    }

    const record = await saveGameScore({
      userId: session.user.uid,
      gameId,
      score: parsedScore,
      timeMs: parsedTimeMs,
      moves: parsedMoves,
      levelData: typeof levelData === "string" ? levelData.slice(0, 500) : undefined,
    });

    const updatedLeaderboard = await getGameLeaderboard(gameId, 50);
    const userScores = await getUserGameScores(session.user.uid);

    return Response.json({
      ok: true,
      record,
      leaderboard: updatedLeaderboard,
      userScores,
    });
  } catch (error) {
    console.error("Failed to save score:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
