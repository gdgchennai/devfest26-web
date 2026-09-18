"use client";

import { useState, useRef } from "react";
import type { GameTab } from "./GamesHub";

type GameSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  activeTab: GameTab;
  // Jigsaw settings
  jigsawGridSize: number;
  onJigsawGridSizeChange: (size: number) => void;
  jigsawSlideMode: boolean;
  onJigsawSlideModeChange: (slide: boolean) => void;
  // Crossword settings
  crosswordCycleTime: string;
  // Memory settings
  memoryPairsCount: number;
  onMemoryPairsCountChange: (count: number) => void;
  // Typing settings
  typingMode: "time" | "words";
  onTypingModeChange: (mode: "time" | "words") => void;
  typingTimeLimit: number;
  onTypingTimeLimitChange: (limit: number) => void;
  typingWordLimit: number;
  onTypingWordLimitChange: (limit: number) => void;
  // Reset
  onResetGame: () => void;
};

export function GameSettingsModal({
  isOpen,
  onClose,
  activeTab,
  jigsawGridSize,
  onJigsawGridSizeChange,
  jigsawSlideMode,
  onJigsawSlideModeChange,
  crosswordCycleTime,
  memoryPairsCount,
  onMemoryPairsCountChange,
  typingMode,
  onTypingModeChange,
  typingTimeLimit,
  onTypingTimeLimitChange,
  typingWordLimit,
  onTypingWordLimitChange,
  onResetGame,
}: GameSettingsModalProps) {
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  if (!isOpen) return null;

  const handleClose = () => {
    setDragOffsetY(0);
    setIsDragging(false);
    onClose();
  };

  const tabTitles: Record<GameTab, string> = {
    jigsaw: "Archive Jigsaw Settings",
    crossword: "Tech Crossword Settings",
    memory: "Memory Matrix Settings",
    typing: "Speed Typer Settings",
    leaderboard: "Settings",
  };

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
        aria-labelledby="game-settings-title"
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <h2 id="game-settings-title" className="text-base sm:text-lg font-bold">
              {tabTitles[activeTab]}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-paper/10 bg-paper/5 p-2 text-paper/70 hover:bg-paper/15 hover:text-paper transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body: Game-Specific Options (Scrollable Content) */}
        <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-6 flex-1 scrollbar-none">
          {/* 1. Jigsaw Settings */}
          {activeTab === "jigsaw" && (
            <>
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-paper/60 block mb-2">
                  Grid Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { size: 3, label: "3×3", hint: "Casual" },
                    { size: 4, label: "4×4", hint: "Standard" },
                    { size: 5, label: "5×5", hint: "Expert" },
                  ].map((opt) => (
                    <button
                      key={opt.size}
                      type="button"
                      onClick={() => onJigsawGridSizeChange(opt.size)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                        jigsawGridSize === opt.size
                          ? "border-[var(--blue)] bg-[var(--blue)]/15 text-paper ring-1 ring-[var(--blue)]"
                          : "border-paper/10 bg-paper/[0.04] text-paper/70 hover:border-paper/30 hover:text-paper"
                      }`}
                    >
                      <span className="text-sm font-bold">{opt.label}</span>
                      <span className="text-[10px] font-mono text-paper/50">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-paper/60 block mb-2">
                  Game Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onJigsawSlideModeChange(false)}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      !jigsawSlideMode
                        ? "border-[var(--blue)] bg-[var(--blue)]/15 text-paper ring-1 ring-[var(--blue)]"
                        : "border-paper/10 bg-paper/[0.04] text-paper/70 hover:border-paper/30 hover:text-paper"
                    }`}
                  >
                    <div className="text-xs font-bold">Tile Swap</div>
                    <div className="text-[10px] text-paper/50 mt-0.5">Click 2 tiles to swap</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onJigsawSlideModeChange(true)}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      jigsawSlideMode
                        ? "border-[var(--yellow)] bg-[var(--yellow)]/15 text-paper ring-1 ring-[var(--yellow)]"
                        : "border-paper/10 bg-paper/[0.04] text-paper/70 hover:border-paper/30 hover:text-paper"
                    }`}
                  >
                    <div className="text-xs font-bold">Classic Slide</div>
                    <div className="text-[10px] text-paper/50 mt-0.5">1 empty slot sliding</div>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 2. Crossword Settings */}
          {activeTab === "crossword" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-paper/10 bg-paper/[0.04] p-4">
                <div className="flex items-center gap-2 text-xs font-mono text-paper/70">
                  <span className="flex h-2 w-2 rounded-full bg-[var(--green)] animate-pulse" />
                  <span>Next daily puzzle cycle:</span>
                </div>
                <div className="text-lg font-bold font-mono text-[var(--yellow)] mt-1">
                  {crosswordCycleTime || "Every 24 hours"}
                </div>
              </div>

              <div className="rounded-2xl border border-paper/10 bg-paper/[0.04] p-4 text-xs space-y-2 text-paper/80">
                <div className="font-bold text-paper font-mono uppercase tracking-wider text-[11px]">
                  Tips & Keyboard Shortcuts:
                </div>
                <ul className="space-y-1.5 list-disc list-inside text-paper/70">
                  <li>Click any cell or clue to select word</li>
                  <li>Press <kbd className="px-1.5 py-0.5 rounded bg-paper/10 font-mono text-paper">Space</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-paper/10 font-mono text-paper">Tab</kbd> to toggle Across/Down</li>
                  <li>Use in-game <strong className="text-paper">Reveal Letter</strong> or <strong className="text-paper">Check</strong> buttons directly from clue bar</li>
                </ul>
              </div>
            </div>
          )}

          {/* 3. Memory Matrix Settings */}
          {activeTab === "memory" && (
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-paper/60 block mb-2">
                Card Board Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { count: 6, label: "12 Cards", hint: "6 Pairs" },
                  { count: 8, label: "16 Cards", hint: "8 Pairs" },
                  { count: 12, label: "24 Cards", hint: "12 Pairs" },
                ].map((opt) => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => onMemoryPairsCountChange(opt.count)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      memoryPairsCount === opt.count
                        ? "border-[var(--yellow)] bg-[var(--yellow)]/15 text-paper ring-1 ring-[var(--yellow)]"
                        : "border-paper/10 bg-paper/[0.04] text-paper/70 hover:border-paper/30 hover:text-paper"
                    }`}
                  >
                    <span className="text-sm font-bold">{opt.label}</span>
                    <span className="text-[10px] font-mono text-paper/50">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Speed Typer Settings */}
          {activeTab === "typing" && (
            <div className="space-y-5">
              {/* Toggle typing test mode */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-paper/60 block mb-2">
                  Typing Mode
                </label>
                <div className="grid grid-cols-2 gap-2 bg-paper/[0.04] border border-paper/10 rounded-2xl p-1">
                  <button
                    type="button"
                    onClick={() => onTypingModeChange("time")}
                    className={`py-2 px-3 text-xs font-bold rounded-xl cursor-pointer transition-all ${
                      typingMode === "time"
                        ? "bg-[var(--blue)] text-white shadow-sm font-extrabold"
                        : "text-paper/60 hover:text-paper"
                    }`}
                  >
                    Time Attack
                  </button>
                  <button
                    type="button"
                    onClick={() => onTypingModeChange("words")}
                    className={`py-2 px-3 text-xs font-bold rounded-xl cursor-pointer transition-all ${
                      typingMode === "words"
                        ? "bg-[var(--blue)] text-white shadow-sm font-extrabold"
                        : "text-paper/60 hover:text-paper"
                    }`}
                  >
                    Words Count
                  </button>
                </div>
              </div>

              {/* Configure mode parameters */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-paper/60 block mb-2">
                  {typingMode === "time" ? "Timer Duration" : "Target Words"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {typingMode === "time" ? (
                    [15, 30, 60].map((t) => (
                      <button
                        key={`t-cfg-${t}`}
                        type="button"
                        onClick={() => onTypingTimeLimitChange(t)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                          typingTimeLimit === t
                            ? "border-[var(--blue)] bg-[var(--blue)]/15 text-paper ring-1 ring-[var(--blue)]"
                            : "border-paper/10 bg-paper/[0.04] text-paper/70 hover:border-paper/30 hover:text-paper"
                        }`}
                      >
                        <span className="text-sm font-bold">{t} Seconds</span>
                        <span className="text-[10px] font-mono text-paper/50">time limit</span>
                      </button>
                    ))
                  ) : (
                    [200, 400, 500].map((w) => (
                      <button
                        key={`w-cfg-${w}`}
                        type="button"
                        onClick={() => onTypingWordLimitChange(w)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                          typingWordLimit === w
                            ? "border-[var(--blue)] bg-[var(--blue)]/15 text-paper ring-1 ring-[var(--blue)]"
                            : "border-paper/10 bg-paper/[0.04] text-paper/70 hover:border-paper/30 hover:text-paper"
                        }`}
                      >
                        <span className="text-sm font-bold">{w} Words</span>
                        <span className="text-[10px] font-mono text-paper/50">limit</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Standard practice tip card */}
              <div className="rounded-2xl border border-paper/10 bg-paper/[0.04] p-4 text-xs space-y-2 text-paper/80">
                <div className="font-bold text-paper font-mono uppercase tracking-wider text-[11px]">
                  Typing Practice Tips:
                </div>
                <ul className="space-y-1.5 list-disc list-inside text-paper/70 font-sans leading-relaxed">
                  <li>Start typing immediately on your physical keyboard to kick off the timer.</li>
                  <li>On mobile, tap the typing canvas to summon your virtual software keyboard.</li>
                  <li>Pausing or switching browser windows will automatically pause and reset the active test!</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (Sticky bottom bar) */}
        <div className="border-t border-paper/10 bg-surface/90 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              onResetGame();
              handleClose();
            }}
            className="flex items-center gap-1.5 rounded-2xl border border-paper/20 bg-paper/10 px-4 py-2 text-xs font-mono font-medium text-paper hover:bg-paper/20 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Restart Game</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl bg-[var(--blue)] px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-90 transition-opacity cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
