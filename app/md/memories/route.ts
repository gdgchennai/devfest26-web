import { memoriesMarkdown, markdownResponse } from "@/lib/markdown";

export async function GET() {
  return markdownResponse(await memoriesMarkdown(), "/memories");
}
