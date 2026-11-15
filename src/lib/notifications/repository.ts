import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isNotificationKind, type NotificationInput } from "./core";

/*
 * Notifications are written by the repository function that makes the event happen, inside
 * the same transaction where there is one, so an event and its notification land together.
 * A user only ever reads or clears their own.
 */

type Client = Prisma.TransactionClient | typeof db;

export async function notify(client: Client, ...items: NotificationInput[]) {
  const data = items
    .filter((n) => isNotificationKind(n.kind))
    .map((n) => ({ userId: n.userId, kind: n.kind, title: n.title.slice(0, 200), body: n.body.slice(0, 1000), href: n.href ?? null }));
  if (data.length) await client.notification.createMany({ data });
}

export function listNotifications(userId: string, take = 50) {
  return db.notification.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take });
}

export function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string) {
  const res = await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return res.count;
}

/** The user id behind a provider, for notifying a practice or lab. */
export async function providerUserId(client: Client, providerId: string) {
  const p = await client.provider.findUnique({ where: { id: providerId }, select: { userId: true } });
  return p?.userId ?? null;
}
