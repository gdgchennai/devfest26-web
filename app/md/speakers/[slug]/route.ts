import { speakerMarkdown, markdownResponse } from "@/lib/markdown";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const markdown = speakerMarkdown(slug);
  if (!markdown) return new Response("Not found", { status: 404 });

  return markdownResponse(markdown, `/speakers/${slug}`);
}
