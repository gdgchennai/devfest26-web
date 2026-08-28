import { memoriesMarkdown } from "@/lib/markdown";

export function GET() {
  return new Response(memoriesMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
  });
}
