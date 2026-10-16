import { hallService } from "@/lib/hall-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return hallService("/snapshot");
}
