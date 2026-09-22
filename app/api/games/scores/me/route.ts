import { auth } from "@/auth";
import { BOARD_DEPTH, getBoard, parseBoard } from "@/lib/leaderboard-cache";

export const runtime = "nodejs";

/**
 * GET ?gameId=…[&variant=…] → where the signed-in player stands on that board.
 *
 * `{ rank, entry, total }`: `entry` is their row (the same shape the list uses), `rank` their
 * place, `total` how many players the board has. All three are null when they have no score
 * there, or aren't signed in — or, on a board with more than BOARD_DEPTH players, are ranked
 * below the depth we read (`total` is null then, since the count isn't known).
 *
 * Separate from the public list on purpose: that one is identical for everyone and cacheable;
 * this one is per person, so it is never cached.
 */
export async function GET(req: Request) {
  const board = parseBoard(new URL(req.url).searchParams);
  if (!board.ok) return Response.json({ error: board.error }, { status: 400 });

  const none = { rank: null, entry: null, total: null };
  const headers = { "Cache-Control": "private, no-store" };

  const session = await auth().catch(() => null);
  const userId = session?.user?.uid;
  if (!userId) return Response.json(none, { headers });

  try {
    const rows = await getBoard(board.gameId, board.variant);
    const index = rows.findIndex((row) => row.userId === userId);
    const capped = rows.length >= BOARD_DEPTH;
    return Response.json(
      {
        rank: index === -1 ? null : index + 1,
        entry: index === -1 ? null : rows[index],
        total: capped ? null : rows.length,
      },
      { headers },
    );
  } catch (error) {
    console.error("Failed to fetch player rank:", error);
    return Response.json(none, { headers });
  }
}
