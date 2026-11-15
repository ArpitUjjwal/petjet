"use server";

import { redirect } from "next/navigation";
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
