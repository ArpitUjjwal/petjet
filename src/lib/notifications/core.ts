/*
 * Notification kinds. SQLite has no enums, so the column is a string checked against this list.
 * Pure, so it can be imported from client components too.
 */
export const NOTIFICATION_KINDS = [
  "APPOINTMENT_REQUESTED",
  "APPOINTMENT_ACCEPTED",
  "APPOINTMENT_DECLINED",
  "VET_RECORDED",
  "LAB_ORDERED",
  "LAB_RESULT",
  "FLIGHT_BOOKED",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function isNotificationKind(v: string): v is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(v);
}

export type NotificationInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string | null;
};
