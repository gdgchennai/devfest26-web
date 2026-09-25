"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { GameScoreSubmission } from "./ScoreModal";
import type {
  PublicCrosswordPuzzle as CrosswordPuzzle,
  PublicCrosswordClue as CrosswordClue,
  WrongClue,
} from "@/lib/game-rules";
import { dailyPuzzleIndex, msUntilNextPuzzle } from "@/lib/game-rules";
import { gameApi } from "@/lib/games-client";
import { getOrFetchDailyCrossword } from "@/lib/crossword-client";

// Same rollover as the server (midnight IST): the puzzle it deals is today's.
function getRemainingCycleTime(): string {
  const diffSec = Math.max(0, Math.floor(msUntilNextPuzzle(Date.now()) / 1000));
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/** Index of today's puzzle. A helper (not inline in render) because it reads the clock. */
function todaysPuzzleIndex(poolLength: number): number {
  return dailyPuzzleIndex(poolLength, Date.now());
}

/** Shown until the puzzle list arrives. The answers never ship with the page — the
 *  browser only ever gets the grid and clues (see toPublicPuzzle). */
const LOADING_PUZZLE: CrosswordPuzzle = { id: "loading", title: "Loading today's puzzle…", category: "", size: 10, clues: [] };

type CellData = {
  row: number;
  col: number;
  number?: number;
  acrossClueIndex?: number;
  downClueIndex?: number;
};

type CrosswordGameProps = {
  onFinishGame: (submission: GameScoreSubmission) => void;
  onCycleTimeCalculated?: (time: string) => void;
};

export function CrosswordGame({
  onFinishGame,
  onCycleTimeCalculated,
}: CrosswordGameProps) {
  const [puzzles, setPuzzles] = useState<CrosswordPuzzle[]>([]);
  // The puzzle the server dealt for this run; it wins over our guess at "today's".
  const [dealtPuzzle, setDealtPuzzle] = useState<CrosswordPuzzle | null>(null);
  const dailyIdx = useMemo(() => todaysPuzzleIndex(puzzles.length), [puzzles.length]);
  const puzzle = dealtPuzzle || puzzles[dailyIdx] || puzzles[0] || LOADING_PUZZLE;

  // Client-first cache check from localStorage, then API
  useEffect(() => {
    getOrFetchDailyCrossword()
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setPuzzles(data);
        }
      })
      .catch((err) => console.warn("Using fallback crosswords content", err));
  }, []);

  useEffect(() => {
    const updateCycle = () => {
      const remaining = getRemainingCycleTime();
      onCycleTimeCalculated?.(remaining);
    };
    const timeout = setTimeout(updateCycle, 0);
    const interval = setInterval(updateCycle, 60000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [onCycleTimeCalculated]);

  // Derive model and 2D grid with useMemo & defensive boundary sizing
  const { gridMatrix, actualSize } = useMemo(() => {
    let computedSize = puzzle.size || 10;
    puzzle.clues.forEach((clue) => {
      const maxRow = clue.direction === "down" ? clue.row + clue.length : clue.row + 1;
      const maxCol = clue.direction === "across" ? clue.col + clue.length : clue.col + 1;
      if (maxRow > computedSize) computedSize = maxRow;
      if (maxCol > computedSize) computedSize = maxCol;
    });

    const matrix: (CellData | null)[][] = Array.from({ length: computedSize }, () =>
      Array.from({ length: computedSize }, () => null),
    );

    puzzle.clues.forEach((clue, clueIdx) => {
      const len = clue.length;
      for (let i = 0; i < len; i++) {
        const r = clue.direction === "across" ? clue.row : clue.row + i;
        const c = clue.direction === "across" ? clue.col + i : clue.col;

        if (r >= 0 && r < computedSize && c >= 0 && c < computedSize && matrix[r]) {
          const existing = matrix[r][c] || { row: r, col: c };
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
  const [checkedCells, setCheckedCells] = useState<Record<string, boolean>>({});
  const [checksLeft, setChecksLeft] = useState<number | null>(null);
  const [wrongClues, setWrongClues] = useState<WrongClue[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // The server-side run: it holds the answers, counts hints and checks, and scores.
  const sessionIdRef = useRef<string | null>(null);
  const finishingRef = useRef<boolean>(false);

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
    setChecksLeft(null);
    setWrongClues([]);
    setNotice(null);
    setHasStarted(false);
    setGameCompleted(false);
    setElapsedMs(0);
    startTimeRef.current = 0;
    sessionIdRef.current = null;
    finishingRef.current = false;
    setDealtPuzzle(null);
  }, [puzzle]);

  const handleStartPuzzle = async () => {
    if (isStarting || puzzle.id === "loading") return;
    setIsStarting(true);
    setNotice(null);
    // No offline mode here: without the answers on the page, only the server can tell
    // whether the grid is right, so the puzzle needs it to start.
    const started = await gameApi.startCrossword();
    setIsStarting(false);
    if (!started.ok) {
      setNotice("Couldn't reach the game server. Check your connection and try again.");
      return;
    }
    sessionIdRef.current = started.data.sessionId;
    finishingRef.current = false;
    setDealtPuzzle(started.data.puzzle);
    setChecksLeft(null);
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

  // Victory. The browser can't know the answers, so once every square is filled it asks
  // the server; a wrong grid just comes back "incorrect" and play carries on.
  const checkVictory = useCallback(
    (grid: string[][]) => {
      const sessionId = sessionIdRef.current;
      if (gameCompleted || !hasStarted || !sessionId || finishingRef.current) return;

      for (let r = 0; r < gridMatrix.length; r++) {
        for (let c = 0; c < gridMatrix[r].length; c++) {
          if (gridMatrix[r][c] && !grid[r]?.[c]) return;
        }
      }

      finishingRef.current = true;
      void gameApi.finish(sessionId, { grid }).then((done) => {
        finishingRef.current = false;
        if (done.ok) {
          setGameCompleted(true);
          setWrongClues([]);
          setNotice(null);
          onFinishGame({ ...done.data.result, sessionId });
        } else if (done.reason === "incorrect") {
          if (done.wrongClues) setWrongClues(done.wrongClues);
          setNotice("Grid completed, but some answers are incorrect. Review the highlighted rows and columns.");
        } else if (done.reason === "too_many_attempts") {
          if (done.wrongClues) setWrongClues(done.wrongClues);
          setNotice("Too many wrong submissions for this run. Reset the puzzle to try again.");
        } else {
          setNotice("The server couldn't accept this run. Reset the puzzle to try again.");
        }
      });
    },
    [gameCompleted, hasStarted, gridMatrix, onFinishGame],
  );

  function handleCellClick(row: number, col: number) {
    if (!hasStarted || !gridMatrix[row]?.[col]) return;
    const cell = gridMatrix[row][col];
    const hasAcross = cell.acrossClueIndex !== undefined;
    const hasDown = cell.downClueIndex !== undefined;

    // 1. If clicking the already selected cell, toggle direction ONLY IF the cell supports both directions
    if (selectedCell.row === row && selectedCell.col === col) {
      if (hasAcross && hasDown) {
        setDirection((d) => (d === "across" ? "down" : "across"));
      }
      inputRef.current?.focus();
      return;
    }

    // 2. If clicking a cell that belongs to the currently active clue, KEEP the active clue's direction
    const inCurrentClue =
      activeClue &&
      ((direction === "across" &&
        row === activeClue.row &&
        col >= activeClue.col &&
        col < activeClue.col + activeClue.length) ||
        (direction === "down" &&
          col === activeClue.col &&
          row >= activeClue.row &&
          row < activeClue.row + activeClue.length));

    if (inCurrentClue) {
      // Cell is part of the currently selected clue — stay in this direction
    } else if (hasAcross && !hasDown) {
      setDirection("across");
    } else if (hasDown && !hasAcross) {
      setDirection("down");
    }

    setSelectedCell({ row, col });
    inputRef.current?.focus();
  }

  function advanceToNextCell(currentRow: number, currentCol: number) {
    // If we have an active clue, advance strictly within that clue's consecutive boxes
    if (activeClue) {
      if (direction === "across") {
        const nextCol = currentCol + 1;
        if (nextCol < activeClue.col + activeClue.length) {
          setSelectedCell({ row: currentRow, col: nextCol });
          return;
        }
      } else {
        const nextRow = currentRow + 1;
        if (nextRow < activeClue.row + activeClue.length) {
          setSelectedCell({ row: nextRow, col: currentCol });
          return;
        }
      }
    }

    // Fallback if at edge or no active clue
    const nextRow = direction === "down" ? currentRow + 1 : currentRow;
    const nextCol = direction === "across" ? currentCol + 1 : currentCol;
    if (gridMatrix[nextRow]?.[nextCol]) {
      setSelectedCell({ row: nextRow, col: nextCol });
    }
  }

  function stepBackCell(currentRow: number, currentCol: number) {
    if (activeClue) {
      if (direction === "across") {
        const prevCol = currentCol - 1;
        if (prevCol >= activeClue.col) {
          setSelectedCell({ row: currentRow, col: prevCol });
          return;
        }
      } else {
        const prevRow = currentRow - 1;
        if (prevRow >= activeClue.row) {
          setSelectedCell({ row: prevRow, col: currentCol });
          return;
        }
      }
    }

    const prevRow = direction === "down" ? currentRow - 1 : currentRow;
    const prevCol = direction === "across" ? currentCol - 1 : currentCol;
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
      const cell = gridMatrix[row][col];
      if (cell.acrossClueIndex !== undefined && cell.downClueIndex !== undefined) {
        setDirection((d) => (d === "across" ? "down" : "across"));
      }
    } else if (e.key === "Backspace") {
      e.preventDefault();
      const nextGrid = userGrid.map((r) => [...r]);
      const currentVal = nextGrid[row]?.[col] || "";
      if (currentVal !== "") {
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
    setDirection(clue.direction);
    setSelectedCell({ row: clue.row, col: clue.col });
    inputRef.current?.focus();
  }

  async function handleRevealLetter() {
    const sessionId = sessionIdRef.current;
    if (!hasStarted || !sessionId) return;
    const { row, col } = selectedCell;
    if (!gridMatrix[row]?.[col]) return;

    // The server holds the letter, and counts the hint against the score.
    const res = await gameApi.hint(sessionId, row, col);
    if (!res.ok) {
      setNotice("Couldn't reveal that letter right now.");
      return;
    }
    const nextGrid = userGrid.map((r) => [...r]);
    if (!nextGrid[row]) {
      nextGrid[row] = Array.from({ length: actualSize }, () => "");
    }
    nextGrid[row][col] = res.data.letter;
    setUserGrid(nextGrid);
    advanceToNextCell(row, col);
    checkVictory(nextGrid);
  }

  async function handleCheckAll() {
    const sessionId = sessionIdRef.current;
    if (!hasStarted || !sessionId) return;
    const res = await gameApi.check(sessionId, userGrid);
    if (!res.ok) {
      if (res.error === "check_limit") {
        setChecksLeft(0);
        setNotice("No checks left for this run.");
      }
      return;
    }
    setCheckedCells(res.data.results);
    setChecksLeft(res.data.checksLeft);
    if (res.data.wrongClues) {
      setWrongClues(res.data.wrongClues);
      if (res.data.wrongClues.length > 0) {
        setNotice("Some answers are still incorrect. Highlighted rows and columns need review.");
      } else {
        setNotice(null);
      }
    }
  }

  const focusInput = () => {
    if (hasStarted) {
      inputRef.current?.focus();
    }
  };

  const seconds = Math.floor(elapsedMs / 1000);
  const timeFormatted = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  // Entire row or column cells that have mistakes (without revealing letters)
  const errorCells = useMemo(() => {
    const set = new Set<string>();
    for (const wc of wrongClues) {
      for (let i = 0; i < wc.length; i++) {
        const r = wc.direction === "across" ? wc.row : wc.row + i;
        const c = wc.direction === "across" ? wc.col + i : wc.col;
        set.add(`${r},${c}`);
      }
    }
    return set;
  }, [wrongClues]);

  const activeClue = puzzle.clues.find((c) => {
    if (c.direction !== direction) return false;
    if (c.direction === "across") {
      return (
        selectedCell.row === c.row &&
        selectedCell.col >= c.col &&
        selectedCell.col < c.col + c.length
      );
    } else {
      return (
        selectedCell.col === c.col &&
        selectedCell.row >= c.row &&
        selectedCell.row < c.row + c.length
      );
    }
  });

  return (
    <div className="flex flex-col gap-5" onKeyDown={handleKeyDown}>
      <input
        ref={inputRef}
        type="text"
        value=""
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        className="opacity-0 absolute -top-[9999px] left-0 w-1 h-1 pointer-events-none"
        aria-hidden="true"
        tabIndex={-1}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      {/* Active Clue Bar banner */}
      <div className="rounded-2xl border border-blue/30 bg-blue/10 p-3.5 sm:p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue text-xs font-bold text-white shrink-0">
            {activeClue ? `${activeClue.number}${activeClue.direction[0].toUpperCase()}` : "—"}
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-blue-halftone">
              {direction.toUpperCase()} CLUE
            </div>
            <div className="text-xs sm:text-sm font-medium text-paper truncate sm:whitespace-normal mt-0.5">
              {activeClue ? activeClue.clue : "Select a cell to view the clue"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleRevealLetter}
            disabled={!hasStarted}
            className="hidden sm:inline-flex rounded-xl border border-paper/10 bg-paper/[0.04] px-2.5 py-1 text-xs text-paper/80 hover:text-paper hover:bg-paper/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reveal Letter
          </button>
          <button
            type="button"
            onClick={handleCheckAll}
            disabled={!hasStarted || checksLeft === 0}
            className="hidden sm:inline-flex rounded-xl border border-blue/40 bg-blue/10 px-2.5 py-1 text-xs text-blue-halftone hover:bg-blue/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {checksLeft === null ? "Check" : `Check (${checksLeft})`}
          </button>
          <button
            type="button"
            onClick={resetPuzzle}
            disabled={!hasStarted}
            className="hidden sm:inline-flex rounded-xl border border-paper/10 bg-paper/[0.04] px-2.5 py-1 text-xs text-paper/80 hover:text-paper hover:bg-paper/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reset
          </button>
          <div className="text-right">
            <div className="text-[10px] uppercase text-paper/60">Time</div>
            <div className="text-base sm:text-lg font-bold text-paper">{hasStarted ? timeFormatted : "0:00"}</div>
          </div>
        </div>
      </div>

      {hasStarted && notice && (
        <div role="status" className="rounded-xl border border-red/30 bg-red/10 px-3 py-2 text-xs text-red">
          {notice}
        </div>
      )}

      {/* Main Grid + Clues Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Crossword Interactive HTML Grid */}
        <div className="lg:col-span-6 flex flex-col items-center w-full">
          <div
            tabIndex={0}
            onClick={focusInput}
            onKeyDown={handleKeyDown}
            className="relative w-full max-w-[480px] aspect-square rounded-2xl border-2 border-paper/20 bg-ink/80 p-2.5 sm:p-3 shadow-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue"
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
                      c < activeClue.col + activeClue.length) ||
                      (activeClue.direction === "down" &&
                        c === activeClue.col &&
                        r >= activeClue.row &&
                        r < activeClue.row + activeClue.length));

                  const checkStatus = checkedCells[key];
                  const isCellError = errorCells.has(key);

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
                          ? isCellError
                            ? "bg-red/40 text-white ring-2 ring-red z-20"
                            : "bg-blue text-white ring-2 ring-paper z-20"
                          : isHighlightedInWord
                          ? isCellError
                            ? "bg-red/25 text-paper border border-red/60"
                            : "bg-blue/30 text-paper border border-blue/60"
                          : isCellError
                          ? "bg-red/15 text-paper border border-red/50 shadow-[0_0_8px_rgba(234,67,53,0.3)]"
                          : "bg-surface-raised text-paper border border-paper/20 hover:border-paper/60"
                      } ${
                        checkStatus === false
                          ? "ring-2 ring-red"
                          : checkStatus === true
                          ? "ring-2 ring-green"
                          : ""
                      }`}
                    >
                      {cell.number && (
                        <span className="absolute top-0.5 left-1 text-[8px] sm:text-[9px] leading-none text-paper/70 font-semibold">
                          {cell.number}
                        </span>
                      )}

                      <span className="text-sm sm:text-base md:text-lg font-bold uppercase">
                        {userGrid[r]?.[c] || ""}
                      </span>
                    </div>
                  );
                }),
              )}
            </div>

            {/* Start Puzzle Overlay if not started */}
            {!hasStarted && !gameCompleted && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-ink/60 backdrop-blur-sm p-6 text-center animate-fade-in">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green/20 text-green mb-3">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M3 12h18M3 19h18M7 3v18M17 3v18" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-paper tracking-tight">{puzzle.title}</h3>
                <p className="text-xs text-paper/70 mt-1 max-w-xs">
                  Solve {puzzle.clues.length} mixed Google, Android & Cloud clues in a {actualSize}×{actualSize} grid.
                </p>
                {notice && <p className="mt-3 max-w-xs text-xs text-red">{notice}</p>}
                <button
                  type="button"
                  onClick={handleStartPuzzle}
                  disabled={isStarting || puzzle.id === "loading"}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue px-7 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue/30 hover:bg-blue/90 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:hover:scale-100"
                >
                  <span>{isStarting ? "Dealing…" : "Start Puzzle"}</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] text-paper/60">
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
            <h3 className="text-xs uppercase tracking-wider text-blue-halftone mb-3 pb-2 border-b border-paper/10 flex items-center gap-2">
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
                  const isClueWrong = wrongClues.some(
                    (wc) => wc.number === clue.number && wc.direction === "across",
                  );
                  return (
                    <button
                      key={`${clue.number}-across`}
                      type="button"
                      onClick={() => handleClueClick(clue)}
                      className={`text-left rounded-xl p-2.5 transition-all text-xs cursor-pointer ${
                        isClueActive
                          ? isClueWrong
                            ? "bg-red/20 border border-red text-paper shadow-sm"
                            : "bg-blue/20 border border-blue text-paper shadow-sm"
                          : isClueWrong
                          ? "bg-red/10 border border-red/40 text-paper/90 hover:bg-red/15"
                          : "hover:bg-paper/5 text-paper/80 border border-transparent"
                      }`}
                    >
                      <span className={`font-bold mr-2 ${isClueWrong ? "text-red" : "text-blue"}`}>
                        {clue.number}.
                      </span>
                      <span>{clue.clue}</span>
                      {isClueWrong && (
                        <span className="ml-2 text-[10px] font-mono text-red font-semibold uppercase">
                          [Incorrect]
                        </span>
                      )}
                      <span className="block text-[10px] text-paper/40 mt-0.5">
                        ({clue.length} letters)
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* DOWN CLUES */}
          <div className="rounded-2xl border border-paper/10 bg-surface p-4 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            <h3 className="text-xs uppercase tracking-wider text-green-halftone mb-3 pb-2 border-b border-paper/10 flex items-center gap-2">
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
                  const isClueWrong = wrongClues.some(
                    (wc) => wc.number === clue.number && wc.direction === "down",
                  );
                  return (
                    <button
                      key={`${clue.number}-down`}
                      type="button"
                      onClick={() => handleClueClick(clue)}
                      className={`text-left rounded-xl p-2.5 transition-all text-xs cursor-pointer ${
                        isClueActive
                          ? isClueWrong
                            ? "bg-red/20 border border-red text-paper shadow-sm"
                            : "bg-green/20 border border-green text-paper shadow-sm"
                          : isClueWrong
                          ? "bg-red/10 border border-red/40 text-paper/90 hover:bg-red/15"
                          : "hover:bg-paper/5 text-paper/80 border border-transparent"
                      }`}
                    >
                      <span className={`font-bold mr-2 ${isClueWrong ? "text-red" : "text-green"}`}>
                        {clue.number}.
                      </span>
                      <span>{clue.clue}</span>
                      {isClueWrong && (
                        <span className="ml-2 text-[10px] font-mono text-red font-semibold uppercase">
                          [Incorrect]
                        </span>
                      )}
                      <span className="block text-[10px] text-paper/40 mt-0.5">
                        ({clue.length} letters)
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
