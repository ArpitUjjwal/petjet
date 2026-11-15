"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { markAllRead } from "@/lib/notifications/repository";

/** Marks the signed-in user's notifications as read. Works for owners and providers alike. */
export async function markAllReadAction(): Promise<{ ok: boolean; count: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, count: 0 };
  const count = await markAllRead(user.id);
  revalidatePath(user.role === "OWNER" ? "/app" : "/provider", "layout");
  return { ok: true, count };
}
