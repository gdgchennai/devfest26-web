"use client";

import { useState, useEffect, useRef } from "react";
import initialTechCards from "@/content/tech-cards.json";
import type { GameScoreSubmission } from "./ScoreModal";
import type { TechCardDefinition } from "@/lib/games-content";
import { generateMemoryLayout, memoryScore } from "@/lib/game-rules";
import { gameApi } from "@/lib/games-client";

type CardInstance = {
  instanceId: string;
  cardId: string;
  name: string;
  subtitle: string;
  icon: string;
  accent: string;
  isFlipped: boolean;
  isMatched: boolean;
};

// Deterministic initial deck for SSR to avoid hydration mismatch
function getInitialDeck(pool: TechCardDefinition[], count: number): CardInstance[] {
  const selectedDefinitions = (pool.length >= count ? pool : (initialTechCards as TechCardDefinition[])).slice(0, count);
  const deck: CardInstance[] = [];
  selectedDefinitions.forEach((def) => {
    deck.push({
      instanceId: `${def.id}-a`,
      cardId: def.id,
      name: def.name,
      subtitle: def.subtitle,
      icon: def.icon,
      accent: def.accent,
      isFlipped: false,
      isMatched: false,
    });
    deck.push({
      instanceId: `${def.id}-b`,
      cardId: def.id,
      name: def.name,
      subtitle: def.subtitle,
      icon: def.icon,
      accent: def.accent,
      isFlipped: false,
      isMatched: false,
    });
  });
  return deck;
}

/** The board for a dealt layout (card ids by position). Each card id appears twice. */
function deckFromLayout(pool: TechCardDefinition[], layout: string[]): CardInstance[] {
  const seen = new Map<string, number>();
  return layout.map((cardId) => {
    const def = pool.find((c) => c.id === cardId) ?? (initialTechCards as TechCardDefinition[]).find((c) => c.id === cardId);
    const copy = seen.get(cardId) ?? 0;
    seen.set(cardId, copy + 1);
    return {
      instanceId: `${cardId}-${copy === 0 ? "a" : "b"}`,
      cardId,
      name: def?.name ?? cardId,
      subtitle: def?.subtitle ?? "",
      icon: def?.icon ?? "",
      accent: def?.accent ?? "",
      isFlipped: false,
      isMatched: false,
    };
  });
}

type MemoryGameProps = {
  onFinishGame: (submission: GameScoreSubmission) => void;
  pairsCount?: number;
};

export function MemoryGame({
  onFinishGame,
  pairsCount: externalPairsCount = 8,
}: MemoryGameProps) {
  const [cardsPool, setCardsPool] = useState<TechCardDefinition[]>(initialTechCards as TechCardDefinition[]);
  const pairsCount = externalPairsCount;
  const [cards, setCards] = useState<CardInstance[]>(() => getInitialDeck(initialTechCards as TechCardDefinition[], externalPairsCount));
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [combo, setCombo] = useState<number>(1);
  const [maxCombo, setMaxCombo] = useState<number>(1);
  const [score, setScore] = useState<number>(0);

  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [gameCompleted, setGameCompleted] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const lockBoardRef = useRef<boolean>(false);
  // The server-side run this board belongs to (null → offline practice) and every
  // pair the player tried, in order — the evidence the server scores.
  const sessionIdRef = useRef<string | null>(null);
  const flipLogRef = useRef<number[][]>([]);
  const comboRunRef = useRef<{ combo: number; points: number; maxStreak: number }>({ combo: 1, points: 0, maxStreak: 1 });
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // API-first fetch for card definitions
  useEffect(() => {
    fetch("/api/games/content?kind=cards")
      .then((res) => res.json() as Promise<{ data?: TechCardDefinition[] }>)
      .then((payload) => {
        if (payload?.data && Array.isArray(payload.data) && payload.data.length > 0) {
          setCardsPool(payload.data);
        }
      })
      .catch((err) => console.warn("Using fallback cards content", err));
  }, []);

  const handleStartGame = async () => {
    if (isStarting) return;
    setIsStarting(true);
    // The server deals the layout and starts the clock; if it can't be reached we deal
    // locally and play an unranked practice run.
    const started = await gameApi.startMemory(pairsCount);
    sessionIdRef.current = started.ok ? started.data.sessionId : null;
    flipLogRef.current = [];
    comboRunRef.current = { combo: 1, points: 0, maxStreak: 1 };
    const layout = started.ok
      ? started.data.layout
      : generateMemoryLayout(
          (cardsPool.length >= pairsCount ? cardsPool : (initialTechCards as TechCardDefinition[])).map((c) => c.id),
          pairsCount,
          Math.random,
        );
    setCards(deckFromLayout(cardsPool, layout));
    setIsStarting(false);
    setHasStarted(true);
    setGameCompleted(false);
    setElapsedMs(0);
    const now = Date.now();
    startTimeRef.current = now;
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

  // Handle card click
  /** Enter / Space flip the card; arrows move between cards, so the board isn't 24 Tab stops. */
  function handleCardKeyDown(e: React.KeyboardEvent<HTMLDivElement>, index: number) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(index);
      return;
    }
    const columns = pairsCount === 12 ? 6 : 4;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!(e.key in step)) return;
    const next = index + step[e.key];
    if (next < 0 || next >= cards.length) return;
    e.preventDefault();
    e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-card-index="${next}"]`)?.focus();
  }

  function handleCardClick(index: number) {
    if (!hasStarted || lockBoardRef.current || gameCompleted) return;
    const card = cards[index];
    if (card.isFlipped || card.isMatched) return;

    const nextCards = [...cards];
    nextCards[index] = { ...card, isFlipped: true };
    setCards(nextCards);

    const nextFlipped = [...flippedIndices, index];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      lockBoardRef.current = true;

      const [firstIdx, secondIdx] = nextFlipped;
      flipLogRef.current.push([firstIdx, secondIdx]);
      const firstCard = nextCards[firstIdx];
      const secondCard = nextCards[secondIdx];

      if (firstCard.cardId === secondCard.cardId) {
        setTimeout(() => {
          setCards((prev) => {
            const matched = [...prev];
            matched[firstIdx] = { ...matched[firstIdx], isMatched: true };
            matched[secondIdx] = { ...matched[secondIdx], isMatched: true };
            return matched;
          });

          const nextMatched = matchedPairs + 1;
          setMatchedPairs(nextMatched);

          const comboMultiplier = combo;
          const pointsEarned = 300 * comboMultiplier;
          setScore((s) => s + pointsEarned);
          setCombo((c) => {
            const nextC = c + 1;
            if (nextC > maxCombo) setMaxCombo(nextC);
            return nextC;
          });
          // Same streak arithmetic as the server's replay, kept for the offline fallback.
          const run = comboRunRef.current;
          run.points += pointsEarned;
          run.maxStreak = Math.max(run.maxStreak, run.combo);
          run.combo += 1;

          setFlippedIndices([]);
          lockBoardRef.current = false;

          if (nextMatched === pairsCount) {
            setGameCompleted(true);
            const log = flipLogRef.current;
            const sessionId = sessionIdRef.current;
            void (async () => {
              let unranked: "offline" | "rejected" = "offline";
              if (sessionId) {
                const done = await gameApi.finish(sessionId, { flips: log });
                if (done.ok) {
                  onFinishGame({ ...done.data.result, sessionId });
                  return;
                }
                unranked = done.status === 0 ? "offline" : "rejected";
              }
              // Offline (or the server refused): show a local, unranked result.
              const timeMs = Math.max(1000, Date.now() - startTimeRef.current);
              onFinishGame({
                gameId: "memory",
                gameTitle: "Tech Memory Matrix",
                score: memoryScore(run.points, pairsCount, timeMs),
                timeMs,
                moves: log.length,
                levelData: `${pairsCount * 2} Cards • Max Streak ${run.maxStreak}x`,
                unranked,
              });
            })();
          }
        }, 350);
      } else {
        setTimeout(() => {
          setCards((prev) => {
            const reset = [...prev];
            reset[firstIdx] = { ...reset[firstIdx], isFlipped: false };
            reset[secondIdx] = { ...reset[secondIdx], isFlipped: false };
            return reset;
          });
          setCombo(1);
          comboRunRef.current.combo = 1;
          setFlippedIndices([]);
          lockBoardRef.current = false;
        }, 750);
      }
    }
  }

  // Read out for screen readers: cards flip visually, so say what is face up and the progress.
  const faceUp = cards.filter((c) => c.isFlipped && !c.isMatched);
  const pairsFound = cards.filter((c) => c.isMatched).length / 2;
  const boardStatus = `${faceUp.length ? `${faceUp.map((c) => c.name).join(" and ")} face up. ` : ""}${pairsFound} of ${cards.length / 2} pairs matched.`;

  const seconds = Math.floor(elapsedMs / 1000);
  const timeFormatted = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-3 sm:gap-4 max-w-3xl mx-auto w-full">
      {/* Live Stats Bar */}
      <div className="flex items-center justify-around sm:justify-between gap-2.5 rounded-2xl border border-paper/10 bg-surface px-4 py-2.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-paper/50">Score:</span>
          <span className="font-bold text-blue-halftone text-sm">{score}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-paper/50">Streak:</span>
          <span className="font-bold text-yellow text-sm">{combo > 1 ? `${combo}x` : "1x"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-paper/50">Pairs:</span>
          <span className="font-bold text-green text-sm">
            {matchedPairs}/{pairsCount}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-paper/50">Time:</span>
          <span className="font-bold text-paper text-sm">{hasStarted ? timeFormatted : "0:00"}</span>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {hasStarted ? boardStatus : ""}
      </p>

      {/* Uniform Gap Cards Playground */}
      <div className="relative w-full h-[min(65vh,520px)] sm:h-[min(62vh,540px)] flex items-center justify-center">
        {/* Cards Grid with Equal Row & Column Spacing */}
        <div
          className={`grid gap-2 sm:gap-3 p-1 transition-all duration-300 justify-center items-center max-w-full ${
            !hasStarted ? "filter blur-md opacity-40 pointer-events-none select-none" : ""
          } ${
            pairsCount === 6
              ? "grid-cols-4 grid-rows-3"
              : pairsCount === 8
              ? "grid-cols-4 grid-rows-4"
              : "grid-cols-6 grid-rows-4"
          }`}
          style={{
            width: "fit-content",
            height: "fit-content",
            maxHeight: "100%",
          }}
        >
          {cards.map((card, idx) => {
            const isOpen = card.isFlipped || card.isMatched;

            return (
              <div
                key={card.instanceId}
                data-card-index={idx}
                role="button"
                tabIndex={hasStarted && !card.isMatched ? 0 : -1}
                aria-label={
                  card.isMatched
                    ? `${card.name}, matched`
                    : card.isFlipped
                      ? `${card.name}, face up`
                      : `Card ${idx + 1} of ${cards.length}, face down`
                }
                aria-disabled={!hasStarted || card.isFlipped || card.isMatched}
                onClick={() => handleCardClick(idx)}
                onKeyDown={(e) => handleCardKeyDown(e, idx)}
                className={`relative aspect-[3/4] cursor-pointer select-none group rounded-xl sm:rounded-2xl ${
                  pairsCount === 12
                    ? "w-[min(13vw,84px)] h-[min(12vh,112px)] sm:w-[min(14vw,95px)] sm:h-[min(13vh,126px)]"
                    : pairsCount === 8
                    ? "w-[min(20vw,105px)] h-[min(13.5vh,140px)] sm:w-[min(18vw,120px)] sm:h-[min(14vh,160px)]"
                    : "w-[min(20vw,115px)] h-[min(16vh,152px)] sm:w-[min(18vw,130px)] sm:h-[min(17vh,172px)]"
                }`}
                style={{ perspective: "1000px" }}
              >
                <div
                  className="relative w-full h-full rounded-xl sm:rounded-2xl"
                  style={{
                    transformStyle: "preserve-3d",
                    transition: "transform 0.35s ease-out",
                    transform: isOpen ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* Front face (Card Back Cover) */}
                  <div
                    className="absolute inset-0 rounded-xl sm:rounded-2xl border border-paper/20 bg-surface-raised flex flex-col items-center justify-center p-1 sm:p-2 text-center shadow-md group-hover:border-paper/40 group-hover:shadow-[0_0_12px_rgba(66,133,244,0.2)]"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                  >
                    <div className="flex gap-0.5 sm:gap-1 mb-1 sm:mb-1.5">
                      <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-blue" />
                      <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-red" />
                      <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-yellow" />
                      <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-green" />
                    </div>
                    <span className="text-sm sm:text-lg font-bold text-paper/70 tracking-tight">
                      &lt;/&gt;
                    </span>
                    <span className="mt-0.5 sm:mt-1 text-[7px] sm:text-[9px] text-paper/40 uppercase tracking-wider font-semibold">
                      DevFest
                    </span>
                  </div>

                  {/* Back face (Card Revealed Content) */}
                  <div
                    className="absolute inset-0 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-center p-1 sm:p-2 text-center shadow-lg bg-surface-raised"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      borderColor: card.isMatched ? "var(--green)" : card.accent,
                      boxShadow: card.isMatched
                        ? "0 0 15px color-mix(in srgb, var(--green) 25%, transparent)"
                        : `0 0 10px ${card.accent}33`,
                    }}
                  >
                    <span className="text-lg sm:text-2xl md:text-3xl mb-0.5">{card.icon}</span>
                    <span className="text-[9px] sm:text-xs font-bold text-paper line-clamp-1">
                      {card.name}
                    </span>
                    <span className="text-[7px] sm:text-[9px] text-paper/60 leading-none mt-0.5 line-clamp-1 hidden sm:block">
                      {card.subtitle}
                    </span>
                    {card.isMatched && (
                      <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-green/20 px-1 py-0.1 text-[7px] sm:text-[8px] font-bold text-green">
                        Matched
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Start Game Overlay if not started */}
        {!hasStarted && !gameCompleted && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-ink/60 backdrop-blur-sm p-6 text-center rounded-3xl animate-fade-in">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow/20 text-yellow mb-3">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v10M16 7v10" />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-paper tracking-tight">Memory Matrix</h3>
            <p className="text-xs text-paper/70 mt-1 max-w-xs">
              Flip and match {pairsCount} pairs of Android and Google tech stacks.
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
      </div>
    </div>
  );
}
