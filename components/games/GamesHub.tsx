"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { JigsawGame } from "./JigsawGame";
import { CrosswordGame } from "./CrosswordGame";
import { MemoryGame } from "./MemoryGame";
import { TypingGame } from "./TypingGame";
import { LeaderboardView } from "./LeaderboardView";
import { ScoreModal, type GameScoreSubmission } from "./ScoreModal";
import { GameSettingsModal } from "./GameSettingsModal";
import initialPhotos from "@/content/jigsaw-photos.json";
import type { ArchivePhotoChoice } from "@/lib/games-content";

export type GameTab = "jigsaw" | "crossword" | "memory" | "typing" | "leaderboard";

export function GamesHub() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<GameTab>("jigsaw");
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [currentScoreData, setCurrentScoreData] = useState<GameScoreSubmission | null>(null);
  const [autoSubmitMessage, setAutoSubmitMessage] = useState<string | null>(null);

  // Shared settings states across games
  const [photosPool, setPhotosPool] = useState<ArchivePhotoChoice[]>(initialPhotos as ArchivePhotoChoice[]);
  const [jigsawGridSize, setJigsawGridSize] = useState<number>(3);
  const [jigsawSlideMode, setJigsawSlideMode] = useState<boolean>(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ArchivePhotoChoice>(
    (initialPhotos[0] as ArchivePhotoChoice) || { src: "", title: "", year: 2025 },
  );

  const [crosswordCycleTime, setCrosswordCycleTime] = useState<string>("");
  const [crosswordHasStarted, setCrosswordHasStarted] = useState<boolean>(false);
  const [crosswordRevealTrigger, setCrosswordRevealTrigger] = useState<number>(0);
  const [crosswordCheckTrigger, setCrosswordCheckTrigger] = useState<number>(0);

  const [memoryPairsCount, setMemoryPairsCount] = useState<number>(8);

  // Typing game states
  const [typingMode, setTypingMode] = useState<"time" | "words">("time");
  const [typingTimeLimit, setTypingTimeLimit] = useState<number>(30);
  const [typingWordLimit, setTypingWordLimit] = useState<number>(200);

  // API-first fetch for latest archive photos with random photo choice on load
  useEffect(() => {
    fetch("/api/games/content?kind=photos")
      .then((res) => res.json() as Promise<{ data?: ArchivePhotoChoice[] }>)
      .then((payload) => {
        if (payload?.data && Array.isArray(payload.data) && payload.data.length > 0) {
          setPhotosPool(payload.data);
          const randPhoto = payload.data[Math.floor(Math.random() * payload.data.length)];
          setSelectedPhoto(randPhoto);
        }
      })
      .catch((err) => {
        console.warn("Using fallback photos content", err);
        const randPhoto = initialPhotos[Math.floor(Math.random() * initialPhotos.length)] as ArchivePhotoChoice;
        setSelectedPhoto(randPhoto);
      });
  }, []);

  function handleResetGame() {
    setResetTrigger((prev) => prev + 1);

    // Select a completely random photo from the pool on reset
    if (photosPool && photosPool.length > 0) {
      const randPhoto = photosPool[Math.floor(Math.random() * photosPool.length)];
      setSelectedPhoto(randPhoto);
    }
  }

  // Check if there is a pending score in localStorage waiting for post-OAuth sign in
  useEffect(() => {
    if (status === "authenticated" && session?.user?.uid) {
      try {
        const stored = localStorage.getItem("devfest_pending_score");
        if (stored) {
          const parsed: GameScoreSubmission = JSON.parse(stored);
          localStorage.removeItem("devfest_pending_score");

          // Nothing to tamper with: the run's score lives on the server, we send its id.
          if (!parsed.sessionId) return;
          fetch("/api/games/scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: parsed.sessionId }),
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
        <div className="rounded-2xl border border-green/40 bg-green/10 p-4 text-center text-xs sm:text-sm font-medium text-green shadow-lg animate-fade-in flex items-center justify-between gap-3">
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
              label: "Jigsaw Puzzle",
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
              id: "typing" as const,
              label: "Speed Typer",
              desc: "Typing speed test",
              accent: "var(--blue)",
              icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zM7 14h2M11 14h2M15 14h2" />
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
                    ? "border-blue bg-surface-raised ring-2 ring-blue/30 text-paper shadow-lg"
                    : "border-paper/10 bg-surface text-paper/70 hover:border-paper/30 hover:text-paper hover:bg-surface-raised"
                }`}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
                  style={{
                    backgroundColor: isActive ? "color-mix(in srgb, var(--paper) 8%, transparent)" : "color-mix(in srgb, var(--paper) 3%, transparent)",
                    color: isActive ? tab.accent : "currentColor",
                  }}
                >
                  {tab.icon}
                </span>
                <div>
                  <div className="text-xs sm:text-sm font-bold leading-tight">{tab.label}</div>
                  <div className="text-[10px] text-paper/50 hidden sm:block">
                    {tab.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Controls: Reset & Settings icons (replacing the sign-in pill) */}
        <div className="self-end md:self-auto flex items-center gap-2 shrink-0">
          {activeTab !== "leaderboard" && (
            <>
              <button
                type="button"
                onClick={handleResetGame}
                aria-label="Restart Game"
                title="Restart current game"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-paper/10 bg-surface text-paper/80 hover:border-paper/30 hover:bg-surface-raised hover:text-paper transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Game Settings"
                title="Game settings"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-paper/10 bg-surface text-paper/80 hover:border-paper/30 hover:bg-surface-raised hover:text-paper transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Active Game / Leaderboard Display */}
      <div className="min-h-[450px]">
        {activeTab === "jigsaw" && (
          <JigsawGame
            key={`jigsaw-${jigsawGridSize}-${jigsawSlideMode}-${selectedPhoto.src}-${resetTrigger}`}
            onFinishGame={handleGameFinish}
            gridSize={jigsawGridSize}
            isSlideMode={jigsawSlideMode}
            selectedPhoto={selectedPhoto}
            onSelectPhoto={setSelectedPhoto}
          />
        )}
        {activeTab === "crossword" && (
          <CrosswordGame
            key={`crossword-${resetTrigger}`}
            onFinishGame={handleGameFinish}
            onCycleTimeCalculated={setCrosswordCycleTime}
          />
        )}
        {activeTab === "memory" && (
          <MemoryGame
            key={`memory-${memoryPairsCount}-${resetTrigger}`}
            onFinishGame={handleGameFinish}
            pairsCount={memoryPairsCount}
          />
        )}
        {activeTab === "typing" && (
          <TypingGame
            key={`typing-${typingMode}-${typingTimeLimit}-${typingWordLimit}-${resetTrigger}`}
            onFinishGame={handleGameFinish}
            mode={typingMode}
            timeLimit={typingTimeLimit}
            wordLimit={typingWordLimit}
          />
        )}
        {activeTab === "leaderboard" && <LeaderboardView />}
      </div>

      {/* Game Settings Modal Popup */}
      <GameSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeTab={activeTab}
        jigsawGridSize={jigsawGridSize}
        onJigsawGridSizeChange={setJigsawGridSize}
        jigsawSlideMode={jigsawSlideMode}
        onJigsawSlideModeChange={setJigsawSlideMode}
        crosswordCycleTime={crosswordCycleTime}
        memoryPairsCount={memoryPairsCount}
        onMemoryPairsCountChange={setMemoryPairsCount}
        typingMode={typingMode}
        onTypingModeChange={setTypingMode}
        typingTimeLimit={typingTimeLimit}
        onTypingTimeLimitChange={setTypingTimeLimit}
        typingWordLimit={typingWordLimit}
        onTypingWordLimitChange={setTypingWordLimit}
        onResetGame={handleResetGame}
      />

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
