import { creatorsMarkdown, markdownResponse } from "@/lib/markdown";

export function GET() {
  return markdownResponse(creatorsMarkdown(), "/creators");
}
