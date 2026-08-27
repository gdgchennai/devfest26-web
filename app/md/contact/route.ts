import { contactMarkdown } from "@/lib/markdown";

export function GET() {
  return new Response(contactMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
  });
}
