"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { JigsawGame } from "./JigsawGame";
import { CrosswordGame } from "./CrosswordGame";
import { MemoryGame } from "./MemoryGame";
import { LeaderboardView } from "./LeaderboardView";
import { ScoreModal, type GameScoreSubmission } from "./ScoreModal";

export type GameTab = "jigsaw" | "crossword" | "memory" | "leaderboard";

export function GamesHub() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<GameTab>("jigsaw");
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [currentScoreData, setCurrentScoreData] = useState<GameScoreSubmission | null>(null);
  const [autoSubmitMessage, setAutoSubmitMessage] = useState<string | null>(null);

  // Check if there is a pending score in localStorage waiting for post-OAuth sign in
  useEffect(() => {
    if (status === "authenticated" && session?.user?.uid) {
      try {
        const stored = localStorage.getItem("devfest_pending_score");
        if (stored) {
          const parsed: GameScoreSubmission = JSON.parse(stored);
          localStorage.removeItem("devfest_pending_score");

          fetch("/api/games/scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed),
          })
            .then((res) => res.json() as Promise<{ ok?: boolean }>)
            .then((data) => {
              if (data.ok) {
                setAutoSubmitMessage(
                  `Welcome ${session.user?.name || "Builder"}. Your score for ${parsed.gameTitle} has been published to the leaderboard.`,
                );
                setTimeout(() => setAutoSubmitMessage(null), 8000);
              }
            })
            .catch((err) => console.error("Failed auto-submitting pending score", err));
        }
      } catch (e) {
        console.warn("Pending score check error", e);
      }
    }
  }, [status, session]);

  const handleGameFinish = useCallback((submission: GameScoreSubmission) => {
    setCurrentScoreData(submission);
    setModalOpen(true);
  }, []);

  function handleScoreSubmitted() {
    // Keep dialog open or allow viewing leaderboard
  }

  function handlePlayAgain() {
    setModalOpen(false);
    setCurrentScoreData(null);
  }

  function handleViewLeaderboard() {
    setModalOpen(false);
    setActiveTab("leaderboard");
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Auto Submit Notification Banner */}
      {autoSubmitMessage && (
        <div className="rounded-2xl border border-[var(--green)]/40 bg-[var(--green)]/10 p-4 text-center text-xs sm:text-sm font-medium text-[var(--green)] shadow-lg animate-fade-in flex items-center justify-between gap-3">
          <span>{autoSubmitMessage}</span>
          <button
            type="button"
            onClick={() => setAutoSubmitMessage(null)}
            className="text-xs text-paper/60 hover:text-paper p-1"
            aria-label="Dismiss notification"
          >
            Close
          </button>
        </div>
      )}

      {/* Main Navigation Tabs for Games & Leaderboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-paper/10 pb-4">
        {/* Horizontal scrollable tab bar on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            {
              id: "jigsaw" as const,
              label: "Archive Jigsaw",
              desc: "Photo puzzle",
              accent: "var(--blue)",
              icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
                </svg>
              ),
            },
            {
              id: "crossword" as const,
              label: "Tech Crossword",
              desc: "Google & Android clues",
              accent: "var(--green)",
              icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M3 12h18M3 19h18M7 3v18M17 3v18" />
                </svg>
              ),
            },
            {
              id: "memory" as const,
              label: "Memory Matrix",
              desc: "Match tech pairs",
              accent: "var(--yellow)",
              icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v10M16 7v10" />
                </svg>
              ),
            },
            {
              id: "leaderboard" as const,
              label: "Leaderboard",
              desc: "Global rankings",
              accent: "var(--red)",
              icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v12M12 5v16M18 13v8M3 21h18" />
                </svg>
              ),
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "border-[var(--blue)] bg-surface-raised ring-2 ring-[var(--blue)]/30 text-paper shadow-lg"
                    : "border-paper/10 bg-surface text-paper/70 hover:border-paper/30 hover:text-paper hover:bg-surface-raised"
                }`}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
                  style={{
                    backgroundColor: isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                    color: isActive ? tab.accent : "currentColor",
                  }}
                >
                  {tab.icon}
                </span>
                <div>
                  <div className="text-xs sm:text-sm font-bold leading-tight">{tab.label}</div>
                  <div className="text-[10px] font-mono text-paper/50 hidden sm:block">
                    {tab.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* User Status pill */}
        <div className="self-start md:self-auto flex items-center gap-2 rounded-full border border-paper/10 bg-surface px-3 py-1.5 text-xs font-mono text-paper/70 shrink-0">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "authenticated" ? "bg-[var(--green)] animate-pulse" : "bg-[var(--yellow)]"
            }`}
          />
          <span className="truncate max-w-[200px] sm:max-w-none">
            {status === "authenticated"
              ? `Signed in as ${session?.user?.name || "Builder"}`
              : "Sign in required for ranking"}
          </span>
        </div>
      </div>

      {/* Active Game / Leaderboard Display */}
      <div className="min-h-[450px]">
        {activeTab === "jigsaw" && <JigsawGame onFinishGame={handleGameFinish} />}
        {activeTab === "crossword" && <CrosswordGame onFinishGame={handleGameFinish} />}
        {activeTab === "memory" && <MemoryGame onFinishGame={handleGameFinish} />}
        {activeTab === "leaderboard" && <LeaderboardView />}
      </div>

      {/* Score Submission & Authentication Modal */}
      <ScoreModal
        isOpen={modalOpen}
        scoreData={currentScoreData}
        onClose={() => setModalOpen(false)}
        onScoreSubmitted={handleScoreSubmitted}
        onPlayAgain={handlePlayAgain}
        onViewLeaderboard={handleViewLeaderboard}
      />
    </div>
  );
}
