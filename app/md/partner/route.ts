import { partnerMarkdown, markdownResponse } from "@/lib/markdown";

export function GET() {
  return markdownResponse(partnerMarkdown(), "/partner");
}
