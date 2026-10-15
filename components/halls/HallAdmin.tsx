"use client";
import { useEffect, useRef, useState } from "react";
import {
  hallZones,
  trackCards,
  occupancyColor,
  type HallMutation,
  type HallSnapshot,
  type Occupancy,
  type Promotion,
  type HallActor,
} from "@/lib/hall-model";
import type { AgendaSession } from "@/lib/schemas";
import { useHallLive } from "./useHallLive";
import { LocalHallTools } from "./LocalHallTools";
import { AdminNav } from "@/components/admin/AdminNav";

type Access = { actor: HallActor; zones: string[] };
async function save(mutation: HallMutation) {
  const response = await fetch("/api/admin/halls", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mutation),
  });
  const value = (await response.json()) as HallSnapshot & { error?: string };
  if (!response.ok)
    throw new Error(value.error ?? `Save failed (${response.status})`);
  return value as HallSnapshot;
}
function ZoneEditor({
  zone,
  measurement,
}: {
  zone: (typeof hallZones)[number];
  measurement?: Occupancy;
}) {
  const [value, setValue] = useState(measurement?.occupied ?? 0),
    [expected, setExpected] = useState(measurement?.revision ?? 0),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          const snapshot = await save({
            kind: "occupancy",
            zone: zone.id,
            occupied: value,
            expected,
          });
          setExpected(
            snapshot.occupancy.find((o) => o.zone === zone.id)!.revision,
          );
          setMessage("Saved");
        } catch (e) {
          setMessage((e as Error).message);
        } finally {
          setPending(false);
        }
      }}
      className="mt-4 border-t border-paper/15 pt-4"
    >
      <p className="mt-1 text-xs text-paper/60">
        Last reported:{" "}
        {measurement ? `${measurement.occupied}% occupied` : "Unknown"}
      </p>
      <label className="my-4 block">
        Occupied percentage{" "}
        <input
          aria-label={`${zone.name} occupied percentage`}
          type="number"
          min={0}
          max={100}
          step={1}
          required
          value={value}
          onChange={(e) => setValue(e.target.valueAsNumber)}
          className="ml-2 w-20 rounded border border-paper/25 p-2"
        />
      </label>
      <input
        aria-label={`${zone.name} occupancy slider`}
        type="range"
        min={0}
        max={100}
        value={Number.isNaN(value) ? 0 : value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full"
      />
      <div className="my-3 flex flex-wrap gap-2">
        {[0, 25, 50, 75, 100].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n)}
            className="min-h-11 rounded-lg border border-paper/20 px-3"
          >
            {n}%
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-paper/60">
        100% means Full / closed for entry.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={pending}
          className="min-h-11 rounded-lg bg-blue px-5 text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save occupancy"}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(measurement?.occupied ?? 0);
            setExpected(measurement?.revision ?? 0);
            setMessage("Latest value loaded");
          }}
          className="min-h-11 text-sm text-blue"
        >
          Load latest value
        </button>
      </div>
      <p role="status" className="mt-3 text-sm">
        {message}
      </p>
    </form>
  );
}
function EventControls({
  card,
  snapshot,
  agenda,
  run,
  pending,
}: {
  card: ReturnType<typeof trackCards>[number];
  snapshot: HallSnapshot;
  agenda: AgendaSession[];
  run: (mutation: HallMutation) => Promise<void>;
  pending: boolean;
}) {
  const [selected, setSelected] = useState("");
  const available = agenda
    .filter(
      (s) =>
        s.track === card.zone.id &&
        s.type !== "break" &&
        !snapshot.sessions.some((e) => e.session === s.id),
    )
    .sort(
      (a, b) =>
        Date.parse(a.start) - Date.parse(b.start) || a.id.localeCompare(b.id),
    );
  const suggested = card.phase === "current" ? card.next : card.primary;
  const choices = [...available].sort(
    (a, b) => Number(b.id === suggested?.id) - Number(a.id === suggested?.id),
  );
  const choice = choices.some((s) => s.id === selected)
    ? selected
    : (choices[0]?.id ?? "");
  return (
    <div className="mt-4 border-t border-paper/15 pt-4">
      {card.phase === "current" && card.primary ? (
        <button
          disabled={pending}
          className="min-h-11 rounded-lg border border-red/60 px-4 text-red disabled:opacity-40"
          onClick={() =>
            run({
              kind: "session",
              zone: card.zone.id,
              session: card.primary!.id,
              status: "ended",
              expected: snapshot.revision,
            })
          }
        >
          Mark event ended
        </button>
      ) : (
        <>
          <label className="block text-sm">
            Choose next event
            <select
              aria-label={`Next event for ${card.zone.name}`}
              value={choice}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-paper/20 bg-surface p-2"
            >
              {!choices.length && <option value="">All events ended</option>}
              {choices.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i === 0 ? "Next in order · " : ""}
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={pending || !choice}
            className="mt-3 min-h-11 rounded-lg bg-blue px-4 text-white disabled:opacity-40"
            onClick={() =>
              run({
                kind: "session",
                zone: card.zone.id,
                session: choice,
                status: "started",
                expected: snapshot.revision,
              })
            }
          >
            Start event
          </button>
        </>
      )}
      <p className="mt-2 text-xs text-paper/60">
        Events change only when started or ended here. Occupancy carries over.
      </p>
    </div>
  );
}
export function HallAdmin({ agenda }: { agenda: AgendaSession[] }) {
  const { snapshot, connected } = useHallLive();
  const [access, setAccess] = useState<Access | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const dragging = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/halls")
      .then(async (r) => {
        const data = (await r.json()) as Access & { error?: string };
        if (!r.ok) throw new Error(data.error);
        if (!cancelled) setAccess(data);
      })
      .catch((e) => {
        if (!cancelled) setMessage(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const cards = snapshot
    ? trackCards(agenda, snapshot).filter((c) =>
        access?.zones.includes(c.zone.id),
      )
    : [];
  const desired = cards.map((c) => c.zone.id).join(",");
  useEffect(() => {
    let cancelled = false;
    if (!busy)
      queueMicrotask(() => {
        if (!cancelled) setOrder(desired.split(",").filter(Boolean));
      });
    return () => {
      cancelled = true;
    };
  }, [busy, desired]);
  const displayed = order.length
    ? order
        .map((id) => cards.find((c) => c.zone.id === id))
        .filter((c) => !!c)
        .concat(cards.filter((c) => !order.includes(c.zone.id)))
    : cards;
  async function run(mutation: HallMutation) {
    setPending(true);
    try {
      const saved = await save(mutation);
      if (mutation.kind === "promotions")
        setOrder(
          trackCards(agenda, saved)
            .filter((c) => access?.zones.includes(c.zone.id))
            .map((c) => c.zone.id),
        );
      setMessage("Saved · participant view updated");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  function promote(session: string, changes: Partial<Promotion>) {
    if (!snapshot) return;
    const old = snapshot.promotions.find((p) => p.session === session) ?? {
      session,
      recommended: false,
      position: null,
    };
    const promotions = snapshot.promotions
      .filter((p) => p.session !== session)
      .concat({ ...old, ...changes })
      .filter((p) => p.recommended || p.position !== null)
      .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
    let position = 0;
    const normalized = promotions.map((p) => ({
      ...p,
      position: p.position === null ? null : position++,
    }));
    void run({
      kind: "promotions",
      promotions: normalized,
      expected: snapshot.revision,
    });
  }
  function move(from: string, to: string) {
    if (!snapshot || from === to) return;
    // Moving an ordinary event creates a pin; untouched ordinary cards keep availability sorting.
    const pinned = cards
      .filter((c) => c.primary && c.promotion?.position != null)
      .map((c) => c.primary!.id);
    const fromId = cards.find((c) => c.zone.id === from)?.primary?.id;
    const toId = cards.find((c) => c.zone.id === to)?.primary?.id;
    if (!fromId || !toId) return;
    let ids = pinned.filter((id) => id !== fromId);
    if (!ids.includes(toId)) ids.push(toId);
    const goingDown =
      displayed.findIndex((c) => c.zone.id === from) <
      displayed.findIndex((c) => c.zone.id === to);
    ids.splice(ids.indexOf(toId) + (goingDown ? 1 : 0), 0, fromId);
    // Preserve prepared pins for sessions not currently displayed.
    ids = ids.concat(
      snapshot.promotions
        .filter((p) => p.position !== null && !ids.includes(p.session))
        .map((p) => p.session),
    );
    const promotions = snapshot.promotions
      .filter((p) => !ids.includes(p.session))
      .concat(
        ids.map((session, position) => ({
          session,
          position,
          recommended:
            snapshot.promotions.find((p) => p.session === session)
              ?.recommended ?? false,
        })),
      );
    void run({ kind: "promotions", promotions, expected: snapshot.revision });
  }
  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-8">
      <AdminNav
        active="/admin/halls"
        showPeople={
          !!access?.actor.organizer || !!access?.actor.adminZones?.length
        }
      />
      <h1 className="my-6 text-3xl font-semibold">Hall control</h1>
      <LocalHallTools snapshot={snapshot} />
      <p className="mb-3 text-sm text-paper/60">
        {access
          ? access.actor.organizer
            ? "Super admin"
            : "Track controls"
          : "Checking permissions…"}{" "}
        · {connected ? "Connected" : "Offline / reconnecting"}
      </p>
      <p className="mb-5 text-sm text-paper/70">
        Default order: most available first. Pinned events appear above the
        default order. Recommended adds a badge without changing order.
        {access?.actor.organizer &&
          " Drag a handle or use Up / Down to pin events in priority order. Changes save immediately."}
      </p>
      <p role="status" className="mb-4 text-sm text-blue">
        {message}
      </p>
      <div
        className="space-y-4"
        onPointerEnter={() => setBusy(true)}
        onPointerLeave={() => {
          if (!document.activeElement?.closest("[data-admin-cards]"))
            setBusy(false);
        }}
        onFocusCapture={() => setBusy(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setBusy(false);
        }}
        data-admin-cards
      >
        {snapshot &&
          displayed.map((c, index) => (
            <article
              key={c.zone.id}
              data-admin-zone={c.zone.id}
              className={`rounded-xl border bg-surface p-5 ${c.promotion?.recommended ? "border-blue/70" : "border-paper/15"}`}
            >
              <div className="flex items-start gap-3">
                {access?.actor.organizer && c.primary && (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Drag ${c.primary.title}`}
                    className="min-h-11 min-w-11 touch-none rounded-lg bg-paper/5"
                    onPointerDown={(e) => {
                      dragging.current = c.zone.id;
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerUp={(e) => {
                      const target = document
                        .elementFromPoint(e.clientX, e.clientY)
                        ?.closest<HTMLElement>("[data-admin-zone]");
                      if (dragging.current && target)
                        move(dragging.current, target.dataset.adminZone!);
                      dragging.current = null;
                    }}
                    onPointerCancel={() => {
                      dragging.current = null;
                    }}
                  >
                    ⠿
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs text-paper/60">
                    {c.primary?.hall} ·{" "}
                    {c.phase === "current"
                      ? "On now"
                      : c.primary
                        ? "Upcoming · awaiting start"
                        : "All events ended"}
                  </p>
                  <h2 className="text-lg font-semibold leading-snug">
                    {c.primary?.title ?? "No remaining events"}
                  </h2>
                  <p className="mt-2 text-sm text-paper/60">
                    Up next: {c.next?.title ?? "No more events"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {c.promotion?.recommended && (
                      <span className="rounded-full bg-blue/15 px-2 py-1 text-blue">
                        ★ Recommended
                      </span>
                    )}
                    {c.promotion?.position != null && (
                      <span className="rounded-full bg-paper/10 px-2 py-1">
                        Pinned · priority{" "}
                        {cards
                          .filter((row) => row.promotion?.position != null)
                          .findIndex((row) => row.zone.id === c.zone.id) + 1}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-between gap-2 text-xs">
                <span>
                  {c.occupancy
                    ? `${c.occupancy.occupied}% occupied${c.occupancy.occupied === 100 ? " · Full" : ""}`
                    : "Occupancy unknown"}
                </span>
                <span>
                  {c.occupancy
                    ? `${100 - c.occupancy.occupied}% remaining`
                    : ""}
                </span>
              </div>
              {c.occupancy && (
                <div
                  className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper/15"
                  role="progressbar"
                  aria-label={`${c.primary?.title ?? c.zone.name} occupied`}
                  aria-valuenow={c.occupancy.occupied}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full ${occupancyColor(c.occupancy.occupied)}`}
                    style={{ width: `${c.occupancy.occupied}%` }}
                  />
                </div>
              )}
              {access?.actor.organizer && c.primary && (
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={pending}
                      checked={c.promotion?.recommended ?? false}
                      onChange={(e) =>
                        promote(c.primary!.id, {
                          recommended: e.target.checked,
                        })
                      }
                    />
                    Recommended
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={pending}
                      checked={c.promotion?.position != null}
                      onChange={(e) =>
                        promote(c.primary!.id, {
                          position: e.target.checked
                            ? Math.max(
                                -1,
                                ...snapshot.promotions.map(
                                  (p) => p.position ?? -1,
                                ),
                              ) + 1
                            : null,
                        })
                      }
                    />
                    Pinned
                  </label>
                  <button
                    disabled={pending || index === 0}
                    className="min-h-11 px-2 disabled:opacity-30"
                    onClick={() =>
                      move(c.zone.id, displayed[index - 1].zone.id)
                    }
                  >
                    ↑ Up
                  </button>
                  <button
                    disabled={pending || index === displayed.length - 1}
                    className="min-h-11 px-2 disabled:opacity-30"
                    onClick={() =>
                      move(c.zone.id, displayed[index + 1].zone.id)
                    }
                  >
                    ↓ Down
                  </button>
                </div>
              )}
              <EventControls
                card={c}
                snapshot={snapshot}
                agenda={agenda}
                run={run}
                pending={pending}
              />
              <ZoneEditor
                zone={{
                  ...c.zone,
                  name: c.primary?.title ?? "No remaining events",
                }}
                measurement={c.occupancy}
              />
            </article>
          ))}
      </div>
      {access && !access.zones.length && (
        <p>No tracks assigned. Ask a super admin for access.</p>
      )}
    </div>
  );
}
