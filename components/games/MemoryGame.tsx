"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import initialTechCards from "@/content/tech-cards.json";
import type { GameScoreSubmission } from "./ScoreModal";
import type { TechCardDefinition } from "@/lib/games-content";

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

function generateShuffledDeck(pool: TechCardDefinition[], count: number): CardInstance[] {
  const shuffledPool = [...(pool.length >= count ? pool : (initialTechCards as TechCardDefinition[]))].sort(() => Math.random() - 0.5);
  const selectedDefinitions = shuffledPool.slice(0, count);

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

  return deck.sort(() => Math.random() - 0.5);
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
  const [moves, setMoves] = useState<number>(0);
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

  const restartGame = useCallback(
    (count = pairsCount) => {
      setCards(getInitialDeck(cardsPool, count));
      setFlippedIndices([]);
      setMoves(0);
      setMatchedPairs(0);
      setCombo(1);
      setMaxCombo(1);
      setScore(0);
      setHasStarted(false);
      setGameCompleted(false);
      setElapsedMs(0);
      lockBoardRef.current = false;
      startTimeRef.current = 0;
    },
    [cardsPool, pairsCount],
  );

  const handleStartGame = () => {
    setCards(generateShuffledDeck(cardsPool, pairsCount));
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

  // Handle card click
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
      setMoves((m) => m + 1);
      lockBoardRef.current = true;

      const [firstIdx, secondIdx] = nextFlipped;
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

          setFlippedIndices([]);
          lockBoardRef.current = false;

          if (nextMatched === pairsCount) {
            setGameCompleted(true);
            const finalTime = Math.max(1000, Date.now() - startTimeRef.current);
            const finalScore = Math.max(
              250,
              score + pointsEarned + pairsCount * 400 - Math.floor((finalTime / 1000) * 10),
            );

            onFinishGame({
              gameId: "memory",
              gameTitle: "Tech Memory Matrix",
              score: finalScore,
              timeMs: finalTime,
              moves: moves + 1,
              levelData: `${pairsCount * 2} Cards • Max Streak ${Math.max(
                combo,
                maxCombo,
              )}x`,
            });
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
          setFlippedIndices([]);
          lockBoardRef.current = false;
        }, 750);
      }
    }
  }

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
                onClick={() => handleCardClick(idx)}
                className={`relative aspect-[3/4] cursor-pointer select-none group ${
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
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue px-7 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue/30 hover:bg-blue/90 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <span>Start Game</span>
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
