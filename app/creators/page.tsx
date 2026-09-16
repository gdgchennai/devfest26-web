import type { Metadata } from "next";
import { siteConfig } from "@/site.config";
import { pageMetadata } from "@/lib/seo";
import { CreatorsContent } from "@/components/creators/CreatorsContent";

export const metadata: Metadata = pageMetadata({
  title: "An Invitation to Creators",
  description: `Join us at ${siteConfig.name} on 17 October 2026 at IIT Madras Research Park. We are inviting content creators to share their experiences and perspectives on AI and tech.`,
  path: "/creators",
});

export const dynamic = "force-static";

export default function CreatorsPage() {
  return <CreatorsContent />;
}
