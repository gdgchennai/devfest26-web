import { agendaMarkdown, markdownResponse } from "@/lib/markdown";

export function GET() {
  return markdownResponse(agendaMarkdown(), "/agenda");
}
