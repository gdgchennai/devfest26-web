"use client";

import { useActionState } from "react";
import { updateDisplayName, type DisplayNameState } from "@/app/profile/actions";

export function DisplayNameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<DisplayNameState, FormData>(updateDisplayName, {});

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor="displayName" className="sr-only">
        Display name
      </label>
      <input
        id="displayName"
        name="displayName"
        type="text"
        maxLength={60}
        defaultValue={current}
        placeholder="Display name"
        className="w-full rounded-lg border border-paper/15 bg-transparent px-3 py-2 text-sm text-paper placeholder:text-paper/40 focus:border-paper/40 focus:outline-none sm:w-64"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-paper/15 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-paper/40 hover:text-paper disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.ok && <span className="text-sm text-green-400">Saved</span>}
      {state.error && <span className="text-sm text-red-400">{state.error}</span>}
    </form>
  );
}
