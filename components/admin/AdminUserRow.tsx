"use client";

import { useState } from "react";

export function AdminUserRow({
  userId,
  name,
  email,
  ticketName,
  initialIsAdmin,
  envManaged,
  isSelf,
}: {
  userId: string;
  name: string | null;
  email: string | null;
  ticketName: string | null;
  initialIsAdmin: boolean;
  /** Admin via ADMIN_EMAILS — the DB flag is irrelevant and not editable here. */
  envManaged: boolean;
  isSelf: boolean;
}) {
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (pending || envManaged || (isSelf && isAdmin)) return;
    setPending(true);
    setError(null);
    const next = !isAdmin;
    setIsAdmin(next);
    try {
      const res = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, isAdmin: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? String(res.status));
      }
    } catch (e) {
      setIsAdmin(!next);
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setPending(false);
    }
  }

  const disabled = pending || envManaged || (isSelf && isAdmin);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper/10 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-paper">{name ?? "—"}</p>
        <p className="truncate text-xs text-paper/50">
          {email ?? "no email"} · {ticketName ?? "No ticket"}
        </p>
        {error && <p className="text-xs text-red">{error}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        title={envManaged ? "Managed via ADMIN_EMAILS" : isSelf && isAdmin ? "Can't remove your own access" : undefined}
        aria-pressed={isAdmin}
        className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
          isAdmin
            ? "border-paper bg-paper text-ink"
            : "border-paper/20 text-paper/70 hover:border-paper/40"
        }`}
      >
        {envManaged ? "Admin (env)" : isAdmin ? "Admin" : "Make admin"}
      </button>
    </div>
  );
}
