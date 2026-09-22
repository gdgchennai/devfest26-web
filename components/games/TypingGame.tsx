"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameScoreSubmission } from "./ScoreModal";
import { generateLocalParagraph, typingStats, typingWordCount } from "@/lib/game-rules";
import { gameApi } from "@/lib/games-client";

type TypingMode = "time" | "words";

type TypingGameProps = {
  onFinishGame: (submission: GameScoreSubmission) => void;
  mode: TypingMode;
  timeLimit: number;
  wordLimit: number;
};

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
  // The server-side run: it dealt `targetText`, starts its clock on our first keystroke,
  // and scores what we finally send. Null → offline practice, unranked.
  const sessionIdRef = useRef<string | null>(null);
  const inputTextRef = useRef<string>("");
  const lastTypedRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(false);

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Ask the server to deal a run (it generates the text and remembers it); if it can't
  // be reached, fall back to a local paragraph and an unranked practice run.
  const loadNewParagraph = useCallback(async () => {
    setIsLoading(true);
    setInputText("");
    inputTextRef.current = "";
    setIsActive(false);
    isActiveRef.current = false;
    setIsCompleted(false);
    startTimeRef.current = null;
    lastTypedRef.current = 0;
    sessionIdRef.current = null;

    const started = await gameApi.startTyping(mode, timeLimit, wordLimit);
    let text: string;
    if (started.ok) {
      sessionIdRef.current = started.data.sessionId;
      text = started.data.text;
    } else {
      text = generateLocalParagraph(typingWordCount(mode, timeLimit, wordLimit));
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

  // Complete the game. What was typed is the evidence; the server scores it against the
  // text it dealt and the time it measured, and the result it returns is what we show.
  const handleGameOver = useCallback((timeExpired: boolean, finalInputText: string) => {
    setIsActive(false);
    isActiveRef.current = false;
    setIsCompleted(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    const sessionId = sessionIdRef.current;
    const localTimeMs = startTimeRef.current
      ? Date.now() - startTimeRef.current
      : (mode === "time" ? timeLimit * 1000 : 1000);

    void (async () => {
      let unranked: "offline" | "rejected" = "offline";
      if (sessionId) {
        const done = await gameApi.finish(sessionId, { typed: finalInputText });
        if (done.ok) {
          onFinishGame({ ...done.data.result, sessionId });
          return;
        }
        unranked = done.status === 0 ? "offline" : "rejected";
      }
      // Offline (or the server refused): show a local, unranked result.
      const stats = typingStats(targetText, finalInputText, localTimeMs);
      onFinishGame({
        gameId: "typing",
        gameTitle: "Speed Typer",
        score: stats.score,
        timeMs: localTimeMs,
        moves: finalInputText.length,
        levelData: `${stats.wpm} WPM | ${stats.accuracy}% ACC`,
        unranked,
      });
    })();
  }, [mode, timeLimit, targetText, onFinishGame]);

  // Timer logic - DECOUPLED from inputText state changes. Driven by the wall clock, not by
  // counting one-second ticks: browsers throttle timers (background tabs, busy devices), a
  // tick chain drifts — 30 ticks became 36 real seconds — and the server, which times the
  // run itself, would then refuse the finish as too late.
  useEffect(() => {
    if (!isActive || mode !== "time") return;

    const tick = () => {
      const start = startTimeRef.current;
      if (!start) return;
      const remainingMs = timeLimit * 1000 - (Date.now() - start);
      if (remainingMs <= 0) {
        setTimeLeft(0);
        handleGameOver(true, inputTextRef.current);
        return;
      }
      setTimeLeft(Math.ceil(remainingMs / 1000));
    };

    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [isActive, mode, timeLimit, handleGameOver]);

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
    if (val.length > targetText.length) return;

    // Start timer on the first keypress
    if (!isActive && startTimeRef.current === null) {
      setIsActive(true);
      isActiveRef.current = true;
      startTimeRef.current = Date.now();
      // The server times the run from when this reaches it, not from a number we send.
      if (sessionIdRef.current) void gameApi.begin(sessionIdRef.current);
    }

    // Update inactivity timestamp
    lastTypedRef.current = Date.now();

    setInputText(val);
    calculateStats(val);

    // Game over when the whole dealt text has been typed (Words mode; in Time Attack the
    // text is longer than anyone can type in the window, so this is only a safety net).
    if (val.length === targetText.length) {
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
                ? "text-red underline decoration-red/50 decoration-2 underline-offset-4" 
                : "text-green";
            }

            return (
              <span key={`char-${index}`} className={`relative inline-block ${charClass}`}>
                {isCurrent && isFocused && (
                  <span className="caret-cursor absolute left-[-1.5px] top-[10%] bottom-[10%] w-[2px] bg-blue animate-[caret-blink_1s_infinite]" />
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
              charClass = hasError ? "text-red bg-red/20 rounded" : "text-green";
            }

            return (
              <span key={`space-${wordIdx}`} className={`relative inline-block ${charClass}`}>
                {isCurrent && isFocused && (
                  <span className="caret-cursor absolute left-[-1.5px] top-[10%] bottom-[10%] w-[2px] bg-blue animate-[caret-blink_1s_infinite]" />
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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper/10 pb-4 text-xs tracking-wider text-paper/60 uppercase">
        <div className="flex items-center gap-5">
          <span className="font-sans font-bold text-paper/40">Mode: {mode === "time" ? "Time Attack" : "Words Count"}</span>
          
          <div className="flex items-center gap-5 border-l border-paper/10 pl-5">
            {/* Metric 1: Time Left (for Time mode) or Progress (for Words mode) */}
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-paper/40 font-normal lowercase">
                {mode === "time" ? "time" : "progress"}
              </span>
              <span className="text-base font-extrabold text-paper">
                {mode === "time" 
                  ? `${timeLeft}s` 
                  : `${inputText.split(/\s+/).filter(Boolean).length}/${wordLimit}`}
              </span>
            </div>
            
            {/* Metric 2: Live WPM */}
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-paper/40 font-normal lowercase">wpm</span>
              <span className="text-base font-extrabold text-green">{rawWpm}</span>
            </div>
            
            {/* Metric 3: Live Accuracy */}
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-paper/40 font-normal lowercase">acc</span>
              <span className="text-base font-extrabold text-yellow">{accuracy}%</span>
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
          <div className="flex items-center gap-2 text-paper/60 text-sm">
            <svg className="animate-spin h-5 w-5 text-blue" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating typing test...
          </div>
        ) : (
          <div 
            ref={wordsContainerRef}
            className="absolute inset-y-0 inset-x-4 py-4 overflow-y-auto scrollbar-none scroll-smooth text-lg sm:text-2xl leading-relaxed select-none max-w-full text-left break-words"
          >
            {/* Smooth carats and overlays inside focused container */}
            {!isFocused && !isCompleted && (
              <div className="absolute inset-0 z-30 bg-ink/75 backdrop-blur-[1.5px] flex flex-col items-center justify-center gap-2 rounded-xl transition-all duration-300">
                <span className="text-xs font-bold uppercase tracking-widest text-blue bg-blue/10 px-3 py-1.5 rounded-full border border-blue/20 shadow-md animate-pulse">
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
