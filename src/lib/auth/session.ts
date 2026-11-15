import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { homeFor, isProviderRole, isRole, loginFor, type Role } from "./roles";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
  type SessionPayload,
} from "./token";

function secret() {
  return process.env.SESSION_SECRET ?? "";
}

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload, secret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    /* The app runs on http://localhost by default. Set COOKIE_SECURE=true when served over HTTPS. */
    secure: process.env.COOKIE_SECURE === "true",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  provider: { id: string; type: string; name: string; verified: boolean } | null;
};

/**
 * The signed-in user, checked against the database on every request
 * (so a deleted account or changed role takes effect immediately).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value, secret());
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      provider: { select: { id: true, type: true, name: true, verified: true } },
    },
  });
  if (!user || !isRole(user.role) || user.role !== session.role) return null;
  return { ...user, role: user.role };
});

/**
 * No valid user. If a cookie is still present it is stale (expired, tampered, or the
 * account was removed); it has to be cleared by a route handler, otherwise the proxy
 * would keep bouncing the browser between the login page and the app.
 */
async function toLogin(role: Role): Promise<never> {
  const store = await cookies();
  if (store.has(SESSION_COOKIE)) {
    redirect(`/auth/clear?portal=${role === "OWNER" ? "owner" : "provider"}`);
  }
  redirect(loginFor(role));
}

/** Use at the top of every owner page, layout and action. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) return toLogin("OWNER");
  if (user.role !== "OWNER") redirect(homeFor(user.role));
  return user;
}

/** Use at the top of every provider page, layout and action. */
export async function requireProvider(): Promise<CurrentUser & { provider: NonNullable<CurrentUser["provider"]> }> {
  const user = await getCurrentUser();
  if (!user) return toLogin("VET");
  if (!isProviderRole(user.role) || !user.provider) redirect(homeFor(user.role));
  return { ...user, provider: user.provider };
}
