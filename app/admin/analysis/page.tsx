import { PostEventDashboard } from "@/components/analysis/PostEventDashboard";
import agenda from "@/content/agenda.json";
import { agendaSchema } from "@/lib/schemas";

export const dynamic = "force-static";
export const metadata = {
  title: "Post-event analysis",
  description: "Historical track occupancy, event timing and reporting coverage.",
  robots: { index: false, follow: false },
};

/** Static shell contains no private data. Database reads require a separate authenticated request. */
export default function AnalysisPage() {
  return <PostEventDashboard agenda={agendaSchema.parse(agenda)} />;
}
