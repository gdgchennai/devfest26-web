"use client";
import { useEffect, useRef, useState } from "react";
import {
  hallZones,
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
      className="rounded-xl border border-paper/15 bg-surface p-5"
    >
      <h2 className="font-semibold">{zone.name}</h2>
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
function PromotionEditor({
  snapshot,
  agenda,
}: {
  snapshot: HallSnapshot;
  agenda: AgendaSession[];
}) {
  const [draft, setDraft] = useState<Promotion[]>(
    snapshot.promotions
      .slice()
      .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity)),
  );
  const [expected, setExpected] = useState(snapshot.revision),
    [selected, setSelected] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const dragging = useRef<number | null>(null);
  function move(from: number, to: number) {
    setDraft((rows) => {
      const next = rows.slice(),
        [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }
  const eligible = agenda.filter(
    (s) =>
      s.track && s.type !== "break" && Date.parse(s.end) > snapshot.serverNow,
  );
  const normalize = () => {
    let position = 0;
    return draft.map((p) => ({
      ...p,
      position: p.position === null ? null : position++,
    }));
  };
  return (
    <section className="mt-8 rounded-xl border border-paper/15 bg-surface p-5">
      <h2 className="text-xl font-semibold">Session promotions</h2>
      <p className="mt-2 text-sm text-paper/60">
        Pinned sessions appear first, in list order. Recommendations only add a
        badge. Both expire at session end.
      </p>
      <div className="my-4 flex flex-wrap gap-3">
        <select
          aria-label="Session to promote"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-h-11 min-w-0 max-w-full flex-1 rounded border border-paper/20 bg-surface p-2"
        >
          <option value="">Choose an upcoming or current session</option>
          {eligible
            .filter((s) => !draft.some((p) => p.session === s.id))
            .map((s) => (
              <option value={s.id} key={s.id}>
                {s.title}
              </option>
            ))}
        </select>
        <button
          disabled={!selected}
          className="min-h-11 rounded border border-paper/20 px-4"
          onClick={() => {
            setDraft([
              ...draft,
              { session: selected, recommended: false, position: 100 },
            ]);
            setSelected("");
          }}
        >
          Add pin
        </button>
      </div>
      <ol className="space-y-3">
        {draft.map((p, index) => (
          <li
            key={p.session}
            data-promotion-index={index}
            className="rounded-lg border border-paper/15 p-3"
          >
            <div className="flex items-start gap-3">
              <button
                aria-label={`Drag ${agenda.find((s) => s.id === p.session)?.title}`}
                className="min-h-11 min-w-11 touch-none rounded bg-paper/5"
                onPointerDown={(e) => {
                  dragging.current = index;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerUp={(e) => {
                  const target = document
                    .elementFromPoint(e.clientX, e.clientY)
                    ?.closest<HTMLElement>("[data-promotion-index]");
                  if (dragging.current !== null && target)
                    move(
                      dragging.current,
                      Number(target.dataset.promotionIndex),
                    );
                  dragging.current = null;
                }}
                onPointerCancel={() => {
                  dragging.current = null;
                }}
              >
                ⠿
              </button>
              <p className="min-w-0 flex-1 py-2 text-sm">
                {agenda.find((s) => s.id === p.session)?.title ?? p.session}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.recommended}
                  onChange={(e) =>
                    setDraft(
                      draft.map((r, i) =>
                        i === index
                          ? { ...r, recommended: e.target.checked }
                          : r,
                      ),
                    )
                  }
                />
                Recommended
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.position !== null}
                  onChange={(e) =>
                    setDraft(
                      draft.map((r, i) =>
                        i === index
                          ? { ...r, position: e.target.checked ? 100 : null }
                          : r,
                      ),
                    )
                  }
                />
                Pinned
              </label>
              <button
                disabled={index === 0}
                aria-label={`Move ${index + 1} up`}
                onClick={() => move(index, index - 1)}
                className="min-h-11 px-2 disabled:opacity-30"
              >
                ↑ Up
              </button>
              <button
                disabled={index === draft.length - 1}
                aria-label={`Move ${index + 1} down`}
                onClick={() => move(index, index + 1)}
                className="min-h-11 px-2 disabled:opacity-30"
              >
                ↓ Down
              </button>
              <button
                className="min-h-11 px-2 text-red"
                onClick={() => setDraft(draft.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const state = await save({
                kind: "promotions",
                promotions: normalize(),
                expected,
              });
              setExpected(state.revision);
              setMessage("Promotions saved");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setPending(false);
            }
          }}
          className="min-h-11 rounded-lg bg-blue px-5 text-white disabled:opacity-50"
        >
          Save promotions
        </button>
        <button
          onClick={() => {
            setDraft(
              snapshot.promotions
                .slice()
                .sort(
                  (a, b) => (a.position ?? Infinity) - (b.position ?? Infinity),
                ),
            );
            setExpected(snapshot.revision);
            setMessage("Latest list loaded");
          }}
          className="min-h-11 text-blue"
        >
          Load latest list
        </button>
      </div>
      <p role="status" className="mt-3 text-sm">
        {message}
      </p>
    </section>
  );
}
export function HallAdmin({ agenda }: { agenda: AgendaSession[] }) {
  const { snapshot, connected } = useHallLive();
  const [access, setAccess] = useState<Access | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/halls")
      .then(async (r) => {
        const data = (await r.json()) as Access & { error?: string };
        if (!r.ok) throw new Error(data.error);
        if (!cancelled) setAccess(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-8">
      <AdminNav active="/admin/halls" />
      <h1 className="my-6 text-3xl font-semibold">Hall control</h1>
      <LocalHallTools snapshot={snapshot} />
      <p className="mb-5 text-sm text-paper/60">
        {access
          ? `${access.actor.organizer ? "Organizer" : "Zone lead"} · ${access.actor.id}`
          : error || "Checking permissions…"}{" "}
        · {connected ? "Connected" : "Offline / reconnecting"}
      </p>
      {access && snapshot && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {hallZones
              .filter((z) => access.zones.includes(z.id))
              .map((z) => (
                <ZoneEditor
                  key={z.id}
                  zone={z}
                  measurement={snapshot.occupancy.find((o) => o.zone === z.id)}
                />
              ))}
          </div>
          {!access.zones.length && (
            <p>No zones assigned. Ask an organizer for access.</p>
          )}
          {access.actor.organizer && (
            <PromotionEditor snapshot={snapshot} agenda={agenda} />
          )}
        </>
      )}
    </div>
  );
}
