import { PostEventDashboard } from "@/components/analysis/PostEventDashboard";
import agenda from "@/content/agenda.json";
import { agendaSchema } from "@/lib/schemas";

export const dynamic = "force-static";
export const metadata = {
  title: "Post-event analysis",
  description: "Attendance highlights, full and empty halls, and event occupancy timelines.",
  robots: { index: false, follow: false },
};

/** Static shell contains no private data. Database reads require a separate authenticated request. */
export default function AnalysisPage() {
  return <PostEventDashboard agenda={agendaSchema.parse(agenda)} />;
}
