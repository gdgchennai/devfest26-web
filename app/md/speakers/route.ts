import { speakersMarkdown, markdownResponse } from "@/lib/markdown";

export async function GET() {
  return markdownResponse(await speakersMarkdown(), "/speakers");
}
