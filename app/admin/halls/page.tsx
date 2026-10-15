import { HallAdmin } from "@/components/halls/HallAdmin";
import agenda from "@/content/agenda.json";
import speakers from "@/content/speakers.json";
import { agendaSchema, speakerSchema } from "@/lib/schemas";
export const dynamic = "force-static";
export const metadata = {
  title: "Hall control",
  robots: { index: false, follow: false },
};
export default function HallAdminPage() {
  return (
    <HallAdmin
      agenda={agendaSchema.parse(agenda)}
      speakers={speakers.map((s) => speakerSchema.parse(s))}
    />
  );
}
