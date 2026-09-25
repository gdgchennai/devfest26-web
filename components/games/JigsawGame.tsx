"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import initialPhotos from "@/content/jigsaw-photos.json";
import type { GameScoreSubmission } from "./ScoreModal";
import type { ArchivePhotoChoice } from "@/lib/games-content";
import { generateJigsawTiles, jigsawScore } from "@/lib/game-rules";
import { gameApi } from "@/lib/games-client";

// Deterministic initial permutation for SSR to avoid hydration mismatch
function getInitialTiles(size: number): number[] {
  const count = size * size;
  return Array.from({ length: count }, (_, i) => (i + 1) % count);
}

type JigsawGameProps = {
  onFinishGame: (submission: GameScoreSubmission) => void;
  gridSize?: number;
  isSlideMode?: boolean;
  selectedPhoto?: ArchivePhotoChoice;
};

export function JigsawGame({
  onFinishGame,
  gridSize: externalGridSize = 3,
  isSlideMode: externalSlideMode = false,
  selectedPhoto: externalSelectedPhoto,
}: JigsawGameProps) {
  const [photosPool, setPhotosPool] = useState<ArchivePhotoChoice[]>(initialPhotos as ArchivePhotoChoice[]);
  const currentPhoto = externalSelectedPhoto || photosPool[0] || (initialPhotos[0] as ArchivePhotoChoice);
  const gridSize = externalGridSize;
  const isSlideMode = externalSlideMode;

  const [tiles, setTiles] = useState<number[]>(() => getInitialTiles(gridSize));
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
  // The server-side run this board belongs to (null → offline practice), and
  // everything the player did to it — the evidence the server scores.
  const sessionIdRef = useRef<string | null>(null);
  const moveLogRef = useRef<number[][]>([]);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  const totalTiles = gridSize * gridSize;

  // API-first fetch for latest archive photos
  useEffect(() => {
    fetch("/api/games/content?kind=photos")
      .then((res) => res.json() as Promise<{ data?: ArchivePhotoChoice[] }>)
      .then((payload) => {
        if (payload?.data && Array.isArray(payload.data) && payload.data.length > 0) {
          setPhotosPool(payload.data);
        }
      })
      .catch((err) => console.warn("Using fallback photos content", err));
  }, []);

  const restartPuzzle = useCallback(
    (size = gridSize) => {
      setTiles(getInitialTiles(size));
      setSelectedTileIndex(null);
      setMoves(0);
      setHasStarted(false);
      setGameCompleted(false);
      setElapsedMs(0);
      setRevealChancesLeft(3);
      setRevealSecondsLeft(0);
      startTimeRef.current = 0;
      sessionIdRef.current = null;
      moveLogRef.current = [];
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    },
    [gridSize],
  );

  const handleStartGame = async () => {
    if (isStarting) return;
    setIsStarting(true);
    // The server deals the board and starts the clock; if it can't be reached we
    // deal locally and play an unranked practice run.
    const started = await gameApi.startJigsaw(gridSize, isSlideMode);
    sessionIdRef.current = started.ok ? started.data.sessionId : null;
    moveLogRef.current = [];
    setTiles(started.ok ? started.data.tiles : generateJigsawTiles(gridSize, isSlideMode, Math.random));
    setIsStarting(false);
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

  // Check victory condition. The board being solved only tells us WHEN to finish; what
  // it scored is decided by the server from the move log.
  const checkWin = useCallback(
    (currentTiles: number[]) => {
      const isWon = currentTiles.every((val, idx) => val === idx);
      if (!isWon || gameCompleted || !hasStarted) return;
      setGameCompleted(true);

      const log = moveLogRef.current;
      const sessionId = sessionIdRef.current;
      void (async () => {
        let unranked: "offline" | "rejected" = "offline";
        if (sessionId) {
          const done = await gameApi.finish(sessionId, { moves: log });
          if (done.ok) {
            onFinishGame({ ...done.data.result, sessionId });
            return;
          }
          unranked = done.status === 0 ? "offline" : "rejected";
        }
        // Offline (or the server refused): show a local, unranked result.
        const timeMs = Math.max(1000, Date.now() - startTimeRef.current);
        onFinishGame({
          gameId: "jigsaw",
          gameTitle: "Jigsaw Puzzle",
          score: jigsawScore(gridSize, timeMs, log.length),
          timeMs,
          moves: log.length,
          levelData: `${gridSize}x${gridSize} Grid`,
          unranked,
        });
      })();
    },
    [gameCompleted, hasStarted, gridSize, onFinishGame],
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
        moveLogRef.current.push([index]);
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
        moveLogRef.current.push([selectedTileIndex, index]);
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
    <div className="flex flex-col gap-5">
      {/* Live Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="rounded-2xl border border-paper/10 bg-surface p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-paper/60">Time</div>
          <div className="text-lg sm:text-xl font-bold text-paper mt-0.5">
            {hasStarted ? timeFormatted : "0:00"}
          </div>
        </div>
        <div className="rounded-2xl border border-paper/10 bg-surface p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-paper/60">Moves</div>
          <div className="text-lg sm:text-xl font-bold text-yellow mt-0.5">{moves}</div>
        </div>
        <div className="rounded-2xl border border-paper/10 bg-surface p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-paper/60">Solved</div>
          <div className="text-lg sm:text-xl font-bold text-green mt-0.5">
            {correctCount}/{totalTiles} ({progressPercent}%)
          </div>
        </div>
      </div>

      {/* Main Puzzle Playground Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Jigsaw Board */}
        <div className="lg:col-span-8 flex flex-col items-center">
          <div
            className="relative w-full max-w-[560px] aspect-[4/3] rounded-2xl border-2 border-paper/20 bg-ink/60 p-2 shadow-2xl overflow-hidden"
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
                      <span className="text-[10px] text-paper/30">empty</span>
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
                        ? "ring-4 ring-blue scale-[0.98] z-20 shadow-lg"
                        : isCorrect && hasStarted
                        ? "ring-1 ring-green/40 hover:ring-green"
                        : "ring-1 ring-paper/15 hover:ring-paper/50"
                    }`}
                    style={{
                      backgroundImage: `url(${currentPhoto.src})`,
                      backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                      backgroundPosition: `${xPos}% ${yPos}%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    {isCorrect && hasStarted && (
                      <span className="absolute bottom-1 right-1 text-[10px] text-green bg-ink/60 px-1 rounded font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Start Game Overlay if not started */}
            {!hasStarted && !gameCompleted && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-ink/60 backdrop-blur-sm p-6 text-center animate-fade-in">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue/20 text-blue mb-3">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-paper tracking-tight">Jigsaw Puzzle</h3>
                <p className="text-xs text-paper/70 mt-1 max-w-xs">
                  Reconstruct the image in {gridSize}×{gridSize} tiles.
                </p>
                <button
                  type="button"
                  onClick={handleStartGame}
                  disabled={isStarting}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue px-7 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue/30 hover:bg-blue/90 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:hover:scale-100"
                >
                  <span>{isStarting ? "Dealing…" : "Start Game"}</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            )}

            {/* Victory Overlay on Complete */}
            {gameCompleted && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-ink/80 backdrop-blur-sm p-6 text-center animate-fade-in">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green/20 text-green mb-2 font-bold text-xl">
                  ✓
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-paper">Puzzle Solved</h3>
                <p className="text-xs sm:text-sm text-paper/70 mt-1">
                  Completed in {timeFormatted} with {moves} moves.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => restartPuzzle(gridSize)}
                    className="rounded-full bg-green px-5 py-2 text-xs font-semibold text-black hover:bg-green/90 cursor-pointer"
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
              <span className="text-xs uppercase tracking-wider text-paper/60">Reference Photo</span>
            </div>
            <div className="relative aspect-[4/3] w-full rounded-2xl border border-paper/20 overflow-hidden bg-ink/60 shadow-lg">
              <Image
                src={currentPhoto.src}
                alt={currentPhoto.title}
                fill
                className={`object-cover transition-all duration-500 ${
                  isPhotoRevealed ? "filter blur-0 scale-100" : "filter blur-xl scale-110 opacity-40"
                }`}
                sizes="(min-width: 1024px) 300px, 100vw"
              />

              {/* Overlay prompt when blurred */}
              {!isPhotoRevealed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/40 p-4 text-center">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" className="text-paper/60 mb-1">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <span className="text-xs font-medium text-paper">Photo Blurred</span>
                  <span className="text-[10px] text-paper/60 mt-0.5">
                    {revealChancesLeft > 0
                      ? `${revealChancesLeft} peek${revealChancesLeft === 1 ? "" : "s"} remaining (5s each)`
                      : "No peeks remaining"}
                  </span>
                </div>
              )}

              {/* Countdown badge when revealed */}
              {isPhotoRevealed && (
                <div className="absolute top-2 right-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-bold text-yellow border border-yellow/40 animate-pulse">
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
                className={`w-full rounded-xl py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  revealSecondsLeft > 0
                    ? "bg-yellow/20 border border-yellow text-yellow"
                    : revealChancesLeft > 0
                    ? "bg-blue text-white hover:bg-blue/90 shadow-sm cursor-pointer"
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
          </div>

          {/* Photos pool panel removed to enforce automatic randomizing on game load/reset */}
        </div>
      </div>
    </div>
  );
}
