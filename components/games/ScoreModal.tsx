"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Image from "next/image";

export type GameScoreSubmission = {
  gameId: "jigsaw" | "crossword" | "memory" | "typing";
  gameTitle: string;
  score: number;
  timeMs: number;
  moves?: number;
  levelData?: string;
};

type ScoreModalProps = {
  isOpen: boolean;
  scoreData: GameScoreSubmission | null;
  onClose: () => void;
  onScoreSubmitted: () => void;
  onPlayAgain: () => void;
  onViewLeaderboard: () => void;
};

export function ScoreModal({
  isOpen,
  scoreData,
  onClose,
  onScoreSubmitted,
  onPlayAgain,
  onViewLeaderboard,
}: ScoreModalProps) {
  const { data: session, status } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !scoreData) return null;

  const isAuthenticated = status === "authenticated" && !!session?.user?.uid;
  const userName = session?.user?.name || "DevFest Builder";
  const userImage = session?.user?.image;
  const userEmail = session?.user?.email;

  const timeFormatted = `${Math.floor(scoreData.timeMs / 60000)}m ${Math.floor(
    (scoreData.timeMs % 60000) / 1000,
  )}s`;

  async function handlePublishScore() {
    if (!isAuthenticated) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/games/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: scoreData?.gameId,
          score: scoreData?.score,
          timeMs: scoreData?.timeMs,
          moves: scoreData?.moves ?? 0,
          levelData: scoreData?.levelData,
        }),
      });

      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to publish score");
      }

      setSubmitted(true);
      onScoreSubmitted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong saving your score.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSignInToPublish() {
    if (!scoreData) return;
    try {
      localStorage.setItem("devfest_pending_score", JSON.stringify(scoreData));
    } catch (e) {
      console.warn("Could not save pending score", e);
    }
    signIn("google", { callbackUrl: "/games" });
  }

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-paper/15 bg-surface-raised p-6 text-paper shadow-2xl sm:p-8">
        {/* Glow corner highlights */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[var(--blue)]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-[var(--green)]/20 blur-3xl" />

        <div className="relative text-center">
          {/* Header Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--yellow)]/30 bg-[var(--yellow)]/10 px-3.5 py-1 text-xs font-mono uppercase tracking-wider text-[var(--yellow)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--yellow)]" />
            <span>Challenge Completed</span>
          </div>

          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl text-paper">
            {scoreData.gameTitle}
          </h2>
          <p className="mt-1 text-xs text-paper/60 font-mono">
            {scoreData.levelData || "DevFest Mini Game"}
          </p>

          {/* Score Stats Grid */}
          <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-paper/10 bg-paper/[0.04] p-4 text-center">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-paper/60">Score</div>
              <div className="mt-1 text-2xl font-bold text-[var(--blue-halftone)] sm:text-3xl">
                {scoreData.score.toLocaleString()}
              </div>
            </div>
            <div className="border-x border-paper/10">
              <div className="text-xs font-mono uppercase tracking-wider text-paper/60">Time</div>
              <div className="mt-1 text-lg font-semibold text-paper sm:text-xl font-mono pt-1">
                {timeFormatted}
              </div>
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-paper/60">Moves</div>
              <div className="mt-1 text-lg font-semibold text-paper sm:text-xl font-mono pt-1">
                {scoreData.moves ?? "—"}
              </div>
            </div>
          </div>

          {/* Authentication & Leaderboard Action Section */}
          <div className="mt-6 rounded-2xl border border-paper/10 bg-paper/[0.02] p-5">
            {submitted ? (
              <div className="text-center py-2 animate-scale-in">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--green)]/20 text-[var(--green)] text-xl font-bold mb-2">
                  ✓
                </div>
                <h3 className="text-base font-semibold text-paper">Score Published</h3>
                <p className="mt-1 text-xs text-paper/70">
                  Your score is now recorded on the DevFest Leaderboard.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <button
                    type="button"
                    onClick={onViewLeaderboard}
                    className="rounded-full bg-[var(--blue)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--blue)]/90 transition-colors cursor-pointer"
                  >
                    View Leaderboard
                  </button>
                  <button
                    type="button"
                    onClick={onPlayAgain}
                    className="rounded-full border border-paper/20 px-4 py-2 text-xs text-paper hover:bg-paper/10 transition-colors cursor-pointer"
                  >
                    Play Again
                  </button>
                </div>
              </div>
            ) : isAuthenticated ? (
              <div>
                <div className="flex items-center justify-center gap-3 mb-4">
                  {userImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={userImage}
                      alt={userName}
                      width={36}
                      height={36}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-full border border-[var(--blue)]/40 object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue)]/20 font-bold text-xs text-[var(--blue)]">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="text-xs font-medium text-paper">{userName}</div>
                    <div className="text-[11px] font-mono text-paper/50">{userEmail}</div>
                  </div>
                </div>

                {error && (
                  <div className="mb-3 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-1.5 text-xs text-[var(--red)]">
                    {error}
                  </div>
                )}

                <p className="text-xs text-paper/70 mb-4">
                  Submit your score to record your ranking on the official leaderboard.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handlePublishScore}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--green)] px-6 py-2.5 text-xs font-semibold text-black hover:bg-[var(--green)]/90 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      "Publish to Leaderboard"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onPlayAgain}
                    className="rounded-full border border-paper/20 px-4 py-2.5 text-xs text-paper/80 hover:bg-paper/10 transition-colors cursor-pointer"
                  >
                    Skip & Play Again
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--yellow)] mb-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--yellow)] animate-pulse" />
                  Sign In Required
                </div>
                <h3 className="text-sm font-semibold text-paper">
                  Sign in to publish your score to the Leaderboard
                </h3>
                <p className="mt-1 text-xs text-paper/70 max-w-sm mx-auto">
                  Only authenticated builders can submit scores and appear on the official DevFest rankings.
                </p>

                <div className="mt-4 flex flex-col items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSignInToPublish}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-paper px-6 py-2.5 text-xs font-medium text-black hover:bg-paper/90 transition-all shadow-md cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Sign in with Google to Submit
                  </button>

                  <button
                    type="button"
                    onClick={onPlayAgain}
                    className="text-xs text-paper/50 hover:text-paper/80 transition-colors underline cursor-pointer"
                  >
                    Continue without saving
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Close corner button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute -right-2 -top-2 rounded-full p-2 text-paper/50 hover:bg-paper/10 hover:text-paper transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
