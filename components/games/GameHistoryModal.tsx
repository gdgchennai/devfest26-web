"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import type { GameScoreRecord } from "@/lib/leaderboard";

type GameHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userHistory: GameScoreRecord[];
  isAuthenticated: boolean;
};

export function GameHistoryModal({
  isOpen,
  onClose,
  userHistory,
  isAuthenticated,
}: GameHistoryModalProps) {
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  if (!isOpen) return null;

  const handleClose = () => {
    setDragOffsetY(0);
    setIsDragging(false);
    onClose();
  };

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

  const jigsawScores = userHistory.filter((s) => s.game_id === "jigsaw");
  const crosswordScores = userHistory.filter((s) => s.game_id === "crossword");
  const memoryScores = userHistory.filter((s) => s.game_id === "memory");

  const totalAttempts = userHistory.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 backdrop-blur-sm animate-fade-in pb-safe">
      {/* Click outside backdrop to close */}
      <div 
        className="absolute inset-0 cursor-pointer" 
        onClick={handleClose} 
        aria-hidden="true" 
      />

      {/* Bottom Sheet Container */}
      <div
        className="relative w-full max-w-lg md:max-w-xl rounded-t-[32px] border-t border-x border-paper/15 bg-surface shadow-2xl text-paper flex flex-col max-h-[85vh] overflow-hidden"
        style={{
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          touchAction: "none", // Prevent touch scrolling during drag interaction
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-history-title"
      >
        {/* Interactable Drag Handle Bar */}
        <div
          className="flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing group select-none shrink-0"
          onPointerDown={(e) => {
            setIsDragging(true);
            dragStartY.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!isDragging) return;
            const deltaY = e.clientY - dragStartY.current;
            if (deltaY > 0) {
              setDragOffsetY(deltaY);
            }
          }}
          onPointerUp={(e) => {
            if (!isDragging) return;
            setIsDragging(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
            if (dragOffsetY > 120) {
              handleClose();
            } else {
              setDragOffsetY(0);
            }
          }}
          title="Drag down to close"
        >
          <div className="w-12 h-1.5 rounded-full bg-paper/20 group-hover:bg-paper/40 transition-colors" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-paper/10 px-5 sm:px-6 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-paper/10 text-paper">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div>
              <h2 id="game-history-title" className="text-base sm:text-lg font-bold">
                My Game History
              </h2>
              {isAuthenticated && totalAttempts > 0 && (
                <p className="text-[10px] font-mono text-paper/50 mt-0.5">
                  Logged {totalAttempts} total {totalAttempts === 1 ? "attempt" : "attempts"} across all games
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-paper/10 bg-paper/5 p-2 text-paper/70 hover:bg-paper/15 hover:text-paper transition-colors cursor-pointer"
            aria-label="Close history"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body: Scrollable History Cards */}
        <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-6 flex-1 scrollbar-none">
          {!isAuthenticated ? (
            <div className="text-center py-10 px-4 space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--blue)]/20 text-[var(--blue)] mx-auto">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-paper">Sign In Required</h3>
                <p className="text-xs text-paper/60 max-w-xs mx-auto leading-relaxed">
                  Please sign in with Google to record, view, and synchronize your game attempts history with the leaderboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => signIn("google")}
                className="mx-auto flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-xs font-bold text-black hover:opacity-95 transition-opacity cursor-pointer shadow-md"
              >
                {/* Google Icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.18 1-.78 1.85-1.63 2.42v2.01h2.64c1.55-1.42 2.63-3.52 2.63-6.44z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.09H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.91l3.66-2.8z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.09l3.66 2.84c.87-2.6 3.3-4.55 6.16-4.55z" fill="#EA4335" />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          ) : totalAttempts === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paper/5 text-paper/40 mx-auto">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-paper">No Attempts Logged</h3>
                <p className="text-xs text-paper/60 max-w-xs mx-auto">
                  You haven&apos;t published any scores yet. Play a game to record your score here!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Jigsaw History */}
              {jigsawScores.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--blue-halftone)] flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--blue)]" />
                    <span>Archive Jigsaw Attempts</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {jigsawScores.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-paper/10 bg-paper/[0.03] p-3.5 flex flex-col gap-1.5 shadow-sm hover:border-paper/20 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-paper/40">
                            Attempt #{s.attempt_number || 1}
                          </span>
                          <span className="text-[10px] font-mono text-paper/50">
                            {formatDate(s.created_at)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <div className="text-lg sm:text-xl font-extrabold font-mono text-[var(--blue-halftone)]">
                            {s.score.toLocaleString()}
                            <span className="text-[10px] font-mono text-paper/50 ml-0.5">pts</span>
                          </div>
                          <div className="text-xs font-mono text-paper/70">
                            Time: {formatTime(s.time_ms)}
                          </div>
                        </div>
                        {s.level_data && (
                          <div className="text-[10px] font-mono text-paper/40 border-t border-paper/5 pt-1.5 mt-0.5 flex justify-between">
                            <span>{s.level_data}</span>
                            <span>{s.moves} moves</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Crossword History */}
              {crosswordScores.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--yellow-pastel)] flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--yellow)]" />
                    <span>Tech Crossword Attempts</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {crosswordScores.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-paper/10 bg-paper/[0.03] p-3.5 flex flex-col gap-1.5 shadow-sm hover:border-paper/20 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-paper/40">
                            Attempt #{s.attempt_number || 1}
                          </span>
                          <span className="text-[10px] font-mono text-paper/50">
                            {formatDate(s.created_at)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <div className="text-lg sm:text-xl font-extrabold font-mono text-[var(--yellow)]">
                            {s.score.toLocaleString()}
                            <span className="text-[10px] font-mono text-paper/50 ml-0.5">pts</span>
                          </div>
                          <div className="text-xs font-mono text-paper/70">
                            Time: {formatTime(s.time_ms)}
                          </div>
                        </div>
                        {s.level_data && (
                          <div className="text-[10px] font-mono text-paper/40 border-t border-paper/5 pt-1.5 mt-0.5">
                            {s.level_data}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Memory History */}
              {memoryScores.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--green-pastel)] flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--green)]" />
                    <span>Memory Matrix Attempts</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {memoryScores.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-paper/10 bg-paper/[0.03] p-3.5 flex flex-col gap-1.5 shadow-sm hover:border-paper/20 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-paper/40">
                            Attempt #{s.attempt_number || 1}
                          </span>
                          <span className="text-[10px] font-mono text-paper/50">
                            {formatDate(s.created_at)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <div className="text-lg sm:text-xl font-extrabold font-mono text-[var(--green-halftone)]">
                            {s.score.toLocaleString()}
                            <span className="text-[10px] font-mono text-paper/50 ml-0.5">pts</span>
                          </div>
                          <div className="text-xs font-mono text-paper/70">
                            Time: {formatTime(s.time_ms)}
                          </div>
                        </div>
                        {s.level_data && (
                          <div className="text-[10px] font-mono text-paper/40 border-t border-paper/5 pt-1.5 mt-0.5">
                            {s.level_data}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer (Sticky bottom bar) */}
        <div className="border-t border-paper/10 bg-surface/90 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl bg-[var(--blue)] px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-90 transition-opacity cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
