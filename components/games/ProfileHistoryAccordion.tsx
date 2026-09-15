"use client";

import { useState } from "react";
import type { GameScoreRecord } from "@/lib/leaderboard";

type ProfileHistoryAccordionProps = {
  gameScores: GameScoreRecord[];
};

export function ProfileHistoryAccordion({ gameScores }: ProfileHistoryAccordionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!gameScores || gameScores.length === 0) return null;

  function formatTime(ms: number) {
    if (!ms) return "—";
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}m ${sec}s`;
  }

  function formatDate(timestamp: number) {
    if (!timestamp) return "—";
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  // Get display details per game
  const GAME_METADATA: Record<string, { label: string; accentColor: string; bgDot: string }> = {
    jigsaw: { label: "Archive Jigsaw", accentColor: "text-[var(--blue-halftone)]", bgDot: "bg-[var(--blue)]" },
    crossword: { label: "Tech Crossword", accentColor: "text-[var(--yellow-pastel)]", bgDot: "bg-[var(--yellow)]" },
    memory: { label: "Memory Matrix", accentColor: "text-[var(--green-pastel)]", bgDot: "bg-[var(--green)]" },
  };

  return (
    <div className="mt-8 sm:mt-10 border border-paper/10 bg-surface rounded-2xl overflow-hidden shadow-sm">
      {/* Accordion Toggle Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-paper/[0.03] active:bg-paper/[0.05] transition-colors cursor-pointer text-left select-none"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--blue)]/10 text-[var(--blue-halftone)]">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-paper">
              Games History
            </h3>
            <p className="text-[10px] font-mono text-paper/40 mt-0.5">
              {gameScores.length} attempts completed across all mini-games
            </p>
          </div>
        </div>

        {/* Chevron Icon */}
        <span className={`text-paper/50 transition-transform duration-300 ${expanded ? "rotate-180" : "rotate-0"}`}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Accordion Expandable Body */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[500px] border-t border-paper/10 p-5" : "max-h-0 overflow-hidden"
        }`}
      >
        {expanded && (
          /* 
           * Scrollable container configured to show a maximum of exactly 5 cards at once.
           * Average card height is ~84px, so max-height is set to 430px (84px * 5 + margins)
           * to keep the viewport tight and require scrolling to view more attempts.
           */
          <div
            className="overflow-y-auto pr-1 scrollbar-none flex flex-col gap-2"
            style={{ overscrollBehavior: "contain", maxHeight: "430px" }}
          >
            {gameScores.map((s) => {
              const meta = GAME_METADATA[s.game_id] || {
                label: "Mini Game",
                accentColor: "text-paper/70",
                bgDot: "bg-paper/40",
              };
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-paper/10 bg-paper/[0.02] p-3 flex flex-col gap-1 hover:bg-paper/[0.04] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-paper/40 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.bgDot}`} />
                      <span>{meta.label} — Attempt #{s.attempt_number || 1}</span>
                    </span>
                    <span className="text-[9px] font-mono text-paper/40">
                      {formatDate(s.created_at)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <div className={`text-base font-extrabold font-mono ${meta.accentColor}`}>
                      {s.score.toLocaleString()}
                      <span className="text-[10px] font-mono text-paper/50 ml-0.5 font-normal">pts</span>
                    </div>
                    <div className="text-[11px] font-mono text-paper/60">
                      Time: {formatTime(s.time_ms)}
                      {s.moves > 0 && <span className="text-paper/40 ml-1.5">({s.moves} moves)</span>}
                    </div>
                  </div>
                  {s.level_data && (
                    <div className="text-[9px] font-mono text-paper/40 border-t border-paper/5 pt-1.5 mt-1">
                      Setup: {s.level_data}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
