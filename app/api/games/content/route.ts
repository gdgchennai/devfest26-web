import { NextResponse } from "next/server";
import {
  getPublicCrosswordPuzzles,
  getTechCards,
  getJigsawPhotos,
} from "@/lib/games-content";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") || "all";

  try {
    switch (kind) {
      case "crossword":
      case "crosswords":
        return NextResponse.json({
          kind: "crosswords",
          data: await getPublicCrosswordPuzzles(),
        });

      case "cards":
      case "memory":
        return NextResponse.json({
          kind: "cards",
          data: await getTechCards(),
        });

      case "photos":
      case "jigsaw":
        return NextResponse.json({
          kind: "photos",
          data: await getJigsawPhotos(),
        });

      case "all":
      default: {
        const [crosswords, cards, photos] = await Promise.all([
          getPublicCrosswordPuzzles(),
          getTechCards(),
          getJigsawPhotos(),
        ]);
        return NextResponse.json({
          crosswords,
          cards,
          photos,
        });
      }
    }
  } catch (error) {
    console.error("Failed to load games content:", error);
    return NextResponse.json(
      { error: "Failed to load game content" },
      { status: 500 },
    );
  }
}
