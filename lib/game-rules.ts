/**
 * The rules of the four mini games, as pure functions.
 *
 * This is the single source of truth for how a game is set up, what counts as a
 * legal move, and how a finished run is scored. The SERVER runs it to decide a
 * score (app/api/games/session/*): the browser only sends what it did — a move
 * log, a filled grid, the typed text — and the server replays that against the
 * layout IT generated and measures time with ITS clock. A client that edits the
 * numbers in flight gains nothing, because it never sends any.
 *
 * The browser imports the same generators only for the offline "practice"
 * fallback (session request failed → play unranked), so both sides can never
 * disagree about what a valid game looks like.
 *
 * No I/O, no Node or DOM APIs — safe in a Worker, a route handler and a client
 * bundle. Anything secret (crossword answers) is only ever passed IN, never
 * exported as data from here.
 */

import { generateLocalParagraph } from "@/lib/typing-text";

export type GameId = "jigsaw" | "crossword" | "memory" | "typing";
export const GAME_IDS: readonly GameId[] = ["jigsaw", "crossword", "memory", "typing"];

export type GameResult = {
  gameId: GameId;
  gameTitle: string;
  score: number;
  timeMs: number;
  moves: number;
  levelData: string;
};

export type Verdict<T> = ({ ok: true } & T) | { ok: false; reason: string };

/* ------------------------------------------------------------------ RNG */

/** Small seeded PRNG (mulberry32): same seed, same sequence, everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const MAX_LOG_ENTRIES = 5000;

/* --------------------------------------------------------------- Jigsaw */

export const JIGSAW_SIZES: readonly number[] = [3, 4, 5];

/** A shuffled, unsolved, solvable board. `slide` = sliding-tile mode, where the
 *  last tile is the blank and only even-parity permutations can be solved. */
export function generateJigsawTiles(size: number, slide: boolean, rng: () => number): number[] {
  const count = size * size;
  let tiles: number[];
  do {
    tiles = shuffled(Array.from({ length: count }, (_, i) => i), rng);
    if (slide) {
      // Keep the blank (value count-1) where the shuffle put it, but fix parity so
      // it is solvable: count inversions ignoring the blank, then swap two tiles.
      const flat = tiles.filter((v) => v !== count - 1);
      let inversions = 0;
      for (let i = 0; i < flat.length; i++) {
        for (let j = i + 1; j < flat.length; j++) if (flat[i] > flat[j]) inversions++;
      }
      const blankRow = Math.floor(tiles.indexOf(count - 1) / size);
      const solvable =
        size % 2 === 1 ? inversions % 2 === 0 : (inversions + (size - 1 - blankRow)) % 2 === 0;
      if (!solvable) {
        const [a, b] = tiles.map((v, i) => [v, i] as const).filter(([v]) => v !== count - 1).slice(0, 2);
        [tiles[a[1]], tiles[b[1]]] = [tiles[b[1]], tiles[a[1]]];
      }
    }
  } while (tiles.every((v, i) => v === i));
  return tiles;
}

const isSolved = (tiles: readonly number[]) => tiles.every((v, i) => v === i);

/**
 * Replay a move log against the board the server dealt. A move is `[a, b]` in
 * swap mode (swap tiles at a and b) or `[i]` in slide mode (slide tile i into
 * the blank). Every move must be legal, the board must be unsolved until the
 * very last move, and solved after it.
 */
export function replayJigsaw(
  dealt: readonly number[],
  size: number,
  slide: boolean,
  log: unknown,
): Verdict<{ moves: number }> {
  if (!Array.isArray(log) || log.length === 0 || log.length > MAX_LOG_ENTRIES) return { ok: false, reason: "bad_move_log" };
  const count = size * size;
  const tiles = [...dealt];

  for (let n = 0; n < log.length; n++) {
    const move = log[n];
    if (isSolved(tiles)) return { ok: false, reason: "moves_after_solved" };
    if (!Array.isArray(move)) return { ok: false, reason: "bad_move" };

    if (slide) {
      const [i] = move;
      if (move.length !== 1 || !isInt(i) || i < 0 || i >= count) return { ok: false, reason: "bad_move" };
      const blank = tiles.indexOf(count - 1);
      const near =
        (Math.abs(Math.floor(i / size) - Math.floor(blank / size)) === 1 && i % size === blank % size) ||
        (Math.abs((i % size) - (blank % size)) === 1 && Math.floor(i / size) === Math.floor(blank / size));
      if (!near) return { ok: false, reason: "illegal_slide" };
      [tiles[i], tiles[blank]] = [tiles[blank], tiles[i]];
    } else {
      const [a, b] = move;
      if (move.length !== 2 || !isInt(a) || !isInt(b) || a === b || a < 0 || b < 0 || a >= count || b >= count) {
        return { ok: false, reason: "bad_move" };
      }
      [tiles[a], tiles[b]] = [tiles[b], tiles[a]];
    }
  }
  return isSolved(tiles) ? { ok: true, moves: log.length } : { ok: false, reason: "not_solved" };
}

export function jigsawScore(size: number, timeMs: number, moves: number): number {
  const base = size === 3 ? 3500 : size === 4 ? 6500 : 10000;
  return Math.max(250, base - Math.floor((timeMs / 1000) * 12) - moves * 15);
}

/* --------------------------------------------------------------- Memory */

export const MEMORY_PAIRS: readonly number[] = [6, 8, 12];

/** Card ids by board position: `pairs` distinct cards, each twice, shuffled. */
export function generateMemoryLayout(poolIds: readonly string[], pairs: number, rng: () => number): string[] {
  const chosen = shuffled(poolIds, rng).slice(0, pairs);
  return shuffled([...chosen, ...chosen], rng);
}

/**
 * Replay flips against the dealt layout. Each log entry is one attempt — two
 * distinct, still-hidden positions `[first, second]`. A match scores 300 × the
 * current streak and grows the streak; a miss resets it to 1.
 */
export function replayMemory(
  layout: readonly string[],
  log: unknown,
): Verdict<{ moves: number; points: number; maxStreak: number }> {
  if (!Array.isArray(log) || log.length === 0 || log.length > MAX_LOG_ENTRIES) return { ok: false, reason: "bad_flip_log" };
  const matched = new Set<number>();
  let combo = 1;
  let maxStreak = 1;
  let points = 0;
  const pairs = layout.length / 2;

  for (const attempt of log) {
    if (matched.size === layout.length) return { ok: false, reason: "flips_after_finish" };
    if (!Array.isArray(attempt) || attempt.length !== 2) return { ok: false, reason: "bad_flip" };
    const [a, b] = attempt;
    if (!isInt(a) || !isInt(b) || a === b || a < 0 || b < 0 || a >= layout.length || b >= layout.length) {
      return { ok: false, reason: "bad_flip" };
    }
    if (matched.has(a) || matched.has(b)) return { ok: false, reason: "flipped_matched_card" };
    if (layout[a] === layout[b]) {
      matched.add(a).add(b);
      points += 300 * combo;
      maxStreak = Math.max(maxStreak, combo);
      combo += 1;
    } else {
      combo = 1;
    }
  }
  return matched.size === pairs * 2 ? { ok: true, moves: log.length, points, maxStreak } : { ok: false, reason: "not_finished" };
}

export function memoryScore(points: number, pairs: number, timeMs: number): number {
  return Math.max(250, points + pairs * 400 - Math.floor((timeMs / 1000) * 10));
}

/* ------------------------------------------------------------ Crossword */

export type CrosswordClue = {
  number: number;
  direction: "across" | "down";
  clue: string;
  answer: string;
  row: number;
  col: number;
};

export type CrosswordPuzzle = {
  id: string;
  title: string;
  category: string;
  size: number;
  clues: CrosswordClue[];
};

/** What the browser is allowed to see: the grid and clues, never the letters. */
export type PublicCrosswordClue = Omit<CrosswordClue, "answer"> & { length: number };
export type PublicCrosswordPuzzle = Omit<CrosswordPuzzle, "clues"> & { clues: PublicCrosswordClue[] };

export function toPublicPuzzle(p: CrosswordPuzzle): PublicCrosswordPuzzle {
  return {
    id: p.id,
    title: p.title,
    category: p.category,
    size: p.size,
    clues: p.clues.map(({ answer, ...rest }) => ({ ...rest, length: answer.length })),
  };
}

const DAY_MS = 86_400_000;
/** The puzzle rolls over at midnight India time (IST, UTC+5:30), matching the event. */
const PUZZLE_DAY_OFFSET_MS = 330 * 60_000;

/** Same puzzle for everyone on a given day. */
export function dailyPuzzleIndex(poolLength: number, nowMs: number): number {
  if (!poolLength) return 0;
  return Math.floor((nowMs + PUZZLE_DAY_OFFSET_MS) / DAY_MS) % poolLength;
}

/** Milliseconds until the next puzzle. */
export function msUntilNextPuzzle(nowMs: number): number {
  return DAY_MS - ((nowMs + PUZZLE_DAY_OFFSET_MS) % DAY_MS);
}

/** "row,col" → letter. Where two clues cross, the first one wins — the same rule
 *  the board is drawn with. */
export function solutionLetters(p: CrosswordPuzzle): Map<string, string> {
  const cells = new Map<string, string>();
  for (const clue of p.clues) {
    for (let i = 0; i < clue.answer.length; i++) {
      const r = clue.direction === "across" ? clue.row : clue.row + i;
      const c = clue.direction === "across" ? clue.col + i : clue.col;
      const key = `${r},${c}`;
      if (!cells.has(key)) cells.set(key, clue.answer[i].toUpperCase());
    }
  }
  return cells;
}

function gridLetter(grid: unknown, r: number, c: number): string {
  if (!Array.isArray(grid) || !Array.isArray(grid[r])) return "";
  const v = grid[r][c];
  return typeof v === "string" ? v.toUpperCase() : "";
}

export function crosswordComplete(p: CrosswordPuzzle, grid: unknown): boolean {
  for (const [key, letter] of solutionLetters(p)) {
    const [r, c] = key.split(",").map(Number);
    if (gridLetter(grid, r, c) !== letter) return false;
  }
  return true;
}

/** Per-cell correctness for the cells the player has filled in. */
export function crosswordCheck(p: CrosswordPuzzle, grid: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, letter] of solutionLetters(p)) {
    const [r, c] = key.split(",").map(Number);
    const typed = gridLetter(grid, r, c);
    if (typed) out[key] = typed === letter;
  }
  return out;
}

export function crosswordScore(timeMs: number, hints: number): number {
  return Math.max(300, 5000 - Math.floor((timeMs / 1000) * 8) - hints * 250);
}

/* --------------------------------------------------------------- Typing */

export const TYPING_TIME_LIMITS: readonly number[] = [15, 30, 60];
export const TYPING_WORD_LIMITS: readonly number[] = [200, 400, 500];
export const MAX_WPM = 300;

/** Words the server deals for a run. Time Attack needs more than anyone can type
 *  in the window (60s at 360 WPM), so the text never has to grow mid-game. */
export function typingWordCount(mode: "time" | "words", timeLimit: number, wordLimit: number): number {
  return mode === "words" ? wordLimit : Math.min(500, Math.max(150, timeLimit * 6));
}

/** Correct characters, accuracy and WPM for `typed` against `target` over `timeMs`. */
export function typingStats(target: string, typed: string, timeMs: number) {
  let correct = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) correct++;
  const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;
  const minutes = timeMs / 60000;
  const wpm = minutes > 0 ? Math.round(correct / 5 / minutes) : 0;
  return { correct, accuracy, wpm, score: Math.round(wpm * (accuracy / 100) * 100) };
}

/** Local paragraph for the offline/unconfigured path (re-exported for the game). */
export { generateLocalParagraph };
