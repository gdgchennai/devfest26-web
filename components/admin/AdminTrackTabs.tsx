"use client";

import { useState } from "react";
import { AgendaTrackTabs, type AgendaTrackTab } from "@/components/AgendaTrackTabs";

/** One switchable panel per track — the same strip the agenda uses, with the
 *  panels rendered on the server and passed in, so only the active one shows. */
export function AdminTrackTabs({
  tabs,
  panels,
}: {
  tabs: AgendaTrackTab[];
  panels: Record<string, React.ReactNode>;
}) {
  const [active, setActive] = useState(tabs[0]?.slug ?? "");
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.slug === active));

  return (
    <div className="mt-6">
      <AgendaTrackTabs
        tabs={tabs}
        activeSlug={active}
        onSelect={setActive}
        idPrefix="admin-track"
        panelId="admin-track-panel"
      />
      <div id="admin-track-panel" role="tabpanel" aria-labelledby={`admin-track-tab-${activeIndex}`} className="mt-4">
        {panels[active]}
      </div>
    </div>
  );
}
