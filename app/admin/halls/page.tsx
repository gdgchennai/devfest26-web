import { HallAdmin } from "@/components/halls/HallAdmin";
import agenda from "@/content/agenda.json";
import { agendaSchema } from "@/lib/schemas";
export const dynamic = "force-static";
export const metadata = {
  title: "Hall control",
  robots: { index: false, follow: false },
};
export default function HallAdminPage() {
  return <HallAdmin agenda={agendaSchema.parse(agenda)} />;
}
