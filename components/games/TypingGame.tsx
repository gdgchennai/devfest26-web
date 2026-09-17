"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameScoreSubmission } from "./ScoreModal";

type TypingMode = "time" | "words";

type TypingGameProps = {
  onFinishGame: (submission: GameScoreSubmission) => void;
};

// Pure, clean, punctuation-free lowercase tech vocabulary for Monkeytype-style typing tests
const TECH_VOCABULARY = [
  "code", "software", "developer", "engineer", "javascript", "typescript", "react", "angular", "node", "express",
  "database", "sqlite", "cloudflare", "worker", "pages", "deployment", "compiler", "runtime", "performance",
  "optimization", "security", "encryption", "scaling", "architecture", "component", "interface", "function", "variable", "constant",
  "framework", "library", "git", "commit", "branch", "merge", "conflict", "leaderboard", "scores", "application",
  "frontend", "backend", "fullstack", "server", "client", "browser", "hydration", "rendering", "static", "dynamic",
  "google", "gemini", "artificial", "intelligence", "models", "algorithm", "network", "cloud", "platform", "systems",
  "responsive", "mobile", "desktop", "keyboard", "typing", "accuracy", "speed", "words", "minute", "lounge",
  "community", "builders", "creators", "design", "creative", "ideation", "scripting", "editing", "publishing", "collaboration",
  "array", "object", "string", "number", "boolean", "promise", "callback", "async", "await", "fetch", "routing",
  "styling", "cascade", "animation", "timeline", "trigger", "opacity", "scale", "parallax", "matrix", "vector", "render",
  "handler", "event", "state", "effect", "ref", "hook", "context", "provider", "auth", "session", "credential", "cache"
];

function generatePureParagraph(wordCount: number): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    const word = TECH_VOCABULARY[Math.floor(Math.random() * TECH_VOCABULARY.length)];
    words.push(word);
  }
  return words.join(" ");
}

export function TypingGame({ onFinishGame }: TypingGameProps) {
  const [mode, setMode] = useState<TypingMode>("time");
  
  // Adjusted Settings to match exactly: 200, 400, and 500 words for Words mode
  const [timeLimit, setTimeLimit] = useState<number>(30); // 15, 30, 60s
  const [wordLimit, setWordLimit] = useState<number>(200); // 200, 400, 500 words
  
  // Core game states
  const [targetText, setTargetText] = useState<string>("");
  const [inputText, setInputText] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(30);
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

  // Fetch a paragraph from the secure backend Gemini API with a robust local vocabulary generator fallback
  const loadNewParagraph = useCallback(async () => {
    setIsLoading(true);
    setInputText("");
    setIsActive(false);
    setIsCompleted(false);
    startTimeRef.current = null;
    
    let text = "";

    try {
      // Fetch from our new secure backend Gemini API route with a tight 3.5s timeout
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3500);

      const res = await fetch("/api/games/typing", { signal: controller.signal });
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

    // Fallback or fill-up logic
    if (!text) {
      const targetCount = mode === "time" ? 100 : wordLimit;
      text = generatePureParagraph(targetCount);
    } else if (mode === "words") {
      // In words mode, generate/slice exactly 200, 400, or 500 words
      const words = text.split(/\s+/);
      if (words.length < wordLimit) {
        const extraNeeded = wordLimit - words.length;
        words.push(...generatePureParagraph(extraNeeded).split(" "));
      }
      text = words.slice(0, wordLimit).join(" ");
    } else {
      // In time attack mode, start with a solid 100-word paragraph
      const words = text.split(/\s+/);
      text = words.slice(0, 100).join(" ");
    }

    setTargetText(text);
    setTimeLeft(mode === "time" ? timeLimit : 0);
    setIsLoading(false);
  }, [mode, timeLimit, wordLimit]);

  // Load paragraph on init and mode/config changes
  useEffect(() => {
    void loadNewParagraph();
  }, [loadNewParagraph]);

  // Complete game and submit scores (Muted, single setState invocation)
  const handleGameOver = useCallback((timeExpired: boolean, finalInputText: string) => {
    setIsActive(false);
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

    // Submit score data
    onFinishGame({
      gameId: "typing",
      gameTitle: "Speed Typer",
      score: finalScore,
      timeMs: finalTimeMs,
      moves: totalTyped,
      levelData: `${finalWpm} WPM | ${finalAccuracy}% ACC`,
    });
  }, [mode, timeLimit, targetText, onFinishGame]);

  // Timer logic - FIXED: Call handleGameOver in useEffect body (outside state setters) to resolve React bad setState warnings!
  useEffect(() => {
    if (isActive && mode === "time") {
      if (timeLeft <= 0) {
        handleGameOver(true, inputText);
        return;
      }

      timerRef.current = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, timeLeft, mode, handleGameOver, inputText]);

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
      startTimeRef.current = Date.now();
    }

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

      {/* Settings Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper/10 pb-4">
        
        {/* Toggle Attack Modes */}
        <div className="flex items-center gap-1.5 bg-ink/30 border border-paper/5 rounded-xl p-1">
          <button
            type="button"
            onClick={() => {
              setMode("time");
              loadNewParagraph();
            }}
            disabled={isActive}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${
              mode === "time" 
                ? "bg-[var(--blue)] text-paper shadow-md" 
                : "text-paper/60 hover:text-paper"
            }`}
          >
            Time Attack
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("words");
              loadNewParagraph();
            }}
            disabled={isActive}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${
              mode === "words" 
                ? "bg-[var(--blue)] text-paper shadow-md" 
                : "text-paper/60 hover:text-paper"
            }`}
          >
            Words Count
          </button>
        </div>

        {/* Attack Length Config (Time Attack: 15/30/60s, Words Count: 200/400/500 words) */}
        <div className="flex items-center gap-1.5 bg-ink/30 border border-paper/5 rounded-xl p-1 text-xs">
          {mode === "time" ? (
            [15, 30, 60].map((t) => (
              <button
                key={`t-${t}`}
                type="button"
                onClick={() => {
                  setTimeLimit(t);
                  setTimeLeft(t);
                }}
                disabled={isActive}
                className={`px-2.5 py-1 font-bold rounded-lg cursor-pointer ${
                  timeLimit === t ? "text-[var(--blue)] font-extrabold" : "text-paper/50 hover:text-paper/80"
                }`}
              >
                {t}s
              </button>
            ))
          ) : (
            [200, 400, 500].map((w) => (
              <button
                key={`w-${w}`}
                type="button"
                onClick={() => {
                  setWordLimit(w);
                }}
                disabled={isActive}
                className={`px-2.5 py-1 font-bold rounded-lg cursor-pointer ${
                  wordLimit === w ? "text-[var(--blue)] font-extrabold" : "text-paper/50 hover:text-paper/80"
                }`}
              >
                {w} words
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Gameplay Screen */}
      <div 
        onClick={focusInput}
        className="relative min-h-[160px] flex items-center justify-center p-4 bg-ink/20 border border-paper/5 rounded-2xl cursor-text transition-all duration-300 hover:border-paper/10"
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
          <div className="relative text-lg sm:text-2xl font-mono leading-relaxed select-none max-w-full overflow-hidden text-left break-words">
            
            {/* Smooth carats and overlays inside focused container */}
            {!isFocused && !isCompleted && (
              <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 rounded-xl transition-all duration-300">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--blue)] bg-[var(--blue)]/10 px-3 py-1.5 rounded-full border border-[var(--blue)]/20 shadow-md">
                  Click or Tap here to start typing
                </span>
                <span className="text-[10px] text-paper/40 hidden sm:block">
                  Your keyboard will open automatically
                </span>
              </div>
            )}

            {/* Character streamer rendering */}
            <span className="relative">
              {targetText.split("").map((char, index) => {
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
                    
                    {/* Blinking Carat cursor exactly like Monkeytype */}
                    {isCurrent && isFocused && (
                      <span className="absolute left-[-2px] top-[10%] bottom-[10%] w-[2.5px] bg-[var(--blue)] animate-[caret-blink_1s_infinite]" />
                    )}
                    {char === " " ? "\u00A0" : char}
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 border-t border-paper/10 pt-6 text-center">
        
        {/* Left Col: Timer/Word Count */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-paper/40">
            {mode === "time" ? "Time Left" : "Progress"}
          </span>
          <span className="text-xl sm:text-3xl font-extrabold font-mono text-white mt-1">
            {mode === "time" 
              ? `${timeLeft}s` 
              : `${inputText.split(/\s+/).filter(Boolean).length}/${wordLimit}`}
          </span>
        </div>

        {/* Center Col: Live WPM */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-paper/40">Speed</span>
          <span className="text-xl sm:text-3xl font-extrabold font-mono text-[var(--green)] mt-1">
            {rawWpm} <span className="text-xs font-bold text-paper/40 font-sans">WPM</span>
          </span>
        </div>

        {/* Right Col: Accuracy */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-paper/40">Accuracy</span>
          <span className="text-xl sm:text-3xl font-extrabold font-mono text-[var(--yellow)] mt-1">
            {accuracy}<span className="text-xs font-bold text-paper/40 font-sans">%</span>
          </span>
        </div>
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
