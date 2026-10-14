import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth } from "@/auth";
import { currentAdminUser } from "@/lib/admin";
import type { HallActor } from "@/lib/hall-model";

export async function hallEnvironment() {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}
export function localHallRequest(request: Request, env: CloudflareEnv) {
  return (
    process.env.NEXT_PUBLIC_HALL_ISOLATED === "1" &&
    env.HALL_LOCAL_TEST === "1" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(
        `http://${request.headers.get("host") ?? new URL(request.url).host}`,
      ).hostname,
    )
  );
}
export async function hallActor(request: Request): Promise<HallActor | null> {
  const env = await hallEnvironment();
  if (localHallRequest(request, env)) {
    const role = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)hall-dev=([^;]+)/)?.[1];
    const roles = ["organizer", "lead-tech", "lead-deep", "unassigned"];
    if (role && roles.includes(role))
      return { id: `dev:${role}`, organizer: role === "organizer" };
    return null;
  }
  // An isolated bundle without the runtime opt-in is deliberately anonymous.
  if (process.env.NEXT_PUBLIC_HALL_ISOLATED === "1") return null;
  const session = await auth();
  if (!session?.user?.uid) return null;
  return {
    id: session.user.uid,
    organizer: !!(await currentAdminUser(session.user.uid)),
  };
}
export async function hallService(path: string, data?: unknown) {
  const env = await hallEnvironment();
  if (!env.HALL_CONTROL)
    return Response.json(
      { error: "Hall live is not configured" },
      { status: 503 },
    );
  return env.HALL_CONTROL.fetch(
    new Request(
      `https://hall.internal${path}`,
      data === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(data),
          },
    ),
  );
}
export async function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (origin === `https://${host}`) return true;
  // OpenNext models the incoming socket as TLS even in loopback Wrangler.
  // Permit HTTP only with both isolated build and explicit local runtime gates.
  const env = await hallEnvironment();
  return localHallRequest(request, env) && origin === `http://${host}`;
}
