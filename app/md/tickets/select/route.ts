import { ticketsMarkdown, markdownResponse } from "@/lib/markdown";

export function GET() {
  return markdownResponse(ticketsMarkdown(), "/tickets/select");
}
