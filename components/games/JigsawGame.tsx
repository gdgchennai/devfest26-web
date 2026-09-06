"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { GameScoreSubmission } from "./ScoreModal";

export type ArchivePhotoChoice = {
  src: string;
  title: string;
  year: number;
  description: string;
};

const ARCHIVE_PHOTOS: ArchivePhotoChoice[] = [
  {
    src: "/archive/2025-full-house.webp",
    title: "Full House Auditorium",
    year: 2025,
    description: "A speaker facing a packed auditorium from the front of the stage.",
  },
  {
    src: "/archive/2024-opening-stage.webp",
    title: "Opening on Stage",
    year: 2024,
    description: "Two hosts opening DevFest Chennai 2024 in front of the title slide.",
  },
  {
    src: "/archive/2025-badges-held-up.webp",
    title: "Badges Held Up",
    year: 2025,
    description: "Attendees holding their badges above the seats.",
  },
  {
    src: "/archive/2024-group-photo.webp",
    title: "DevFest Group Photo",
    year: 2024,
    description: "Attendees, speakers and volunteers gathered on stage.",
  },
  {
    src: "/archive/2025-keynote-hall.webp",
    title: "Keynote Hall",
    year: 2025,
    description: "The auditorium watching the keynote play on the main screen.",
  },
  {
    src: "/archive/2024-about-gdg-chennai.webp",
    title: "About GDG Chennai",
    year: 2024,
    description: "A speaker introducing GDG Chennai community on stage.",
  },
];

// Deterministic initial permutation for SSR to avoid hydration mismatch
function getInitialTiles(size: number): number[] {
  const count = size * size;
  return Array.from({ length: count }, (_, i) => (i + 1) % count);
}

function generateShuffledTiles(size: number, slide: boolean): number[] {
  const count = size * size;
  const initial = Array.from({ length: count }, (_, i) => i);
  const shuffled = [...initial];
  let isSolved = true;

  while (isSolved) {
    for (let i = shuffled.length - (slide ? 2 : 1); i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (slide) {
      let inversions = 0;
      for (let i = 0; i < count - 1; i++) {
        for (let j = i + 1; j < count - 1; j++) {
          if (shuffled[i] > shuffled[j] && shuffled[i] !== count - 1 && shuffled[j] !== count - 1) {
            inversions++;
          }
        }
      }
      if (size % 2 === 1 && inversions % 2 !== 0) {
        [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
      }
    }
    isSolved = shuffled.every((val, idx) => val === idx);
  }

  return shuffled;
}

type JigsawGameProps = {
  onFinishGame: (submission: GameScoreSubmission) => void;
};

export function JigsawGame({ onFinishGame }: JigsawGameProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<ArchivePhotoChoice>(ARCHIVE_PHOTOS[0]);
  const [gridSize, setGridSize] = useState<number>(3);
  const [isSlideMode, setIsSlideMode] = useState<boolean>(false);
  const [tiles, setTiles] = useState<number[]>(() => getInitialTiles(3));
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);
  const [moves, setMoves] = useState<number>(0);

  // Game flow states
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [gameCompleted, setGameCompleted] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  // Reference photo reveal timer & 3 chances
  const [revealChancesLeft, setRevealChancesLeft] = useState<number>(3);
  const [revealSecondsLeft, setRevealSecondsLeft] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);

  const totalTiles = gridSize * gridSize;

  const restartPuzzle = useCallback(
    (size = gridSize, slide = isSlideMode, photo = selectedPhoto) => {
      setGridSize(size);
      setIsSlideMode(slide);
      setSelectedPhoto(photo);
      setTiles(getInitialTiles(size));
      setSelectedTileIndex(null);
      setMoves(0);
      setHasStarted(false);
      setGameCompleted(false);
      setElapsedMs(0);
      setRevealChancesLeft(3);
      setRevealSecondsLeft(0);
      startTimeRef.current = 0;
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    },
    [gridSize, isSlideMode, selectedPhoto],
  );

  const handleStartGame = () => {
    setTiles(generateShuffledTiles(gridSize, isSlideMode));
    setHasStarted(true);
    setGameCompleted(false);
    setElapsedMs(0);
    startTimeRef.current = Date.now();
  };

  // Stopwatch timer
  useEffect(() => {
    if (hasStarted && !gameCompleted) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 200);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasStarted, gameCompleted]);

  // Reference photo 5-second countdown timer
  const handleRevealPhoto = () => {
    if (revealChancesLeft <= 0 || revealSecondsLeft > 0) return;

    setRevealChancesLeft((prev) => prev - 1);
    setRevealSecondsLeft(5);

    if (revealTimerRef.current) clearInterval(revealTimerRef.current);

    let sec = 5;
    revealTimerRef.current = setInterval(() => {
      sec -= 1;
      setRevealSecondsLeft(sec);
      if (sec <= 0) {
        if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    };
  }, []);

  // Check victory condition
  const checkWin = useCallback(
    (currentTiles: number[]) => {
      const isWon = currentTiles.every((val, idx) => val === idx);
      if (isWon && !gameCompleted && hasStarted) {
        setGameCompleted(true);
        const finalTime = Math.max(1000, Date.now() - startTimeRef.current);
        const finalMoves = moves + 1;

        const baseScore = gridSize === 3 ? 3500 : gridSize === 4 ? 6500 : 10000;
        const timePenalty = Math.floor((finalTime / 1000) * 12);
        const movePenalty = finalMoves * 15;
        const finalScore = Math.max(250, baseScore - timePenalty - movePenalty);

        onFinishGame({
          gameId: "jigsaw",
          gameTitle: "DevFest Archive Jigsaw",
          score: finalScore,
          timeMs: finalTime,
          moves: finalMoves,
          levelData: `${gridSize}x${gridSize} Grid • ${selectedPhoto.title} (${selectedPhoto.year})`,
        });
      }
    },
    [gameCompleted, hasStarted, moves, gridSize, selectedPhoto, onFinishGame],
  );

  function handleTileClick(index: number) {
    if (!hasStarted || gameCompleted) return;

    if (isSlideMode) {
      const emptySlotIndex = tiles.indexOf(totalTiles - 1);
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      const emptyRow = Math.floor(emptySlotIndex / gridSize);
      const emptyCol = emptySlotIndex % gridSize;

      const isAdjacent =
        (Math.abs(row - emptyRow) === 1 && col === emptyCol) ||
        (Math.abs(col - emptyCol) === 1 && row === emptyRow);

      if (isAdjacent) {
        const newTiles = [...tiles];
        [newTiles[index], newTiles[emptySlotIndex]] = [newTiles[emptySlotIndex], newTiles[index]];
        setTiles(newTiles);
        setMoves((m) => m + 1);
        checkWin(newTiles);
      }
    } else {
      if (selectedTileIndex === null) {
        setSelectedTileIndex(index);
      } else if (selectedTileIndex === index) {
        setSelectedTileIndex(null);
      } else {
        const newTiles = [...tiles];
        [newTiles[selectedTileIndex], newTiles[index]] = [newTiles[index], newTiles[selectedTileIndex]];
        setTiles(newTiles);
        setSelectedTileIndex(null);
        setMoves((m) => m + 1);
        checkWin(newTiles);
      }
    }
  }

  const seconds = Math.floor(elapsedMs / 1000);
  const timeFormatted = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
  const correctCount = hasStarted ? tiles.filter((val, idx) => val === idx).length : 0;
  const progressPercent = hasStarted ? Math.round((correctCount / totalTiles) * 100) : 0;

  const isPhotoRevealed = revealSecondsLeft > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-paper/10 bg-surface p-3.5 sm:p-4">
        {/* Difficulty Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-paper/60">Grid:</span>
          <div className="inline-flex rounded-xl border border-paper/10 bg-paper/[0.04] p-1">
            {[
              { size: 3, label: "3×3" },
              { size: 4, label: "4×4" },
              { size: 5, label: "5×5" },
            ].map((option) => (
              <button
                key={option.size}
                type="button"
                onClick={() => restartPuzzle(option.size, isSlideMode, selectedPhoto)}
                className={`rounded-lg px-2.5 sm:px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                  gridSize === option.size
                    ? "bg-[var(--blue)] text-white shadow-sm"
                    : "text-paper/70 hover:text-paper hover:bg-paper/5"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode & Helpers */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => restartPuzzle(gridSize, !isSlideMode, selectedPhoto)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer ${
              isSlideMode
                ? "border-[var(--yellow)]/50 bg-[var(--yellow)]/10 text-[var(--yellow)]"
                : "border-paper/10 bg-paper/[0.04] text-paper/70 hover:text-paper"
            }`}
          >
            Mode: {isSlideMode ? "Classic Slide" : "Tile Swap"}
          </button>

          <button
            type="button"
            onClick={() => restartPuzzle(gridSize, isSlideMode, selectedPhoto)}
            className="rounded-xl border border-paper/20 bg-paper/10 px-3 py-1.5 text-xs font-mono text-paper hover:bg-paper/20 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Live Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="rounded-2xl border border-paper/10 bg-surface p-3 text-center">
          <div className="text-[11px] font-mono uppercase tracking-wider text-paper/60">Time</div>
          <div className="text-lg sm:text-xl font-bold font-mono text-paper mt-0.5">
            {hasStarted ? timeFormatted : "0:00"}
          </div>
        </div>
        <div className="rounded-2xl border border-paper/10 bg-surface p-3 text-center">
          <div className="text-[11px] font-mono uppercase tracking-wider text-paper/60">Moves</div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[var(--yellow)] mt-0.5">{moves}</div>
        </div>
        <div className="rounded-2xl border border-paper/10 bg-surface p-3 text-center">
          <div className="text-[11px] font-mono uppercase tracking-wider text-paper/60">Solved</div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[var(--green)] mt-0.5">
            {correctCount}/{totalTiles} ({progressPercent}%)
          </div>
        </div>
        <div className="rounded-2xl border border-paper/10 bg-surface p-3 text-center">
          <div className="text-[11px] font-mono uppercase tracking-wider text-paper/60">Target Photo</div>
          <div className="text-xs font-medium text-paper truncate mt-1">{selectedPhoto.title}</div>
        </div>
      </div>

      {/* Main Puzzle Playground Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Jigsaw Board */}
        <div className="lg:col-span-8 flex flex-col items-center">
          <div
            className="relative w-full max-w-[560px] aspect-[4/3] rounded-2xl border-2 border-paper/20 bg-black/60 p-2 shadow-2xl overflow-hidden"
            style={{ touchAction: "manipulation" }}
          >
            {/* The Grid of Tiles */}
            <div
              className={`grid w-full h-full gap-1 sm:gap-1.5 transition-all duration-300 ${
                !hasStarted ? "filter blur-md opacity-40 pointer-events-none select-none" : ""
              }`}
              style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
              }}
            >
              {tiles.map((tileNumber, slotIndex) => {
                const isBlank = isSlideMode && tileNumber === totalTiles - 1 && !gameCompleted;
                const isSelected = selectedTileIndex === slotIndex;
                const isCorrect = tileNumber === slotIndex;

                const originalRow = Math.floor(tileNumber / gridSize);
                const originalCol = tileNumber % gridSize;
                const xPos = (originalCol / (gridSize - 1)) * 100;
                const yPos = (originalRow / (gridSize - 1)) * 100;

                if (isBlank) {
                  return (
                    <div
                      key={slotIndex}
                      onClick={() => handleTileClick(slotIndex)}
                      className="rounded-lg bg-ink/90 border border-dashed border-paper/20 flex items-center justify-center cursor-pointer"
                    >
                      <span className="text-[10px] font-mono text-paper/30">empty</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={slotIndex}
                    type="button"
                    onClick={() => handleTileClick(slotIndex)}
                    className={`relative rounded-lg overflow-hidden transition-all duration-150 transform active:scale-95 focus:outline-none cursor-pointer ${
                      isSelected
                        ? "ring-4 ring-[var(--blue)] scale-[0.98] z-20 shadow-lg"
                        : isCorrect && hasStarted
                        ? "ring-1 ring-[var(--green)]/40 hover:ring-[var(--green)]"
                        : "ring-1 ring-paper/15 hover:ring-paper/50"
                    }`}
                    style={{
                      backgroundImage: `url(${selectedPhoto.src})`,
                      backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                      backgroundPosition: `${xPos}% ${yPos}%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    {isCorrect && hasStarted && (
                      <span className="absolute bottom-1 right-1 text-[10px] text-[var(--green)] bg-black/60 px-1 rounded font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Start Game Overlay if not started */}
            {!hasStarted && !gameCompleted && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-6 text-center animate-fade-in">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--blue)]/20 text-[var(--blue)] mb-3">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Archive Jigsaw</h3>
                <p className="text-xs text-paper/70 mt-1 max-w-xs">
                  Reconstruct DevFest {selectedPhoto.year} in {gridSize}×{gridSize} tiles.
                </p>
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--blue)] px-7 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-[var(--blue)]/30 hover:bg-[var(--blue)]/90 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Start Game</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            )}

            {/* Victory Overlay on Complete */}
            {gameCompleted && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center animate-fade-in">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--green)]/20 text-[var(--green)] mb-2 font-bold text-xl">
                  ✓
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">Puzzle Solved</h3>
                <p className="text-xs sm:text-sm text-paper/70 mt-1">
                  Completed in {timeFormatted} with {moves} moves.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => restartPuzzle(gridSize, isSlideMode, selectedPhoto)}
                    className="rounded-full bg-[var(--green)] px-5 py-2 text-xs font-semibold text-black hover:bg-[var(--green)]/90 cursor-pointer"
                  >
                    Play Again
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-paper/60 text-center">
            {isSlideMode
              ? "Click any tile adjacent to the empty slot to slide it."
              : "Click a piece to select it, then click another piece to swap."}
          </p>
        </div>

        {/* Photo Selection Sidebar & 5-Second Reveal Box */}
        <div className="lg:col-span-4 flex flex-col gap-4 w-full">
          {/* Reference Image Box with 3 Reveal Chances of 5 Seconds */}
          <div className="rounded-2xl border border-paper/10 bg-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-paper/60">Reference Photo</span>
              <span className="text-xs font-mono text-[var(--blue-halftone)]">{selectedPhoto.year}</span>
            </div>

            {/* Blurred Image Container with Reveal Countdown */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-paper/10 bg-black/60">
              <Image
                src={selectedPhoto.src}
                alt={selectedPhoto.title}
                fill
                className={`object-cover transition-all duration-500 ${
                  isPhotoRevealed ? "filter blur-0 scale-100" : "filter blur-xl scale-110 opacity-40"
                }`}
                sizes="(min-width: 1024px) 300px, 100vw"
              />

              {/* Overlay prompt when blurred */}
              {!isPhotoRevealed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-4 text-center">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" className="text-paper/60 mb-1">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <span className="text-xs font-medium text-paper">Photo Blurred</span>
                  <span className="text-[10px] font-mono text-paper/60 mt-0.5">
                    {revealChancesLeft > 0
                      ? `${revealChancesLeft} peek${revealChancesLeft === 1 ? "" : "s"} remaining (5s each)`
                      : "No peeks remaining"}
                  </span>
                </div>
              )}

              {/* Countdown badge when revealed */}
              {isPhotoRevealed && (
                <div className="absolute top-2 right-2 rounded-full bg-black/80 px-2.5 py-1 text-xs font-mono font-bold text-[var(--yellow)] border border-[var(--yellow)]/40 animate-pulse">
                  Hiding in {revealSecondsLeft}s
                </div>
              )}
            </div>

            {/* Reveal Action Button */}
            <div className="mt-3">
              <button
                type="button"
                onClick={handleRevealPhoto}
                disabled={revealChancesLeft <= 0 || revealSecondsLeft > 0}
                className={`w-full rounded-xl py-2.5 text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2 ${
                  revealSecondsLeft > 0
                    ? "bg-[var(--yellow)]/20 border border-[var(--yellow)] text-[var(--yellow)]"
                    : revealChancesLeft > 0
                    ? "bg-[var(--blue)] text-white hover:bg-[var(--blue)]/90 shadow-sm cursor-pointer"
                    : "bg-paper/5 border border-paper/10 text-paper/40 cursor-not-allowed"
                }`}
              >
                {revealSecondsLeft > 0 ? (
                  <span>Revealing ({revealSecondsLeft}s)</span>
                ) : revealChancesLeft > 0 ? (
                  <span>Peek Photo ({revealChancesLeft} of 3 left)</span>
                ) : (
                  <span>No Peeks Left (0/3)</span>
                )}
              </button>
            </div>

            <p className="mt-3 text-xs text-paper/80 font-medium">{selectedPhoto.title}</p>
            <p className="text-[11px] text-paper/60 leading-tight mt-0.5">{selectedPhoto.description}</p>
          </div>

          {/* Photo Gallery Picker */}
          <div className="rounded-2xl border border-paper/10 bg-surface p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-paper/60 mb-3">
              Choose Photo:
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ARCHIVE_PHOTOS.map((photo) => (
                <button
                  key={photo.src}
                  type="button"
                  onClick={() => restartPuzzle(gridSize, isSlideMode, photo)}
                  className={`relative aspect-[4/3] rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    selectedPhoto.src === photo.src
                      ? "border-[var(--blue)] ring-2 ring-[var(--blue)]/50 scale-[1.02]"
                      : "border-paper/10 opacity-70 hover:opacity-100 hover:border-paper/40"
                  }`}
                >
                  <Image
                    src={photo.src}
                    alt={photo.title}
                    fill
                    className="object-cover"
                    sizes="100px"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[9px] font-mono text-center text-paper truncate">
                    {photo.year}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
