"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import type { LeaderboardEntry, OverallLeaderboardEntry } from "@/lib/leaderboard";
import { GAME_VARIANTS, defaultVariant, type GameId } from "@/lib/game-rules";
import { GlowButton } from "@/components/GlowButton";

type LeaderboardTab = "all" | GameId;
type Row = LeaderboardEntry | OverallLeaderboardEntry;

/** How many ranks the list shows. A signed-in player also gets a row of their own under it, with their real rank. */
const TOP_N = 10;

/** `/api/games/scores/me`: where the signed-in player stands on the board being shown. */
type Mine = { rank: number | null; entry: Row | null; total: number | null };

/** What the second row of toggles is called under each mode (the names match the game's settings). */
const SUB_LABEL: Record<string, string> = {
  "Time Attack": "Duration",
  "Words Count": "Length",
  "Tile Swap": "Grid",
  "Classic Slide": "Grid",
};

export function LeaderboardView() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.uid;

  const [activeTab, setActiveTab] = useState<LeaderboardTab>("all");
  // The board picked within each game (jigsaw 4x4, typing 30s, …); unset = that game's first.
  const [picked, setPicked] = useState<Partial<Record<GameId, string>>>({});
  const [refreshCount, setRefreshCount] = useState(0);
  // What was last received, tagged with the request that produced it. Whatever doesn't
  // match the request now on screen is ignored, so a slow answer for a board you've
  // already left can never overwrite the one you're looking at.
  const [loaded, setLoaded] = useState<{ key: string; rows: Row[]; failed: boolean } | null>(null);

  const isOverall = activeTab === "all";
  const boards = isOverall ? [] : GAME_VARIANTS[activeTab];
  const variant = isOverall ? "" : (picked[activeTab] ?? defaultVariant(activeTab));
  const requestKey = `${activeTab}|${variant}|${refreshCount}`;

  // Games whose boards are grouped (Speed Typer) get a mode row above the board row.
  const groups = [...new Set(boards.flatMap((b) => (b.group ? [b.group] : [])))];
  const group = boards.find((b) => b.id === variant)?.group;
  const visibleBoards = groups.length > 0 ? boards.filter((b) => b.group === group) : boards;
  const choose = (id: string | undefined) => {
    if (id && !isOverall) setPicked((p) => ({ ...p, [activeTab]: id }));
  };

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ gameId: activeTab, limit: String(TOP_N) });
    if (variant) params.set("variant", variant);

    fetch(`/api/games/scores?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        return res.json() as Promise<{ leaderboard?: Row[] }>;
      })
      .then((data) => setLoaded({ key: requestKey, rows: data.leaderboard ?? [], failed: false }))
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setLoaded({ key: requestKey, rows: [], failed: true });
      });

    return () => controller.abort();
  }, [activeTab, variant, requestKey]);

  // The signed-in player's own place on this board. Kept apart from the list because the list
  // is the same for everyone (and cached), while this is personal. The session arrives a
  // moment after the page, hence `currentUserId` in the key and the deps.
  const [mineLoaded, setMineLoaded] = useState<{ key: string; mine: Mine } | null>(null);
  const mineKey = `${requestKey}|${currentUserId ?? ""}`;

  useEffect(() => {
    if (!currentUserId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ gameId: activeTab });
    if (variant) params.set("variant", variant);

    fetch(`/api/games/scores/me?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Mine>) : null))
      .then((mine) => mine && setMineLoaded({ key: mineKey, mine }))
      .catch(() => {});

    return () => controller.abort();
  }, [activeTab, variant, currentUserId, mineKey]);

  const mine = currentUserId && mineLoaded?.key === mineKey ? mineLoaded.mine : null;

  const current = loaded?.key === requestKey ? loaded : null;
  const loading = current === null;
  const error = current?.failed ? "Unable to load leaderboard. Please try again." : null;
  const list = current?.rows ?? [];

  const refreshLeaderboard = () => setRefreshCount((n) => n + 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "all" as const, label: "Overall" },
          { id: "jigsaw" as const, label: "Jigsaw" },
          { id: "crossword" as const, label: "Crossword" },
          { id: "memory" as const, label: "Memory" },
          { id: "typing" as const, label: "Speed Typer" },
        ].map((tab) => (
          <Pill key={tab.id} on={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </Pill>
        ))}
        <button
          type="button"
          onClick={refreshLeaderboard}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-paper/60 transition-colors hover:text-paper disabled:opacity-50 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{loading ? "Refreshing…" : "Refresh"}</span>
        </button>
      </div>

      {boards.length > 0 && (
        <div className="flex flex-col gap-2">
          {groups.length > 0 && (
            <ToggleRow
              label="Mode"
              options={groups.map((g) => ({ id: g, label: g }))}
              selected={group}
              // Switching mode lands on that mode's first board.
              onSelect={(g) => choose(boards.find((b) => b.group === g)?.id)}
            />
          )}
          <ToggleRow
            label={(group && SUB_LABEL[group]) || "Board"}
            options={visibleBoards}
            selected={variant}
            onSelect={choose}
          />
        </div>
      )}

      {activeTab === "all" && (
        <p className="max-w-xl text-xs leading-relaxed text-paper/60">
          Your overall score is the sum of your best score in each mini-game. Play all four to climb.
        </p>
      )}

      {error && <p className="text-center text-xs text-red">{error}</p>}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-paper/60 border-t-transparent" />
          <span className="text-xs text-paper/60">Loading rankings…</span>
        </div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center">
          <h3 className="text-lg font-semibold text-paper">No scores published yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-paper/60">
            Play any of the mini games and sign in with Google when you finish to publish your score here.
          </p>
        </div>
      ) : (
        <div>
          <h4 className="px-2 pb-3 text-[11px] uppercase tracking-[0.2em] text-paper/50">
            {list.length >= TOP_N ? `Top ${TOP_N}` : `${list.length} ${list.length === 1 ? "player" : "players"}`}
          </h4>
          <ol className="flex flex-col gap-2.5">
            {list.map((entry, idx) => (
              <RankRow
                key={"id" in entry ? entry.id : entry.userId}
                entry={entry}
                rank={idx + 1}
                isOverall={isOverall}
                isTyping={activeTab === "typing"}
                isYou={!!currentUserId && entry.userId === currentUserId}
              />
            ))}
          </ol>
          {/* Below the top TOP_N the player gets one extra row after a gap, showing their real rank. */}
          {mine?.entry && mine.rank && mine.rank > TOP_N && (
            <>
              <div aria-hidden="true" className="py-3 text-center text-lg leading-none tracking-[0.6em] text-paper/30">
                ···
              </div>
              <ol>
                <RankRow entry={mine.entry} rank={mine.rank} isOverall={isOverall} isTyping={activeTab === "typing"} isYou />
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(ms: number) {
  if (!ms) return "—";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

const MEDAL: Record<number, string> = { 1: "lb-medal--gold", 2: "lb-medal--silver", 3: "lb-medal--bronze" };

function RankRow({
  entry,
  rank,
  isOverall,
  isTyping,
  isYou,
}: {
  entry: Row;
  rank: number;
  isOverall: boolean;
  isTyping: boolean;
  isYou: boolean;
}) {
  const top = rank <= 3;
  const score = "totalScore" in entry ? entry.totalScore : "score" in entry ? entry.score : 0;
  const detail = "levelData" in entry ? entry.levelData : null;
  // Speed Typer's detail is "112 WPM | 99% ACC": too wide to lead the row on a phone (it squeezed
  // the name to an initial), so the speed leads on the right, accuracy under it, and points go left.
  const [speed, accuracy] = isTyping && detail ? detail.split(" | ") : [null, null];

  // A gold / silver / bronze ring marks the top three, the rainbow one the player's own row (it
  // wins over a medal ring, but the rank numeral keeps its medal colour); everyone else lies flat.
  const ring = isYou ? "lb-ring lb-ring--you" : top ? "lb-ring" : "hover:bg-paper/[0.03]";

  return (
    <li
      aria-current={isYou ? "true" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-3 transition-colors sm:gap-4 sm:px-5 ${
        top ? "py-4 sm:py-5" : "py-3"
      } ${top ? MEDAL[rank] : ""} ${ring}`}
    >
      <span
        className={`w-9 shrink-0 text-center tabular-nums sm:w-11 ${
          top
            ? "text-3xl font-semibold text-[color:var(--lb-text)] sm:text-4xl"
            : `text-xl font-light sm:text-2xl ${isYou ? "text-paper" : "text-paper/40"}`
        }`}
      >
        <span className="sr-only">Rank </span>
        {rank}
      </span>

      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/10 ${
          top ? "h-11 w-11 sm:h-12 sm:w-12" : "h-9 w-9"
        }`}
      >
        {entry.userImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.userImage} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-paper">{entry.userName.charAt(0)}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-2 truncate text-paper ${top ? "text-base font-semibold sm:text-lg" : "text-sm font-medium sm:text-base"}`}>
          <span className="truncate">{entry.userName}</span>
          {isYou && (
            <span className="shrink-0 rounded bg-paper/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-paper/80">
              You
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-paper/50 sm:text-xs">
          {isOverall && "gamesPlayed" in entry
            ? `${entry.gamesPlayed} of 4 games played`
            : speed
              ? `${score.toLocaleString()} pts`
              : detail || "DevFest player"}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {speed ? (
          <>
            <div className={`font-semibold tabular-nums text-paper ${top ? "text-xl sm:text-3xl" : "text-lg sm:text-xl"}`}>{speed}</div>
            <div className="text-[11px] text-paper/50 sm:text-xs">{accuracy}</div>
          </>
        ) : (
          <>
            <div className={`font-semibold tabular-nums text-paper ${top ? "text-xl sm:text-3xl" : "text-lg sm:text-xl"}`}>
              {score.toLocaleString()} <span className="text-[11px] font-normal text-paper/50 sm:text-xs">pts</span>
            </div>
            <div className="text-[11px] text-paper/50 sm:text-xs">
              {"fastestTimeMs" in entry ? formatTime(entry.fastestTimeMs) : "timeMs" in entry ? formatTime(entry.timeMs) : ""}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

/** A glow-button pill, as on the agenda's track filters; the selected one is lit and bolder. */
function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <GlowButton
      shape="pill"
      size="sm"
      pressed={on}
      onClick={onClick}
      textClassName={on ? "text-paper font-semibold" : "text-paper/60 font-medium"}
      className={on ? "agenda-board-pill--active" : ""}
    >
      {children}
    </GlowButton>
  );
}

/** A labelled row of pills where exactly one is on. */
function ToggleRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly { id: string; label: string }[];
  selected: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-paper/50">{label}</span>
      {options.map((option) => (
        <Pill key={option.id} on={option.id === selected} onClick={() => onSelect(option.id)}>
          {option.label}
        </Pill>
      ))}
    </div>
  );
}
