"use client";

import { useState } from "react";

export type RoleValue = "admin" | "track_lead" | null;
type Grant = { track: string; role: "admin" | "track_lead" };

const ROLE_LABEL = { admin: "Admin", track_lead: "Track lead" } as const;

export function AdminUserRow({
  userId,
  name,
  email,
  ticketName,
  initialRoles,
  trackNames,
  editableTracks,
  isSuperAdmin,
  isSelf,
}: {
  userId: string;
  name: string | null;
  email: string | null;
  ticketName: string | null;
  initialRoles: Grant[];
  /** Track slug → display name, for every track (to label roles you can't edit). */
  trackNames: Record<string, string>;
  /** Tracks the viewer may grant on — all of them for a super admin. */
  editableTracks: string[];
  /** This account is a super admin (ADMIN_EMAILS): full access, not editable. */
  isSuperAdmin: boolean;
  isSelf: boolean;
}) {
  const [roles, setRoles] = useState<Grant[]>(initialRoles);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleOn = (track: string): RoleValue => roles.find((g) => g.track === track)?.role ?? null;
  const canEdit = !isSuperAdmin && !isSelf && editableTracks.length > 0;

  async function setRole(track: string, role: RoleValue) {
    if (pending || role === roleOn(track)) return;
    setPending(track);
    setError(null);
    try {
      const res = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, track, role }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; roles?: Grant[] } | null;
      if (!res.ok) throw new Error(data?.error ?? String(res.status));
      setRoles(data?.roles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="border-b border-paper/10 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-paper">{name ?? "—"}</p>
          <p className="truncate text-xs text-paper/50">
            {email ?? "no email"} · {ticketName ?? "No ticket"}
          </p>
          {isSuperAdmin ? (
            <p className="mt-1 text-xs text-paper/70">Super admin (all tracks)</p>
          ) : (
            roles.length > 0 && (
              <p className="mt-1 text-xs text-paper/70">
                {roles.map((g) => `${trackNames[g.track] ?? g.track}: ${ROLE_LABEL[g.role]}`).join(" · ")}
              </p>
            )
          )}
          {error && <p className="text-xs text-red">{error}</p>}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="shrink-0 rounded-full border border-paper/20 px-3 py-1 text-xs text-paper/70 transition-colors hover:border-paper/40"
          >
            {open ? "Done" : "Roles"}
          </button>
        )}
      </div>

      {canEdit && open && (
        <ul className="mt-3 flex flex-col gap-2">
          {editableTracks.map((track) => (
            <li key={track} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-paper/80">{trackNames[track] ?? track}</span>
              <span className="flex gap-1" role="group" aria-label={`Role on ${trackNames[track] ?? track}`}>
                {([null, "track_lead", "admin"] as const).map((option) => (
                  <button
                    key={option ?? "none"}
                    type="button"
                    disabled={pending !== null}
                    onClick={() => setRole(track, option)}
                    aria-pressed={roleOn(track) === option}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
                      roleOn(track) === option
                        ? "border-paper bg-paper text-ink"
                        : "border-paper/20 text-paper/70 hover:border-paper/40"
                    }`}
                  >
                    {option === null ? "None" : ROLE_LABEL[option]}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
