"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { setDisplayName } from "@/lib/users";

export type DisplayNameState = { ok?: boolean; error?: string };

export async function updateDisplayName(
  _prev: DisplayNameState,
  formData: FormData,
): Promise<DisplayNameState> {
  const session = await auth();
  if (!session?.user?.uid) return { error: "Not signed in." };

  const raw = String(formData.get("displayName") ?? "").trim();
  if (raw.length > 60) return { error: "Keep it under 60 characters." };

  await setDisplayName(session.user.uid, raw.length > 0 ? raw : null);
  revalidatePath("/profile");
  return { ok: true };
}
