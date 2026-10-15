import { getAllLiveHalls } from "@/lib/hall-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const halls = await getAllLiveHalls();
    return Response.json(
      { ok: true, halls, timestamp: Date.now() },
      {
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("Failed to fetch live halls:", error);
    return Response.json({ error: "Failed to fetch live halls" }, { status: 500 });
  }
}
