import { agendaMarkdown } from "@/lib/markdown";

export function GET() {
  return new Response(agendaMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
  });
}
