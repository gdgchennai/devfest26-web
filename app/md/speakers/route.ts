import { speakersMarkdown } from "@/lib/markdown";

export function GET() {
  return new Response(speakersMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
  });
}
