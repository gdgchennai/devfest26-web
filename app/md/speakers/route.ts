import { speakersMarkdown, markdownResponse } from "@/lib/markdown";

export function GET() {
  return markdownResponse(speakersMarkdown(), "/speakers");
}
