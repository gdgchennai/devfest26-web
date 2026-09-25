/**
 * Browser side of the game-session API (app/api/games/session).
 *
 * The games never compute a score that counts. They start a run (the server deals
 * it and starts the clock), play it, then send the server what they DID — the move
 * log, the filled grid, the typed text — and show whatever result comes back.
 *
 * If the server can't be reached the games fall back to a local, unranked practice
 * run (no `sessionId` on the result), so a network blip never blocks playing.
 */
import type { GameResult, PublicCrosswordPuzzle, WrongClue } from "@/lib/game-rules";

export type ApiFailure = {
  ok: false;
  status: number;
  error: string;
  reason?: string;
  checksLeft?: number;
  wrongClues?: WrongClue[];
};
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

async function post<T>(url: string, body: unknown, timeoutMs = 8000): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: String(json.error ?? "request_failed"),
        reason: typeof json.reason === "string" ? json.reason : undefined,
        checksLeft: typeof json.checksLeft === "number" ? json.checksLeft : undefined,
        wrongClues: Array.isArray(json.wrongClues) ? (json.wrongClues as WrongClue[]) : undefined,
      };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: "network_error" };
  }
}

export type FinishData = { ok: true; sessionId: string; result: GameResult };

export const gameApi = {
  startJigsaw: (gridSize: number, slide: boolean) =>
    post<{ sessionId: string; tiles: number[] }>("/api/games/session", { gameId: "jigsaw", config: { gridSize, slide } }),

  startMemory: (pairs: number) => post<{ sessionId: string; layout: string[] }>("/api/games/session", { gameId: "memory", config: { pairs } }),

  startCrossword: () => post<{ sessionId: string; puzzle: PublicCrosswordPuzzle }>("/api/games/session", { gameId: "crossword", config: {} }),

  // Longer timeout: dealing the text may wait on Gemini.
  startTyping: (mode: "time" | "words", timeLimit: number, wordLimit: number) =>
    post<{ sessionId: string; text: string }>("/api/games/session", { gameId: "typing", config: { mode, timeLimit, wordLimit } }, 12000),

  begin: (sessionId: string) => post<{ ok: true }>("/api/games/session/begin", { sessionId }),

  hint: (sessionId: string, row: number, col: number) =>
    post<{ letter: string; hints: number }>("/api/games/session/hint", { sessionId, row, col }),

  check: (sessionId: string, grid: string[][]) =>
    post<{ results: Record<string, boolean>; checksLeft: number; wrongClues?: WrongClue[] }>(
      "/api/games/session/check",
      { sessionId, grid },
    ),

  finish: (sessionId: string, evidence: Record<string, unknown>) => post<FinishData>("/api/games/session/finish", { sessionId, evidence }),
};
