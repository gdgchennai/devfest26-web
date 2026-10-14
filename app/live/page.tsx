import { HallLive } from "@/components/halls/HallLive";
import { agendaSchema, speakerSchema } from "@/lib/schemas";
import agenda from "@/content/agenda.json";
import speakers from "@/content/speakers.json";
import { pageMetadata } from "@/lib/seo";
export const dynamic = "force-static";
export const metadata = pageMetadata({
  title: "Live at DevFest",
  description: "Live track occupancy and sessions at DevFest Chennai.",
  path: "/live",
});
export default function LivePage() {
  return (
    <HallLive
      agenda={agendaSchema.parse(agenda)}
      speakers={speakers.map((s) => speakerSchema.parse(s))}
    />
  );
}
