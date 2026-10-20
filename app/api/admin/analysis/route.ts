import { requireAccessApi } from "@/lib/admin";
import { getDb } from "@/lib/db";
import agendaFile from "@/content/agenda.json";
import { agendaSchema } from "@/lib/schemas";
import { parseAnalysisData } from "@/lib/post-event-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Explicit, read-only refresh. The page never calls this endpoint on mount. */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
  try {
    const access = await requireAccessApi();
    if (access instanceof Response) return new Response(access.body, { status: access.status, headers: { ...Object.fromEntries(access.headers), ...headers } });
    if (!access.isSuper) return Response.json({ error: "Whole-event analysis requires super-admin access." }, { status: 403, headers });
    const db = await getDb();
    // A single consistent SELECT includes lifecycle context before the chosen range.
    const result = await db.prepare("SELECT a.revision, a.actor, a.changed_at, a.payload, COALESCE(NULLIF(u.display_name,''),NULLIF(u.name,''),a.actor) AS actor_name FROM hall_audit a LEFT JOIN users u ON u.id=a.actor ORDER BY a.revision LIMIT 50001").all<{ revision: number; actor: string; changed_at: number; payload: string; actor_name: string }>();
    if (result.results.length > 50_000) return Response.json({ error: "History exceeds 50,000 records. Import a bounded event-day export with lifecycle context; history was not truncated." }, { status: 413, headers });
    const data = parseAnalysisData({ audit: result.results, actors: Object.fromEntries(result.results.map((r) => [r.actor, r.actor_name])) }, agendaSchema.parse(agendaFile), "Hall audit database");
    return Response.json(data, { headers });
  } catch {
    return Response.json({ error: "Could not read hall history. Import an audit JSON export or retry when the database is available." }, { status: 503, headers });
  }
}
