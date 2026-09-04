import { agendaMarkdown, markdownResponse } from "@/lib/markdown";

export async function GET() {
  return markdownResponse(await agendaMarkdown(), "/agenda");
}
