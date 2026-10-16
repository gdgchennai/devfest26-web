"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "@/components/games/useDialog";
import { formatSessionTime } from "@/lib/format";
import { hallTiming, moveHallPriority } from "@/lib/hall-admin-model";
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
import type { AgendaSession, Speaker } from "@/lib/schemas";
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
  disabled = false,
}: {
  zone: (typeof hallZones)[number];
  measurement?: Occupancy;
  disabled?: boolean;
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
      <fieldset disabled={disabled || pending}>
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
      </fieldset>
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
  const statusOf = (id: string) =>
    snapshot.sessions.find((e) => e.session === id)?.status;
  const available = agenda
    .filter(
      (s) =>
        s.track === card.zone.id &&
        s.type !== "break" &&
        statusOf(s.id) !== "started",
    )
    .sort(
      (a, b) =>
        Date.parse(a.start) - Date.parse(b.start) || a.id.localeCompare(b.id),
    );
  const lastEnded = [...(snapshot.sessions ?? [])]
    .filter(
      (e) =>
        e.status === "ended" && available.some((s) => s.id === e.session),
    )
    .sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))[0];
  const suggested =
    card.phase === "current"
      ? card.next
      : (card.primary ?? available.find((s) => s.id === lastEnded?.session));
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
              {!choices.length && (
                <option value="">No events on this track</option>
              )}
              {choices.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i === 0 ? "Next in order · " : ""}
                  {s.title}
                  {statusOf(s.id) === "ended" ? " (ended)" : ""}
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
        Ended events stay in this list and can be started again.
      </p>
    </div>
  );
}
type Card = ReturnType<typeof trackCards>[number];
function EventEditor({
  speakers,
  c,
  snapshot,
  agenda,
  organizer,
  pending,
  run,
  promote,
}: {
  speakers: Speaker[];
  c: Card;
  snapshot: HallSnapshot;
  agenda: AgendaSession[];
  organizer: boolean;
  pending: boolean;
  run: (mutation: HallMutation) => Promise<void>;
  promote: (session: string, changes: Partial<Promotion>) => void;
}) {
  return (
    <article
      data-admin-zone={c.zone.id}
      className={`rounded-xl border bg-surface p-5 ${c.promotion?.recommended ? "border-blue/70" : "border-paper/15"}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-paper/60">
            {c.primary?.hall} ·{" "}
            {c.phase === "current"
              ? "On now"
              : c.primary
                ? "Upcoming · awaiting start"
                : "All events ended"}
          </p>
          <h2
            id={`hall-editor-title-${c.zone.id}`}
            className="text-lg font-semibold leading-snug"
          >
            {c.primary?.title ?? "No remaining events"}
          </h2>
          {c.primary && (
            <p className="mt-2 text-sm text-paper/70">
              {c.primary.speakerSlugs
                .map((id) => speakers.find((s) => s.slug === id)?.name)
                .filter(Boolean)
                .join(", ") || "No speaker listed"}
              <span className="mt-1 block text-xs text-paper/60">
                Planned: {formatSessionTime(c.primary.start)}–
                {formatSessionTime(c.primary.end)} IST
              </span>
            </p>
          )}
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
                Pinned · priority {c.promotion.position + 1}
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
          {c.occupancy ? `${100 - c.occupancy.occupied}% remaining` : ""}
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
      {organizer && c.primary && (
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
                        ...snapshot.promotions.map((p) => p.position ?? -1),
                      ) + 1
                    : null,
                })
              }
            />
            Pinned
          </label>
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
        disabled={pending}
      />
    </article>
  );
}
function EditorPopup({
  zone,
  children,
  onClose,
}: {
  zone: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, true, onClose);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return createPortal(
    <div
      className="fixed inset-0 z-999 flex items-center justify-center bg-ink/80 p-2 sm:p-5"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`hall-editor-title-${zone}`}
        tabIndex={-1}
        data-lenis-prevent
        className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-paper/20 bg-surface-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-paper/10 px-4">
          <span className="text-sm text-paper/60">Edit live event</span>
          <button
            onClick={onClose}
            className="min-h-11 px-3"
            aria-label="Close event editor"
          >
            ✕ Close
          </button>
        </div>
        <div className="overflow-y-auto" data-lenis-prevent>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
export function HallAdmin({
  agenda,
  speakers,
}: {
  agenda: AgendaSession[];
  speakers: Speaker[];
}) {
  const { snapshot, connected, now } = useHallLive();
  const [access, setAccess] = useState<Access | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    expected: number;
    promotions: Promotion[];
    order: string[];
  } | null>(null);
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
    if (!busy && !selected && !draft)
      queueMicrotask(() => {
        if (!cancelled) setOrder(desired.split(",").filter(Boolean));
      });
    return () => {
      cancelled = true;
    };
  }, [busy, selected, draft, desired]);
  const rowOrder = draft?.order ?? order;
  const displayed = rowOrder.length
    ? rowOrder
        .map((id) => cards.find((c) => c.zone.id === id))
        .filter((c) => !!c)
        .concat(cards.filter((c) => !rowOrder.includes(c.zone.id)))
    : cards;
  const staleDraft = !!draft && snapshot?.revision !== draft.expected;
  async function run(mutation: HallMutation) {
    setPending(true);
    try {
      const saved = await save(mutation);
      setOrder(
        trackCards(agenda, saved)
          .filter((c) => access?.zones.includes(c.zone.id))
          .map((c) => c.zone.id),
      );
      if (mutation.kind === "promotions" || mutation.kind === "reset")
        setDraft(null);
      setMessage("Saved · participant view updated");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  function promote(session: string, changes: Partial<Promotion>) {
    if (!snapshot || draft) return;
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
    void run({
      kind: "promotions",
      promotions: promotions.map((p) => ({
        ...p,
        position: p.position === null ? null : position++,
      })),
      expected: snapshot.revision,
    });
  }
  function move(from: string, to: string) {
    if (!snapshot || pending || staleDraft) return;
    const preview = {
      ...snapshot,
      promotions: draft?.promotions ?? snapshot.promotions,
    };
    const promotions = moveHallPriority(
      agenda,
      preview,
      from,
      to,
      displayed.map((c) => c.zone.id),
    );
    setDraft({
      expected: draft?.expected ?? snapshot.revision,
      promotions,
      order: trackCards(agenda, { ...snapshot, promotions }).map(
        (c) => c.zone.id,
      ),
    });
    setMessage("Priority draft updated. Save priorities to publish.");
  }
  const editorCard = cards.find((c) => c.zone.id === selected);
  const editor = (c: Card) =>
    snapshot && (
      <EventEditor
        speakers={speakers}
        c={c}
        snapshot={snapshot}
        agenda={agenda}
        organizer={!!access?.actor.organizer}
        pending={pending || !!draft}
        run={run}
        promote={promote}
      />
    );
  return (
    <div className="mx-auto max-w-5xl px-3 pb-20 pt-24 sm:px-8">
      <AdminNav
        active="/admin/halls"
        showPeople={
          !!access?.actor.organizer || !!access?.actor.adminZones?.length
        }
      />
      <div className="my-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Hall control</h1>
        <span className={`text-xs ${connected ? "text-green" : "text-yellow"}`}>
          {connected ? "● Live" : "○ Offline / reconnecting"}
        </span>
      </div>
      {process.env.NEXT_PUBLIC_HALL_ISOLATED === "1" && (
        <details className="mb-3 rounded-lg border border-yellow/30 px-3 py-2 text-xs">
          <summary className="cursor-pointer text-yellow">
            Local test tools
          </summary>
          <LocalHallTools snapshot={snapshot} />
        </details>
      )}
      {!access && (
        <p className="text-sm text-paper/60">Checking permissions…</p>
      )}
      {access?.actor.organizer ? (
        <>
          <p className="mb-3 text-xs leading-relaxed text-paper/60">
            Most available first by default. Each track shows its first event
            until a lead starts one. Pinned events take priority. Open an event
            to edit. Use arrows, then Save priorities to publish a pinned order.
          </p>
          <div className="sticky top-16 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-paper/15 bg-surface px-3 py-2">
            <button
              disabled={!draft || pending || staleDraft || !connected}
              onClick={() =>
                draft &&
                run({
                  kind: "promotions",
                  promotions: draft.promotions,
                  expected: draft.expected,
                })
              }
              className="min-h-11 rounded-lg bg-blue px-3 text-sm text-white disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save priorities"}
            </button>
            <button
              disabled={!snapshot || pending || !!draft || !connected}
              onClick={() => {
                if (
                  !snapshot ||
                  !window.confirm(
                    "Clear every started and ended event, pin, recommendation and occupancy report? Each track will show its first event as upcoming.",
                  )
                )
                  return;
                setDraft(null);
                void run({ kind: "reset", expected: snapshot.revision });
              }}
              className="min-h-11 rounded-lg border border-paper/20 px-3 text-sm disabled:opacity-40"
            >
              Reset to first events
            </button>
            {draft && (
              <button
                disabled={pending}
                onClick={() => {
                  setDraft(null);
                  setOrder(cards.map((c) => c.zone.id));
                  setMessage("Draft discarded. Live order restored.");
                }}
                className="min-h-11 px-2 text-sm text-paper/70"
              >
                Discard
              </button>
            )}
            <span
              className={`text-xs ${staleDraft ? "text-yellow" : "text-paper/60"}`}
            >
              {staleDraft
                ? "Live data changed. Discard and reorder again."
                : draft
                  ? "Unsaved order · participants still see the saved order"
                  : "Order matches participant view"}
            </span>
          </div>
          <p role="status" className="mb-2 text-xs text-blue">
            {message}
          </p>
          <ol
            className="divide-y divide-paper/10 overflow-hidden rounded-xl border border-paper/15 bg-surface"
            data-admin-overview
            onPointerEnter={() => setBusy(true)}
            onPointerLeave={() => {
              if (!document.activeElement?.closest("[data-admin-overview]"))
                setBusy(false);
            }}
            onFocusCapture={() => setBusy(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setBusy(false);
            }}
          >
            {displayed.map((c, index) => {
              const s = c.primary;
              const timing = hallTiming(s, c.phase, now || snapshot!.serverNow);
              const names =
                s?.speakerSlugs
                  .map((id) => speakers.find((p) => p.slug === id)?.name)
                  .filter(Boolean)
                  .join(", ") || "No speaker listed";
              return (
                <li
                  key={c.zone.id}
                  className="flex items-stretch gap-1 px-2 py-2 sm:gap-3 sm:px-4"
                  data-overview-zone={c.zone.id}
                >
                  <button
                    className="min-w-0 flex-1 rounded py-1 text-left hover:bg-paper/5 focus-visible:outline-2 focus-visible:outline-blue"
                    aria-label={`Edit ${s?.title ?? c.zone.name}`}
                    onClick={() => setSelected(c.zone.id)}
                  >
                    <span className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
                      {s?.title ?? `${c.zone.name} · All events ended`}
                    </span>
                    <span
                      className="mt-0.5 block truncate text-xs text-paper/60"
                      title={names}
                    >
                      {names}
                    </span>
                    <span className={`mt-1 block text-xs ${timing.tone}`}>
                      {s
                        ? `${formatSessionTime(s.start)}–${formatSessionTime(s.end)} IST · `
                        : ""}
                      {timing.label}
                      {c.phase === "current" ? " · Live" : ""}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          role="progressbar"
                          aria-label={`${s?.title ?? c.zone.name} occupied`}
                          aria-valuenow={c.occupancy?.occupied}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-1 w-16 overflow-hidden rounded-full bg-paper/15 sm:w-24"
                        >
                          <span
                            className={`block h-full ${c.occupancy ? occupancyColor(c.occupancy.occupied) : "bg-paper/15"}`}
                            style={{ width: `${c.occupancy?.occupied ?? 0}%` }}
                          />
                        </span>
                        <span>
                          {c.occupancy
                            ? `${c.occupancy.occupied}%${c.occupancy.occupied === 100 ? " Full" : " occupied"}`
                            : "Unknown"}
                        </span>
                      </span>
                      {c.promotion?.position != null && (
                        <span className="text-paper/70">Pinned</span>
                      )}
                      {c.promotion?.recommended && (
                        <span className="text-blue">★ Recommended</span>
                      )}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col justify-center gap-1">
                    <button
                      aria-label={`Move ${s?.title ?? c.zone.name} up`}
                      disabled={
                        pending ||
                        staleDraft ||
                        !s ||
                        index === 0 ||
                        !displayed[index - 1]?.primary
                      }
                      onClick={() =>
                        move(c.zone.id, displayed[index - 1].zone.id)
                      }
                      className="h-11 w-11 rounded-lg border border-paper/15 text-lg hover:bg-paper/10 disabled:opacity-25"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${s?.title ?? c.zone.name} down`}
                      disabled={
                        pending ||
                        staleDraft ||
                        !s ||
                        index === displayed.length - 1 ||
                        !displayed[index + 1]?.primary
                      }
                      onClick={() =>
                        move(c.zone.id, displayed[index + 1].zone.id)
                      }
                      className="h-11 w-11 rounded-lg border border-paper/15 text-lg hover:bg-paper/10 disabled:opacity-25"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          {editorCard && (
            <EditorPopup
              zone={editorCard.zone.id}
              onClose={() => setSelected(null)}
            >
              {draft && (
                <p className="px-5 pt-4 text-sm text-yellow">
                  Save or discard the priority draft in the overview before
                  editing this event.
                </p>
              )}
              <p role="status" className="px-5 pt-3 text-sm text-blue">
                {message}
              </p>
              {editor(editorCard)}
            </EditorPopup>
          )}
        </>
      ) : (
        <>
          <p role="status" className="mb-3 text-sm text-blue">
            {message}
          </p>
          <div className="space-y-4">
            {displayed.map((c) => (
              <div key={c.zone.id}>{editor(c)}</div>
            ))}
          </div>
        </>
      )}
      {access && !access.zones.length && (
        <p>No tracks assigned. Ask a super admin for access.</p>
      )}
    </div>
  );
}
