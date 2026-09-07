"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import initialCrosswords from "@/content/crosswords.json";
import type { GameScoreSubmission } from "./ScoreModal";
import type { CrosswordPuzzle, CrosswordClue } from "@/lib/games-content";

// Calculate current 24-hour cycle day index
function getDailyPuzzleIndex(poolLength: number): number {
  if (!poolLength) return 0;
  const now = new Date();
  const utcDays = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
  return Math.abs(utcDays) % poolLength;
}

function getFormattedDate(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getRemainingCycleTime(): string {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const diffSec = Math.max(0, Math.floor((nextMidnight.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

type CrosswordGameProps = {
  onFinishGame: (submission: GameScoreSubmission) => void;
};

type CellData = {
  row: number;
  col: number;
  letter: string;
  number?: number;
  acrossClueIndex?: number;
  downClueIndex?: number;
};

export function CrosswordGame({ onFinishGame }: CrosswordGameProps) {
  const [puzzles, setPuzzles] = useState<CrosswordPuzzle[]>(initialCrosswords as CrosswordPuzzle[]);
  const dailyIdx = useMemo(() => getDailyPuzzleIndex(puzzles.length), [puzzles.length]);
  const puzzle = puzzles[dailyIdx] || puzzles[0] || (initialCrosswords[0] as CrosswordPuzzle);

  const [cycleTimeLeft, setCycleTimeLeft] = useState<string>("");

  // API-first fetch for latest crosswords
  useEffect(() => {
    fetch("/api/games/content?kind=crosswords")
      .then((res) => res.json() as Promise<{ data?: CrosswordPuzzle[] }>)
      .then((payload) => {
        if (payload?.data && Array.isArray(payload.data) && payload.data.length > 0) {
          setPuzzles(payload.data);
        }
      })
      .catch((err) => console.warn("Using fallback crosswords content", err));
  }, []);

  useEffect(() => {
    const updateCycle = () => {
      setCycleTimeLeft(getRemainingCycleTime());
    };
    const timeout = setTimeout(updateCycle, 0);
    const interval = setInterval(updateCycle, 60000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  // Derive model and 2D grid with useMemo & defensive boundary sizing
  const { gridMatrix, actualSize } = useMemo(() => {
    let computedSize = puzzle.size || 10;
    puzzle.clues.forEach((clue) => {
      const maxRow = clue.direction === "down" ? clue.row + clue.answer.length : clue.row + 1;
      const maxCol = clue.direction === "across" ? clue.col + clue.answer.length : clue.col + 1;
      if (maxRow > computedSize) computedSize = maxRow;
      if (maxCol > computedSize) computedSize = maxCol;
    });

    const matrix: (CellData | null)[][] = Array.from({ length: computedSize }, () =>
      Array.from({ length: computedSize }, () => null),
    );

    puzzle.clues.forEach((clue, clueIdx) => {
      const len = clue.answer.length;
      for (let i = 0; i < len; i++) {
        const r = clue.direction === "across" ? clue.row : clue.row + i;
        const c = clue.direction === "across" ? clue.col + i : clue.col;

        if (r >= 0 && r < computedSize && c >= 0 && c < computedSize && matrix[r]) {
          const existing = matrix[r][c] || { row: r, col: c, letter: clue.answer[i] };
          if (i === 0) {
            existing.number = clue.number;
          }
          if (clue.direction === "across") {
            existing.acrossClueIndex = clueIdx;
          } else {
            existing.downClueIndex = clueIdx;
          }
          matrix[r][c] = existing;
        }
      }
    });

    return { gridMatrix: matrix, actualSize: computedSize };
  }, [puzzle]);

  const [userGrid, setUserGrid] = useState<string[][]>(() =>
    Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "")),
  );
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({
    row: puzzle.clues[0]?.row ?? 0,
    col: puzzle.clues[0]?.col ?? 0,
  });
  const [direction, setDirection] = useState<"across" | "down">(puzzle.clues[0]?.direction ?? "across");

  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [gameCompleted, setGameCompleted] = useState<boolean>(false);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [checkedCells, setCheckedCells] = useState<Record<string, boolean>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const resetPuzzle = useCallback(() => {
    const nextSize = puzzle.size || 10;
    setUserGrid(
      Array.from({ length: nextSize }, () =>
        Array.from({ length: nextSize }, () => ""),
      ),
    );
    setSelectedCell({ row: puzzle.clues[0]?.row ?? 0, col: puzzle.clues[0]?.col ?? 0 });
    setDirection(puzzle.clues[0]?.direction ?? "across");
    setCheckedCells({});
    setHintsUsed(0);
    setHasStarted(false);
    setGameCompleted(false);
    setElapsedMs(0);
    startTimeRef.current = 0;
  }, [puzzle]);

  const handleStartPuzzle = () => {
    setHasStarted(true);
    setGameCompleted(false);
    setElapsedMs(0);
    startTimeRef.current = Date.now();
    inputRef.current?.focus();
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

  // Check victory condition
  const checkVictory = useCallback(
    (grid: string[][]) => {
      if (gameCompleted || !hasStarted) return;

      let allCorrect = true;
      for (let r = 0; r < gridMatrix.length; r++) {
        for (let c = 0; c < gridMatrix[r].length; c++) {
          const cell = gridMatrix[r][c];
          if (cell && grid[r]?.[c]?.toUpperCase() !== cell.letter.toUpperCase()) {
            allCorrect = false;
            break;
          }
        }
        if (!allCorrect) break;
      }

      if (allCorrect) {
        setGameCompleted(true);
        const finalTime = Math.max(1000, Date.now() - startTimeRef.current);
        const baseScore = 5000;
        const timePenalty = Math.floor((finalTime / 1000) * 8);
        const hintPenalty = hintsUsed * 250;
        const finalScore = Math.max(300, baseScore - timePenalty - hintPenalty);

        onFinishGame({
          gameId: "crossword",
          gameTitle: `Tech Crossword: ${puzzle.title}`,
          score: finalScore,
          timeMs: finalTime,
          moves: hintsUsed,
          levelData: `${puzzle.title} • ${puzzle.clues.length} Clues`,
        });
      }
    },
    [gameCompleted, hasStarted, gridMatrix, hintsUsed, onFinishGame, puzzle],
  );

  function handleCellClick(row: number, col: number) {
    if (!hasStarted || !gridMatrix[row]?.[col]) return;

    if (selectedCell.row === row && selectedCell.col === col) {
      setDirection((d) => (d === "across" ? "down" : "across"));
    } else {
      setSelectedCell({ row, col });
    }
    inputRef.current?.focus();
  }

  function advanceToNextCell(currentRow: number, currentCol: number) {
    let nextRow = currentRow;
    let nextCol = currentCol;

    if (direction === "across") {
      nextCol++;
    } else {
      nextRow++;
    }

    if (gridMatrix[nextRow]?.[nextCol]) {
      setSelectedCell({ row: nextRow, col: nextCol });
    }
  }

  function stepBackCell(currentRow: number, currentCol: number) {
    let prevRow = currentRow;
    let prevCol = currentCol;

    if (direction === "across") {
      prevCol--;
    } else {
      prevRow--;
    }

    if (gridMatrix[prevRow]?.[prevCol]) {
      setSelectedCell({ row: prevRow, col: prevCol });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!hasStarted || gameCompleted) return;

    const { row, col } = selectedCell;
    if (!gridMatrix[row]?.[col]) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (gridMatrix[row]?.[col + 1]) setSelectedCell({ row, col: col + 1 });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (gridMatrix[row]?.[col - 1]) setSelectedCell({ row, col: col - 1 });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (gridMatrix[row + 1]?.[col]) setSelectedCell({ row: row + 1, col });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (gridMatrix[row - 1]?.[col]) setSelectedCell({ row: row - 1, col });
    } else if (e.key === " " || e.key === "Tab") {
      e.preventDefault();
      setDirection((d) => (d === "across" ? "down" : "across"));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      const nextGrid = userGrid.map((r) => [...r]);
      if (nextGrid[row]?.[col]) {
        nextGrid[row][col] = "";
        setUserGrid(nextGrid);
      } else {
        stepBackCell(row, col);
      }
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      const letter = e.key.toUpperCase();
      const nextGrid = userGrid.map((r) => [...r]);
      if (!nextGrid[row]) {
        nextGrid[row] = Array.from({ length: actualSize }, () => "");
      }
      nextGrid[row][col] = letter;
      setUserGrid(nextGrid);
      advanceToNextCell(row, col);
      checkVictory(nextGrid);
    }
  }

  function handleClueClick(clue: CrosswordClue) {
    if (!hasStarted) return;
    setSelectedCell({ row: clue.row, col: clue.col });
    setDirection(clue.direction);
    inputRef.current?.focus();
  }

  function handleRevealLetter() {
    if (!hasStarted) return;
    const { row, col } = selectedCell;
    const cellData = gridMatrix[row]?.[col];
    if (!cellData) return;

    const nextGrid = userGrid.map((r) => [...r]);
    if (!nextGrid[row]) {
      nextGrid[row] = Array.from({ length: actualSize }, () => "");
    }
    nextGrid[row][col] = cellData.letter;
    setUserGrid(nextGrid);
    setHintsUsed((h) => h + 1);
    advanceToNextCell(row, col);
    checkVictory(nextGrid);
  }

  function handleCheckAll() {
    if (!hasStarted) return;
    const checks: Record<string, boolean> = {};
    for (let r = 0; r < gridMatrix.length; r++) {
      for (let c = 0; c < gridMatrix[r].length; c++) {
        const cell = gridMatrix[r][c];
        if (cell && userGrid[r]?.[c]) {
          checks[`${r},${c}`] = userGrid[r][c].toUpperCase() === cell.letter.toUpperCase();
        }
      }
    }
    setCheckedCells(checks);
  }

  const focusInput = () => {
    if (hasStarted) {
      inputRef.current?.focus();
    }
  };

  const seconds = Math.floor(elapsedMs / 1000);
  const timeFormatted = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  const activeClue = puzzle.clues.find((c) => {
    if (c.direction !== direction) return false;
    if (c.direction === "across") {
      return (
        selectedCell.row === c.row &&
        selectedCell.col >= c.col &&
        selectedCell.col < c.col + c.answer.length
      );
    } else {
      return (
        selectedCell.col === c.col &&
        selectedCell.row >= c.row &&
        selectedCell.row < c.row + c.answer.length
      );
    }
  });

  return (
    <div className="flex flex-col gap-6" onKeyDown={handleKeyDown}>
      <input
        ref={inputRef}
        type="text"
        className="opacity-0 absolute pointer-events-none w-0 h-0"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Top 24-Hour Cycle Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-paper/10 bg-surface p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--green)] animate-pulse shrink-0" />
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-paper">
              Daily Tech Crossword ({getFormattedDate()})
            </div>
            <div className="text-[11px] font-mono text-paper/60 mt-0.5">
              Next puzzle in: <span className="text-[var(--yellow)] font-bold">{cycleTimeLeft || "calculating..."}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRevealLetter}
            disabled={!hasStarted}
            className="rounded-xl border border-paper/10 bg-paper/[0.04] px-3 py-1.5 text-xs font-mono text-paper/80 hover:text-paper hover:bg-paper/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reveal Letter (-250 pts)
          </button>
          <button
            type="button"
            onClick={handleCheckAll}
            disabled={!hasStarted}
            className="rounded-xl border border-[var(--blue)]/40 bg-[var(--blue)]/10 px-3 py-1.5 text-xs font-mono text-[var(--blue-halftone)] hover:bg-[var(--blue)]/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Check Answers
          </button>
          <button
            type="button"
            onClick={resetPuzzle}
            className="rounded-xl border border-paper/20 bg-paper/10 px-3 py-1.5 text-xs font-mono text-paper hover:bg-paper/20 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Active Clue Bar banner */}
      <div className="rounded-2xl border border-[var(--blue)]/30 bg-[var(--blue)]/10 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--blue)] text-xs font-bold text-white font-mono shrink-0">
            {activeClue ? `${activeClue.number}${activeClue.direction[0].toUpperCase()}` : "—"}
          </span>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--blue-halftone)]">
              {direction.toUpperCase()} CLUE
            </div>
            <div className="text-xs sm:text-sm font-medium text-paper mt-0.5">
              {activeClue ? activeClue.clue : "Select a cell to view the clue"}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-mono uppercase text-paper/60">Time</div>
          <div className="text-base sm:text-lg font-bold font-mono text-paper">{hasStarted ? timeFormatted : "0:00"}</div>
        </div>
      </div>

      {/* Main Grid + Clues Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Crossword Interactive HTML Grid */}
        <div className="lg:col-span-6 flex flex-col items-center w-full">
          <div
            tabIndex={0}
            onClick={focusInput}
            className="relative w-full max-w-[480px] aspect-square rounded-2xl border-2 border-paper/20 bg-black/80 p-2.5 sm:p-3 shadow-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
          >
            <div
              className={`grid w-full h-full gap-1 transition-all duration-300 ${
                !hasStarted ? "filter blur-md opacity-40 pointer-events-none select-none" : ""
              }`}
              style={{
                gridTemplateColumns: `repeat(${actualSize}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${actualSize}, minmax(0, 1fr))`,
              }}
            >
              {gridMatrix.map((rowArr, r) =>
                rowArr.map((cell, c) => {
                  const key = `${r},${c}`;
                  const isActive = cell !== null;
                  const isSelected = selectedCell.row === r && selectedCell.col === c;
                  const isHighlightedInWord =
                    isActive &&
                    activeClue &&
                    ((activeClue.direction === "across" &&
                      r === activeClue.row &&
                      c >= activeClue.col &&
                      c < activeClue.col + activeClue.answer.length) ||
                      (activeClue.direction === "down" &&
                        c === activeClue.col &&
                        r >= activeClue.row &&
                        r < activeClue.row + activeClue.answer.length));

                  const checkStatus = checkedCells[key];

                  if (!cell) {
                    return (
                      <div
                        key={key}
                        className="rounded-md bg-ink/90 border border-paper/[0.04]"
                      />
                    );
                  }

                  return (
                    <div
                      key={key}
                      onClick={() => handleCellClick(r, c)}
                      className={`relative flex items-center justify-center rounded-md cursor-pointer select-none transition-all duration-100 ${
                        isSelected
                          ? "bg-[var(--blue)] text-white ring-2 ring-white z-20"
                          : isHighlightedInWord
                          ? "bg-[var(--blue)]/30 text-paper border border-[var(--blue)]/60"
                          : "bg-surface-raised text-paper border border-paper/20 hover:border-paper/60"
                      } ${
                        checkStatus === false
                          ? "ring-2 ring-[var(--red)]"
                          : checkStatus === true
                          ? "ring-2 ring-[var(--green)]"
                          : ""
                      }`}
                    >
                      {cell.number && (
                        <span className="absolute top-0.5 left-1 text-[8px] sm:text-[9px] font-mono leading-none text-paper/70 font-semibold">
                          {cell.number}
                        </span>
                      )}

                      <span className="text-sm sm:text-base md:text-lg font-bold font-mono uppercase">
                        {userGrid[r]?.[c] || ""}
                      </span>
                    </div>
                  );
                }),
              )}
            </div>

            {/* Start Puzzle Overlay if not started */}
            {!hasStarted && !gameCompleted && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-6 text-center animate-fade-in">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--green)]/20 text-[var(--green)] mb-3">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M3 12h18M3 19h18M7 3v18M17 3v18" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{puzzle.title}</h3>
                <p className="text-xs text-paper/70 mt-1 max-w-xs">
                  Solve {puzzle.clues.length} mixed Google, Android & Cloud clues in a {actualSize}×{actualSize} grid.
                </p>
                <button
                  type="button"
                  onClick={handleStartPuzzle}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--blue)] px-7 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-[var(--blue)]/30 hover:bg-[var(--blue)]/90 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Start Puzzle</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] text-paper/60 font-mono">
            <span>Click cell</span>
            <span>•</span>
            <span>Space/Tab to switch direction</span>
            <span>•</span>
            <span>Type to solve</span>
          </div>
        </div>

        {/* Clues Columns */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {/* ACROSS CLUES */}
          <div className="rounded-2xl border border-paper/10 bg-surface p-4 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--blue-halftone)] mb-3 pb-2 border-b border-paper/10 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span>Across Clues</span>
            </h3>
            <div className="flex flex-col gap-2">
              {puzzle.clues
                .filter((c) => c.direction === "across")
                .map((clue) => {
                  const isClueActive =
                    activeClue?.number === clue.number && activeClue?.direction === "across";
                  return (
                    <button
                      key={`${clue.number}-across`}
                      type="button"
                      onClick={() => handleClueClick(clue)}
                      className={`text-left rounded-xl p-2.5 transition-all text-xs cursor-pointer ${
                        isClueActive
                          ? "bg-[var(--blue)]/20 border border-[var(--blue)] text-paper shadow-sm"
                          : "hover:bg-paper/5 text-paper/80 border border-transparent"
                      }`}
                    >
                      <span className="font-mono font-bold text-[var(--blue)] mr-2">
                        {clue.number}.
                      </span>
                      <span>{clue.clue}</span>
                      <span className="block text-[10px] font-mono text-paper/40 mt-0.5">
                        ({clue.answer.length} letters)
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* DOWN CLUES */}
          <div className="rounded-2xl border border-paper/10 bg-surface p-4 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--green-halftone)] mb-3 pb-2 border-b border-paper/10 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span>Down Clues</span>
            </h3>
            <div className="flex flex-col gap-2">
              {puzzle.clues
                .filter((c) => c.direction === "down")
                .map((clue) => {
                  const isClueActive =
                    activeClue?.number === clue.number && activeClue?.direction === "down";
                  return (
                    <button
                      key={`${clue.number}-down`}
                      type="button"
                      onClick={() => handleClueClick(clue)}
                      className={`text-left rounded-xl p-2.5 transition-all text-xs cursor-pointer ${
                        isClueActive
                          ? "bg-[var(--green)]/20 border border-[var(--green)] text-paper shadow-sm"
                          : "hover:bg-paper/5 text-paper/80 border border-transparent"
                      }`}
                    >
                      <span className="font-mono font-bold text-[var(--green)] mr-2">
                        {clue.number}.
                      </span>
                      <span>{clue.clue}</span>
                      <span className="block text-[10px] font-mono text-paper/40 mt-0.5">
                        ({clue.answer.length} letters)
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
