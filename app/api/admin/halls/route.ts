import {
  hallActor,
  hallService,
  hallEnvironment,
  localHallRequest,
  sameOrigin,
} from "@/lib/hall-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const actor = await hallActor(request);
  if (!actor)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  return hallService("/access", actor);
}
export async function POST(request: Request) {
  if (!(await sameOrigin(request)))
    return Response.json({ error: "Origin rejected" }, { status: 403 });
  const actor = await hallActor(request);
  if (!actor)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.text();
  if (body.length > 16384)
    return Response.json({ error: "Payload too large" }, { status: 413 });
  try {
    const env = await hallEnvironment();
    return hallService("/write", {
      actor,
      mutation: JSON.parse(body),
      failPublication:
        localHallRequest(request, env) &&
        request.headers.get("x-hall-test-fail-publication") === "1",
    });
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
