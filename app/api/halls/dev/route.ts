import { hallTestIdentities } from "@/lib/hall-test-identities";
import {
  hallEnvironment,
  localHallRequest,
  sameOrigin,
} from "@/lib/hall-access";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const env = await hallEnvironment();
  if (!localHallRequest(request, env))
    return new Response(null, { status: 404 });
  if (!(await sameOrigin(request))) return new Response(null, { status: 403 });
  const { role } = (await request.json()) as { role?: string };
  if (
    !hallTestIdentities.some((identity) => identity.value === role) &&
    role !== "unassigned"
  )
    return new Response(null, { status: 400 });
  return Response.json(
    { role },
    {
      headers: {
        "Set-Cookie": `hall-dev=${role}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
        "Cache-Control": "no-store",
      },
    },
  );
}
