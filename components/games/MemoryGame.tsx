"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameScoreSubmission } from "./ScoreModal";

type TechCardDefinition = {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  accent: string;
};

const TECH_CARDS_POOL: TechCardDefinition[] = [
  { id: "gemini", name: "Gemini AI", subtitle: "Multimodal Model", icon: "♊", accent: "#4285F4" },
  { id: "kotlin", name: "Kotlin", subtitle: "Modern Android", icon: "⚡", accent: "#A136F7" },
  { id: "compose", name: "Compose", subtitle: "Declarative UI", icon: "🎨", accent: "#34A853" },
  { id: "flutter", name: "Flutter", subtitle: "Multiplatform UI", icon: "🎯", accent: "#57CAFF" },
  { id: "firebase", name: "Firebase", subtitle: "App Platform", icon: "🔥", accent: "#F9AB00" },
  { id: "cloud", name: "Google Cloud", subtitle: "Infrastructure", icon: "☁️", accent: "#4285F4" },
  { id: "tpu", name: "Tensor TPU", subtitle: "Neural Silicon", icon: "🦾", accent: "#EA4335" },
  { id: "golang", name: "Golang", subtitle: "Systems Engine", icon: "🚀", accent: "#57CAFF" },
  { id: "k8s", name: "Kubernetes", subtitle: "Orchestration", icon: "☸️", accent: "#4285F4" },
  { id: "android-kitkat", name: "KitKat", subtitle: "Android 4.4", icon: "🍫", accent: "#EA4335" },
  { id: "android-lollipop", name: "Lollipop", subtitle: "Android 5.0", icon: "🍭", accent: "#34A853" },
  { id: "android-oreo", name: "Oreo", subtitle: "Android 8.0", icon: "🍪", accent: "#F9AB00" },
  { id: "android-pie", name: "Pie", subtitle: "Android 9.0", icon: "🥧", accent: "#EA4335" },
  { id: "angular", name: "Angular", subtitle: "Web Framework", icon: "🅰️", accent: "#EA4335" },
  { id: "devfest", name: "DevFest", subtitle: "GDG Chennai", icon: "🎪", accent: "#34A853" },
  { id: "room", name: "Room DB", subtitle: "Jetpack SQLite", icon: "💾", accent: "#F9AB00" },
];

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
function getInitialDeck(count: number): CardInstance[] {
  const selectedDefinitions = TECH_CARDS_POOL.slice(0, count);
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

function generateShuffledDeck(count: number): CardInstance[] {
  const shuffledPool = [...TECH_CARDS_POOL].sort(() => Math.random() - 0.5);
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
};

export function MemoryGame({ onFinishGame }: MemoryGameProps) {
  const [pairsCount, setPairsCount] = useState<number>(8);
  const [cards, setCards] = useState<CardInstance[]>(() => getInitialDeck(8));
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

  const restartGame = useCallback(
    (count = pairsCount) => {
      setPairsCount(count);
      setCards(getInitialDeck(count));
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
    [pairsCount],
  );

  const handleStartGame = () => {
    setCards(generateShuffledDeck(pairsCount));
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
    <div className="flex flex-col gap-3 sm:gap-4 max-w-4xl mx-auto w-full">
      {/* Top Compact Controls & Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-paper/10 bg-surface px-3.5 py-2 sm:px-4 sm:py-2.5">
        {/* Size Selection */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono uppercase text-paper/60">Size:</span>
          <div className="inline-flex rounded-lg border border-paper/10 bg-paper/[0.04] p-0.5">
            {[
              { count: 6, label: "12 Cards" },
              { count: 8, label: "16 Cards" },
              { count: 12, label: "24 Cards" },
            ].map((option) => (
              <button
                key={option.count}
                type="button"
                onClick={() => restartGame(option.count)}
                className={`rounded-md px-2 sm:px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer ${
                  pairsCount === option.count
                    ? "bg-[var(--blue)] text-white shadow-sm"
                    : "text-paper/70 hover:text-paper hover:bg-paper/5"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Stats Pills */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
          <div className="flex items-center gap-1">
            <span className="text-paper/50">Score:</span>
            <span className="font-bold text-[var(--blue-halftone)]">{score}</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-paper/50">Streak:</span>
            <span className="font-bold text-[var(--yellow)]">{combo > 1 ? `${combo}x` : "1x"}</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-paper/50">Pairs:</span>
            <span className="font-bold text-[var(--green)]">
              {matchedPairs}/{pairsCount}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-paper/50">Time:</span>
            <span className="font-bold text-paper">{hasStarted ? timeFormatted : "0:00"}</span>
          </div>

          <button
            type="button"
            onClick={() => restartGame(pairsCount)}
            className="rounded-lg border border-paper/20 bg-paper/10 px-2 py-0.5 text-[11px] font-mono text-paper hover:bg-paper/20 transition-colors cursor-pointer flex items-center gap-1 ml-1"
            title="Reset Game"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Responsive Viewport-Fitted Cards Area */}
      <div className="relative w-full h-[min(65vh,520px)] sm:h-[min(62vh,540px)] flex items-center justify-center">
        {/* Cards Grid */}
        <div
          className={`grid w-full h-full gap-2 sm:gap-2.5 p-1 transition-all duration-300 justify-center items-center ${
            !hasStarted ? "filter blur-md opacity-40 pointer-events-none select-none" : ""
          } ${
            pairsCount === 6
              ? "grid-cols-3 sm:grid-cols-4 grid-rows-4 sm:grid-rows-3"
              : pairsCount === 8
              ? "grid-cols-4 grid-rows-4"
              : "grid-cols-4 sm:grid-cols-6 grid-rows-6 sm:grid-rows-4"
          }`}
        >
          {cards.map((card, idx) => {
            const isOpen = card.isFlipped || card.isMatched;

            return (
              <div
                key={card.instanceId}
                onClick={() => handleCardClick(idx)}
                className="relative w-full h-full max-h-[14vh] sm:max-h-[16vh] max-w-[110px] aspect-[3/4] mx-auto cursor-pointer select-none group"
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
                    className="absolute inset-0 rounded-xl sm:rounded-2xl border border-paper/20 bg-surface-raised flex flex-col items-center justify-center p-1.5 sm:p-2 text-center shadow-md group-hover:border-paper/40 group-hover:shadow-[0_0_12px_rgba(66,133,244,0.2)]"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                  >
                    <div className="flex gap-0.5 sm:gap-1 mb-1 sm:mb-1.5">
                      <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-[var(--blue)]" />
                      <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-[var(--red)]" />
                      <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-[var(--yellow)]" />
                      <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-[var(--green)]" />
                    </div>
                    <span className="text-base sm:text-xl font-mono font-bold text-paper/70 tracking-tight">
                      &lt;/&gt;
                    </span>
                    <span className="mt-0.5 sm:mt-1 text-[8px] sm:text-[9px] font-mono text-paper/40 uppercase tracking-wider font-semibold">
                      DevFest
                    </span>
                  </div>

                  {/* Back face (Card Revealed Content) */}
                  <div
                    className="absolute inset-0 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-center p-1.5 sm:p-2 text-center shadow-lg bg-surface-raised"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      borderColor: card.isMatched ? "var(--green)" : card.accent,
                      boxShadow: card.isMatched
                        ? "0 0 15px rgba(52, 168, 83, 0.25)"
                        : `0 0 10px ${card.accent}33`,
                    }}
                  >
                    <span className="text-xl sm:text-2xl md:text-3xl mb-0.5 sm:mb-1">{card.icon}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-paper line-clamp-1">
                      {card.name}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-mono text-paper/60 leading-none mt-0.5 line-clamp-1 hidden sm:block">
                      {card.subtitle}
                    </span>
                    {card.isMatched && (
                      <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-[var(--green)]/20 px-1.5 py-0.2 text-[8px] font-mono font-bold text-[var(--green)]">
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
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-6 text-center rounded-3xl animate-fade-in">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--yellow)]/20 text-[var(--yellow)] mb-3">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v10M16 7v10" />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Memory Matrix</h3>
            <p className="text-xs text-paper/70 mt-1 max-w-xs">
              Flip and match {pairsCount} pairs of Android and Google tech stacks without scrolling.
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
      </div>
    </div>
  );
}
