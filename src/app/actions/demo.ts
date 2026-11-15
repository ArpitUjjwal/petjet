"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayISO } from "@/lib/rules/dates";
import { db } from "@/lib/db";
import { DEMO_ACCOUNTS } from "../../../prisma/demo-accounts";
import { demoSwitchTargets, isDemoWho } from "@/lib/auth/demo";
import { homeFor, isRole } from "@/lib/auth/roles";
import { createSession, getCurrentUser } from "@/lib/auth/session";

/**
 * One-click switch between the demo owner, vet and lab. Only works from one demo account to
 * another while DEMO_MODE isn't "false"; anything else is refused without changing the session.
 */
export async function switchDemoAccountAction(who: string): Promise<{ ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user || !isDemoWho(who) || demoSwitchTargets(user.email).length === 0) {
    return { ok: false, message: "Switching is only for the demo accounts." };
  }
  const target = await db.user.findUnique({ where: { email: DEMO_ACCOUNTS[who].email }, select: { id: true, role: true } });
  if (!target || !isRole(target.role)) return { ok: false, message: "That demo account isn't set up. Run npm run db:seed." };
  await createSession({ userId: target.id, role: target.role });
  redirect(homeFor(target.role));
}

/** Resets the demo owner to the start of the guided journey. Demo owner only. */
export async function restartDemoAction(): Promise<{ ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user || process.env.DEMO_MODE === "false" || user.email.toLowerCase() !== DEMO_ACCOUNTS.owner.email) {
    return { ok: false, message: "Restarting is only for the demo pet owner." };
  }
  const { seedDemoJourney } = await import("../../../prisma/demo-journey");
  await seedDemoJourney(todayISO());
  revalidatePath("/app", "layout");
  redirect("/app");
}

/** "Try the demo" on the landing page: signs in as the demo pet owner. Off when DEMO_MODE=false. */
export async function startDemoAction() {
  if (process.env.DEMO_MODE === "false") redirect("/login");
  const owner = await db.user.findUnique({ where: { email: DEMO_ACCOUNTS.owner.email }, select: { id: true, role: true } });
  if (!owner || !isRole(owner.role)) redirect("/login");
  await createSession({ userId: owner.id, role: owner.role });
  redirect("/app");
}
