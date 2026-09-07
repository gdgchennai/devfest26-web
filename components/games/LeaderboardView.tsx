"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import type { LeaderboardEntry, OverallLeaderboardEntry } from "@/lib/leaderboard";

type LeaderboardTab = "all" | "jigsaw" | "crossword" | "memory";

export function LeaderboardView() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.uid;

  const [activeTab, setActiveTab] = useState<LeaderboardTab>("all");
  const [loadedTab, setLoadedTab] = useState<LeaderboardTab | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [overallList, setOverallList] = useState<OverallLeaderboardEntry[]>([]);
  const [gameList, setGameList] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    fetch(`/api/games/scores?gameId=${activeTab}&limit=50`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        return res.json() as Promise<{
          leaderboard?: (LeaderboardEntry | OverallLeaderboardEntry)[];
        }>;
      })
      .then((data) => {
        if (isCancelled) return;
        if (activeTab === "all") {
          setOverallList((data.leaderboard as OverallLeaderboardEntry[]) || []);
        } else {
          setGameList((data.leaderboard as LeaderboardEntry[]) || []);
        }
        setLoadedTab(activeTab);
      })
      .catch(() => {
        if (isCancelled) return;
        setError("Unable to load leaderboard. Please try again.");
        setLoadedTab(activeTab);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTab]);

  const refreshLeaderboard = () => {
    setIsRefreshing(true);
    setError(null);
    fetch(`/api/games/scores?gameId=${activeTab}&limit=50`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        return res.json() as Promise<{
          leaderboard?: (LeaderboardEntry | OverallLeaderboardEntry)[];
        }>;
      })
      .then((data) => {
        if (activeTab === "all") {
          setOverallList((data.leaderboard as OverallLeaderboardEntry[]) || []);
        } else {
          setGameList((data.leaderboard as LeaderboardEntry[]) || []);
        }
        setIsRefreshing(false);
      })
      .catch(() => {
        setError("Unable to load leaderboard. Please try again.");
        setIsRefreshing(false);
      });
  };

  const loading = loadedTab !== activeTab || isRefreshing;
  const isOverall = activeTab === "all";
  const list = isOverall ? overallList : gameList;

  const topThree = list.slice(0, 3);
  const restList = list.slice(3);

  function formatTime(ms: number) {
    if (!ms) return "—";
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}m ${sec}s`;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Tab switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-paper/10 bg-surface p-3.5 sm:p-4">
        {/* Tabs */}
        <div className="inline-flex rounded-xl border border-paper/10 bg-paper/[0.04] p-1 overflow-x-auto max-w-full">
          {[
            { id: "all" as const, label: "Overall Rankings" },
            { id: "jigsaw" as const, label: "Archive Jigsaw" },
            { id: "crossword" as const, label: "Tech Crossword" },
            { id: "memory" as const, label: "Memory Matrix" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-2.5 sm:px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? "bg-[var(--blue)] text-white shadow-sm"
                  : "text-paper/70 hover:text-paper hover:bg-paper/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={refreshLeaderboard}
          disabled={loading}
          className="rounded-xl border border-paper/20 bg-paper/10 px-3 py-1.5 text-xs font-mono text-paper hover:bg-paper/20 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{loading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-[var(--red)]/30 bg-[var(--red)]/10 p-4 text-center text-xs text-[var(--red)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue)] border-t-transparent" />
          <span className="text-xs font-mono text-paper/60">Loading authenticated rankings...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-3xl border border-paper/10 bg-surface p-10 sm:p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--blue)]/20 text-[var(--blue)] mx-auto mb-3">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-paper">No scores published yet</h3>
          <p className="mt-1 text-xs text-paper/70 max-w-sm mx-auto">
            Play any of the mini games and sign in with Google upon completion to publish your score here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:gap-8">
          {/* Top 3 Podium Cards */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 sm:pt-6 items-end">
              {/* 2nd Place (Silver) */}
              {topThree[1] ? (
                <div className="order-2 md:order-1 rounded-3xl border border-paper/20 bg-surface p-5 sm:p-6 text-center shadow-lg relative">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-paper/30 bg-ink px-3 py-0.5 text-xs font-bold font-mono text-paper/80">
                    2nd Place
                  </span>
                  <div className="mx-auto mt-2 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-paper/30 bg-paper/10 overflow-hidden relative">
                    {"userImage" in topThree[1] && topThree[1].userImage ? (
                      <Image
                        src={topThree[1].userImage}
                        alt={topThree[1].userName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-lg sm:text-xl font-bold text-paper">
                        {topThree[1].userName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <h4 className="mt-3 text-sm sm:text-base font-bold text-paper truncate">
                    {topThree[1].userName}
                  </h4>
                  <div className="mt-1 text-xl sm:text-2xl font-extrabold font-mono text-paper/90">
                    {"totalScore" in topThree[1]
                      ? topThree[1].totalScore.toLocaleString()
                      : "score" in topThree[1]
                      ? topThree[1].score.toLocaleString()
                      : 0}
                    <span className="text-xs font-mono text-paper/50 ml-1">pts</span>
                  </div>
                  <div className="mt-2 text-[11px] font-mono text-paper/60">
                    {"fastestTimeMs" in topThree[1]
                      ? `Fastest: ${formatTime(topThree[1].fastestTimeMs)}`
                      : "timeMs" in topThree[1]
                      ? `Time: ${formatTime(topThree[1].timeMs)}`
                      : ""}
                  </div>
                </div>
              ) : (
                <div className="order-2 md:order-1 hidden md:block" />
              )}

              {/* 1st Place (Gold Champion) */}
              {topThree[0] && (
                <div className="order-1 md:order-2 rounded-3xl border-2 border-[var(--yellow)] bg-surface-raised p-6 sm:p-7 text-center shadow-2xl relative scale-[1.02] sm:scale-[1.03]">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full border border-[var(--yellow)] bg-[var(--yellow)] px-4 py-0.5 text-xs font-bold font-mono text-black shadow-md">
                    1st Place
                  </div>
                  <div className="mx-auto mt-2 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-3 border-[var(--yellow)] bg-[var(--yellow)]/10 overflow-hidden relative shadow-[0_0_20px_rgba(249,171,0,0.3)]">
                    {"userImage" in topThree[0] && topThree[0].userImage ? (
                      <Image
                        src={topThree[0].userImage}
                        alt={topThree[0].userName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-xl sm:text-2xl font-bold text-[var(--yellow)]">
                        {topThree[0].userName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <h4 className="mt-3 text-base sm:text-lg font-bold text-paper truncate">
                    {topThree[0].userName}
                  </h4>
                  <div className="mt-1 text-2xl sm:text-3xl font-extrabold font-mono text-[var(--yellow)]">
                    {"totalScore" in topThree[0]
                      ? topThree[0].totalScore.toLocaleString()
                      : "score" in topThree[0]
                      ? topThree[0].score.toLocaleString()
                      : 0}
                    <span className="text-xs font-mono text-paper/60 ml-1">pts</span>
                  </div>
                  <div className="mt-2 text-xs font-mono text-paper/70">
                    {"gamesPlayed" in topThree[0]
                      ? `${topThree[0].gamesPlayed} Games Completed`
                      : "timeMs" in topThree[0]
                      ? `Time: ${formatTime(topThree[0].timeMs)}`
                      : ""}
                  </div>
                </div>
              )}

              {/* 3rd Place (Bronze) */}
              {topThree[2] ? (
                <div className="order-3 rounded-3xl border border-paper/20 bg-surface p-5 sm:p-6 text-center shadow-lg relative">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[#cd7f32]/40 bg-ink px-3 py-0.5 text-xs font-bold font-mono text-[#cd7f32]">
                    3rd Place
                  </span>
                  <div className="mx-auto mt-2 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-[#cd7f32]/40 bg-paper/10 overflow-hidden relative">
                    {"userImage" in topThree[2] && topThree[2].userImage ? (
                      <Image
                        src={topThree[2].userImage}
                        alt={topThree[2].userName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-lg sm:text-xl font-bold text-paper">
                        {topThree[2].userName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <h4 className="mt-3 text-sm sm:text-base font-bold text-paper truncate">
                    {topThree[2].userName}
                  </h4>
                  <div className="mt-1 text-xl sm:text-2xl font-extrabold font-mono text-[#cd7f32]">
                    {"totalScore" in topThree[2]
                      ? topThree[2].totalScore.toLocaleString()
                      : "score" in topThree[2]
                      ? topThree[2].score.toLocaleString()
                      : 0}
                    <span className="text-xs font-mono text-paper/50 ml-1">pts</span>
                  </div>
                  <div className="mt-2 text-[11px] font-mono text-paper/60">
                    {"fastestTimeMs" in topThree[2]
                      ? `Fastest: ${formatTime(topThree[2].fastestTimeMs)}`
                      : "timeMs" in topThree[2]
                      ? `Time: ${formatTime(topThree[2].timeMs)}`
                      : ""}
                  </div>
                </div>
              ) : (
                <div className="order-3 hidden md:block" />
              )}
            </div>
          )}

          {/* Leaderboard Table (#4 to #50) */}
          {restList.length > 0 && (
            <div className="rounded-3xl border border-paper/10 bg-surface overflow-hidden">
              <div className="px-5 sm:px-6 py-3.5 border-b border-paper/10">
                <h4 className="text-xs font-mono uppercase tracking-wider text-paper/60">
                  Rankings
                </h4>
              </div>
              <div className="divide-y divide-paper/10">
                {restList.map((entry, idx) => {
                  const rank = idx + 4;
                  const isCurrentUser =
                    currentUserId && "userId" in entry && entry.userId === currentUserId;

                  return (
                    <div
                      key={"id" in entry ? entry.id : entry.userId}
                      className={`flex items-center justify-between px-4 sm:px-6 py-3 transition-colors ${
                        isCurrentUser
                          ? "bg-[var(--blue)]/10 border-l-4 border-[var(--blue)]"
                          : "hover:bg-paper/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-center text-xs font-mono font-bold text-paper/60 shrink-0">
                          #{rank}
                        </span>
                        <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-paper/10 overflow-hidden relative shrink-0">
                          {entry.userImage ? (
                            <Image
                              src={entry.userImage}
                              alt={entry.userName}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-paper">
                              {entry.userName.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold text-paper flex items-center gap-1.5 truncate">
                            <span className="truncate">{entry.userName}</span>
                            {isCurrentUser && (
                              <span className="rounded bg-[var(--blue)]/30 px-1.5 py-0.2 text-[9px] font-mono text-[var(--blue-halftone)] shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] sm:text-[11px] font-mono text-paper/50 truncate">
                            {"levelData" in entry && entry.levelData ? entry.levelData : "DevFest Player"}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-3">
                        <div className="text-sm sm:text-base font-bold font-mono text-[var(--blue-halftone)]">
                          {"totalScore" in entry
                            ? entry.totalScore.toLocaleString()
                            : "score" in entry
                            ? entry.score.toLocaleString()
                            : 0}{" "}
                          <span className="text-[10px] sm:text-xs font-mono text-paper/50 font-normal">pts</span>
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-mono text-paper/50">
                          {"fastestTimeMs" in entry
                            ? formatTime(entry.fastestTimeMs)
                            : "timeMs" in entry
                            ? formatTime(entry.timeMs)
                            : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
