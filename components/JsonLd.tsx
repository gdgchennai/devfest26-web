import { jsonLdString } from "@/lib/seo";

/** One JSON-LD `<script>` node. Escapes `<` so a payload cannot break out of the tag. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
