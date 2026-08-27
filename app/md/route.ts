import { homeMarkdown } from "@/lib/markdown";

export function GET() {
  return new Response(homeMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
  });
}
