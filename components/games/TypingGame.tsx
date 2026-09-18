"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameScoreSubmission } from "./ScoreModal";

type TypingMode = "time" | "words";

type TypingGameProps = {
  onFinishGame: (submission: GameScoreSubmission) => void;
  mode: TypingMode;
  timeLimit: number;
  wordLimit: number;
};

// Rich, natural, punctuation-free lowercase fallback paragraphs (nature, everyday life, travel, hobbies)
// Prevents any word repetition and ensures high-end gameplay even when offline/unconfigured
const FALLBACK_PARAGRAPHS = [
  "the gentle sound of a quiet forest brings a deep sense of peace to the human mind as the soft wind blows through the green leaves of ancient trees and birds sing their morning songs while a small clear stream flows slowly over smooth gray stones and a warm golden sun filters down between the branches creating soft shadows on the damp earth below where tiny flowers grow silently in the mossy ground",
  "everyday life is filled with simple moments that often go unnoticed but hold a quiet beauty like the rich aroma of fresh coffee in the early morning as the world is still waking up and the sky changes from deep dark blue to soft shades of orange and pink while people begin their daily journeys walking along clean city streets or driving past quiet neighborhoods with a feeling of hope for what the new day will bring",
  "traveling to new places allows us to see the world from a completely different angle as we walk through old historic cities with narrow stone streets and look at beautiful buildings built many centuries ago while listening to the unfamiliar sounds of a foreign language and tasting traditional foods made with fresh local ingredients that tell the story of a culture and its people across the passage of time",
  "finding a creative hobby like painting gardening or reading books provides a wonderful escape from the busy rush of modern routines as we lose ourselves in the quiet focus of creating something with our own hands or traveling to imaginary worlds through the printed pages of a great story where characters face challenges and embark on amazing journeys that inspire our own hearts and minds"
];

function generatePureParagraph(wordCount: number): string {
  // Use a beautiful pre-written paragraph as the base to maintain rich sentence flow
  const base = FALLBACK_PARAGRAPHS[Math.floor(Math.random() * FALLBACK_PARAGRAPHS.length)];
  const words = base.split(" ");
  if (words.length >= wordCount) {
    return words.slice(0, wordCount).join(" ");
  }

  // If we need more words (e.g. for a 500-word test), repeat fallback blocks to fill the requested length
  const extendedWords = [...words];
  while (extendedWords.length < wordCount) {
    const anotherBase = FALLBACK_PARAGRAPHS[Math.floor(Math.random() * FALLBACK_PARAGRAPHS.length)];
    extendedWords.push(...anotherBase.split(" "));
  }
  return extendedWords.slice(0, wordCount).join(" ");
}

export function TypingGame({ onFinishGame, mode, timeLimit, wordLimit }: TypingGameProps) {
  // Core game states
  const [targetText, setTargetText] = useState<string>("");
  const [inputText, setInputText] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(timeLimit);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Stats
  const [rawWpm, setRawWpm] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(100);
  const [errorCount, setErrorCount] = useState<number>(0);

  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  
  // Ref tracking to decouple timer/inactivity/extension listeners from fast typing state updates
  const inputTextRef = useRef<string>("");
  const lastTypedRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(false);

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Fetch a paragraph from the secure backend Gemini API with local fallback
  const loadNewParagraph = useCallback(async () => {
    setIsLoading(true);
    setInputText("");
    inputTextRef.current = "";
    setIsActive(false);
    isActiveRef.current = false;
    setIsCompleted(false);
    startTimeRef.current = null;
    lastTypedRef.current = 0;
    
    let text = "";
    const requestedWords = mode === "time" ? 150 : wordLimit;

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3500);

      // Pass the specific words query parameter to compile length-matched paragraphs in Gemini
      const res = await fetch(`/api/games/typing?words=${requestedWords}`, { signal: controller.signal });
      clearTimeout(id);
      
      if (res.ok) {
        const data = await res.json() as { paragraph?: string };
        if (data && data.paragraph) {
          text = data.paragraph;
        }
      }
    } catch (e) {
      console.warn("Secure Gemini API route failed or timed out. Falling back to local high-performance tech vocabulary generator.", e);
    }

    // Process paragraph based on mode
    if (!text) {
      text = generatePureParagraph(requestedWords);
    } else if (mode === "words") {
      const words = text.split(/\s+/);
      if (words.length < wordLimit) {
        const extraNeeded = wordLimit - words.length;
        words.push(...generatePureParagraph(extraNeeded).split(" "));
      }
      text = words.slice(0, wordLimit).join(" ");
    }

    setTargetText(text);
    setTimeLeft(mode === "time" ? timeLimit : 0);
    setIsLoading(false);
    
    // Reset container scroll to top on reload
    if (wordsContainerRef.current) {
      wordsContainerRef.current.scrollTop = 0;
    }
  }, [mode, timeLimit, wordLimit]);

  // Load paragraph on init and mode/config changes
  useEffect(() => {
    void loadNewParagraph();
  }, [loadNewParagraph]);

  // Complete game and submit scores (Trigger scoring dialogue immediately)
  const handleGameOver = useCallback((timeExpired: boolean, finalInputText: string) => {
    setIsActive(false);
    isActiveRef.current = false;
    setIsCompleted(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    const finalTimeMs = startTimeRef.current 
      ? Date.now() - startTimeRef.current 
      : (mode === "time" ? timeLimit * 1000 : 1000);

    // Calculate accuracy % & raw correct characters
    let correct = 0;
    const totalTyped = finalInputText.length;
    for (let i = 0; i < finalInputText.length; i++) {
      if (finalInputText[i] === targetText[i]) correct++;
    }

    const finalAccuracy = totalTyped > 0 ? Math.round((correct / totalTyped) * 100) : 100;
    const finalMinutes = finalTimeMs / 60000;
    const finalWpm = finalMinutes > 0 ? Math.round((correct / 5) / finalMinutes) : 0;

    // Scoring formula: WPM * Accuracy % (capped at WPM x 100)
    const finalScore = Math.round(finalWpm * (finalAccuracy / 100) * 100);

    // Submit score data immediately to trigger parent ScoreModal dialogue popup!
    onFinishGame({
      gameId: "typing",
      gameTitle: "Speed Typer",
      score: finalScore,
      timeMs: finalTimeMs,
      moves: totalTyped,
      levelData: `${finalWpm} WPM | ${finalAccuracy}% ACC`,
    });
  }, [mode, timeLimit, targetText, onFinishGame]);

  // Timer logic - DECOUPLED from inputText state changes so the timer ticks perfectly promptly!
  useEffect(() => {
    if (isActive && mode === "time") {
      if (timeLeft <= 0) {
        handleGameOver(true, inputTextRef.current);
        return;
      }

      timerRef.current = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, timeLeft, mode, handleGameOver]);

  // Focus Loss Auto-Reset & Inactivity Reset timers
  useEffect(() => {
    // 1. Focus Loss triggers immediate reset of active game
    const handleBlur = () => {
      if (isActiveRef.current) {
        console.warn("User took focus off the screen/tab. Automatically resetting active test.");
        void loadNewParagraph();
      }
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleBlur);

    // 2. Inactivity Monitor: resets test after 10s of complete typing silence
    const inactivityInterval = setInterval(() => {
      if (isActiveRef.current && lastTypedRef.current > 0) {
        const inactiveTime = Date.now() - lastTypedRef.current;
        if (inactiveTime > 10000) { // 10 seconds of inactivity
          console.warn("User inactive for over 10s. Automatically resetting active test.");
          void loadNewParagraph();
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleBlur);
      clearInterval(inactivityInterval);
    };
  }, [loadNewParagraph]);

  // Automatic Viewport Scrolling & Line Centering: Keeps the active typing line centered at all times
  useEffect(() => {
    const container = wordsContainerRef.current;
    if (!container || isCompleted) return;

    // Locate the active cursor caret span inside container
    const activeCaret = container.querySelector(".caret-cursor");
    if (activeCaret) {
      // Find its wrapping parent word block (inline-block span)
      const parentWord = activeCaret.closest(".word-block") as HTMLElement;
      if (parentWord) {
        const containerHeight = container.clientHeight;
        // Center the active word vertically inside the viewport
        const targetScrollTop = parentWord.offsetTop - containerHeight / 2 + parentWord.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: "smooth"
        });
      }
    }
  }, [inputText.length, isCompleted]);

  // Calculate live stats
  const calculateStats = useCallback((typed: string) => {
    if (typed.length === 0) {
      setRawWpm(0);
      setAccuracy(100);
      setErrorCount(0);
      return;
    }

    let correct = 0;
    let errors = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === targetText[i]) {
        correct++;
      } else {
        errors++;
      }
    }

    const rawAccuracy = Math.round((correct / typed.length) * 100);
    setErrorCount(errors);
    setAccuracy(rawAccuracy);

    const timeElapsedMs = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    const timeElapsedMins = timeElapsedMs / 60000;

    if (timeElapsedMins > 0) {
      const calculatedWpm = Math.round((correct / 5) / timeElapsedMins);
      setRawWpm(calculatedWpm);
    }
  }, [targetText]);

  // Handle key triggers and text input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isCompleted) return;

    let val = e.target.value;

    // Standardize input to lowercase and spaces only
    val = val.toLowerCase().replace(/[^a-z\s]/g, "");

    // Prevent typing further if the paragraph has been completed in words mode
    if (mode === "words" && val.length > targetText.length) return;

    // Start timer on the first keypress
    if (!isActive && startTimeRef.current === null) {
      setIsActive(true);
      isActiveRef.current = true;
      startTimeRef.current = Date.now();
    }

    // Update inactivity timestamp
    lastTypedRef.current = Date.now();

    // 1. Time Attack: Infinite growth. If the user is near the end, append more random words instantly!
    if (mode === "time" && targetText.length - val.length < 50) {
      const extension = generatePureParagraph(30);
      setTargetText((prev) => prev + " " + extension);
    }

    setInputText(val);
    calculateStats(val);

    // 2. Words Mode: Game over when they type the last character of the specific set of words
    if (mode === "words" && val.length === targetText.length) {
      handleGameOver(false, val);
    }
  };

  const focusInput = () => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  };

  // Surgeon-precise whole-word line wrapping component renderer
  const renderParagraphElements = () => {
    if (!targetText) return null;

    const words = targetText.split(" ");
    let charCounter = 0;

    return words.map((word, wordIdx) => {
      const wordChars = word.split("");
      return (
        <span 
          key={`word-${wordIdx}`} 
          className="word-block inline-block whitespace-nowrap mr-[0.3em] mb-1 transition-all duration-200"
        >
          {/* 1. Word characters */}
          {wordChars.map((char) => {
            const index = charCounter++;
            const isTyped = index < inputText.length;
            const isCurrent = index === inputText.length;
            const hasError = isTyped && inputText[index] !== char;

            let charClass = "text-paper/30 transition-colors duration-150";
            if (isTyped) {
              charClass = hasError 
                ? "text-[var(--red)] underline decoration-[var(--red)]/50 decoration-2 underline-offset-4" 
                : "text-[var(--green)]";
            }

            return (
              <span key={`char-${index}`} className={`relative inline-block ${charClass}`}>
                {isCurrent && isFocused && (
                  <span className="caret-cursor absolute left-[-1.5px] top-[10%] bottom-[10%] w-[2px] bg-[var(--blue)] animate-[caret-blink_1s_infinite]" />
                )}
                {char}
              </span>
            );
          })}

          {/* 2. Trailing Space character (tied inside word block so it wraps naturally) */}
          {wordIdx < words.length - 1 && (() => {
            const index = charCounter++;
            const isTyped = index < inputText.length;
            const isCurrent = index === inputText.length;
            const hasError = isTyped && inputText[index] !== " ";

            let charClass = "text-paper/30 transition-colors duration-150";
            if (isTyped) {
              charClass = hasError ? "text-[var(--red)] bg-[var(--red)]/20 rounded" : "text-[var(--green)]";
            }

            return (
              <span key={`space-${wordIdx}`} className={`relative inline-block ${charClass}`}>
                {isCurrent && isFocused && (
                  <span className="caret-cursor absolute left-[-1.5px] top-[10%] bottom-[10%] w-[2px] bg-[var(--blue)] animate-[caret-blink_1s_infinite]" />
                )}
                &nbsp;
              </span>
            );
          })()}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col gap-6 select-none bg-surface-raised/40 border border-paper/5 rounded-3xl p-6 sm:p-10 shadow-2xl relative">
      
      {/* Hidden Textarea for mobile soft keyboard injection */}
      <textarea
        ref={hiddenInputRef}
        value={inputText}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={isCompleted || isLoading}
        className="absolute h-0 w-0 opacity-0 pointer-events-none -z-50"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
      />

      {/* Focus Mode Clean Settings Header with Inline Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper/10 pb-4 text-xs font-mono tracking-wider text-paper/60 uppercase">
        <div className="flex items-center gap-5">
          <span className="font-sans font-bold text-paper/40">Mode: {mode === "time" ? "Time Attack" : "Words Count"}</span>
          
          <div className="flex items-center gap-5 border-l border-paper/10 pl-5">
            {/* Metric 1: Time Left (for Time mode) or Progress (for Words mode) */}
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-paper/40 font-normal lowercase">
                {mode === "time" ? "time" : "progress"}
              </span>
              <span className="text-base font-extrabold text-white font-mono">
                {mode === "time" 
                  ? `${timeLeft}s` 
                  : `${inputText.split(/\s+/).filter(Boolean).length}/${wordLimit}`}
              </span>
            </div>
            
            {/* Metric 2: Live WPM */}
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-paper/40 font-normal lowercase">wpm</span>
              <span className="text-base font-extrabold text-[var(--green)] font-mono">{rawWpm}</span>
            </div>
            
            {/* Metric 3: Live Accuracy */}
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-paper/40 font-normal lowercase">acc</span>
              <span className="text-base font-extrabold text-[var(--yellow)] font-mono">{accuracy}%</span>
            </div>
          </div>
        </div>

        <span>Target: {mode === "time" ? `${timeLimit}s` : `${wordLimit} words`}</span>
      </div>

      {/* Main Gameplay Screen (FIXED HEIGHT with automatic center scrolling) */}
      <div 
        onClick={focusInput}
        className="relative h-[130px] flex items-center justify-center p-4 bg-ink/20 border border-paper/5 rounded-2xl cursor-text transition-all duration-300 hover:border-paper/10 overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-paper/60 font-mono text-sm">
            <svg className="animate-spin h-5 w-5 text-[var(--blue)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating typing test...
          </div>
        ) : (
          <div 
            ref={wordsContainerRef}
            className="absolute inset-y-0 inset-x-4 py-4 overflow-y-auto scrollbar-none scroll-smooth text-lg sm:text-2xl font-mono leading-relaxed select-none max-w-full text-left break-words"
          >
            {/* Smooth carats and overlays inside focused container */}
            {!isFocused && !isCompleted && (
              <div className="absolute inset-0 z-30 bg-ink/75 backdrop-blur-[1.5px] flex flex-col items-center justify-center gap-2 rounded-xl transition-all duration-300">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--blue)] bg-[var(--blue)]/10 px-3 py-1.5 rounded-full border border-[var(--blue)]/20 shadow-md animate-pulse">
                  Click or Tap here to start typing
                </span>
                <span className="text-[10px] text-paper/40 hidden sm:block">
                  Your keyboard will open automatically
                </span>
              </div>
            )}

            {/* Render Word Span blocks for whole-word line wrapping */}
            <div className="relative flex flex-wrap max-w-full pr-2">
              {renderParagraphElements()}
            </div>
          </div>
        )}
      </div>

      {/* Inline styles for caret cursor blinking */}
      <style jsx global>{`
        @keyframes caret-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
