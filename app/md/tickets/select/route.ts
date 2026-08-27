import { ticketsMarkdown } from "@/lib/markdown";

export function GET() {
  return new Response(ticketsMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
  });
}
