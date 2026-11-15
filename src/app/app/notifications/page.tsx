import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/auth/session";
import { deadlineReminders } from "@/lib/notifications/deadlines";
import { listNotifications } from "@/lib/notifications/repository";
import { todayISO } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import { planStoredTrip, routeTitle } from "@/lib/trips/plan";
import { listTrips } from "@/lib/trips/repository";

export const metadata: Metadata = { title: "Notifications" };

export default async function OwnerNotifications() {
  const user = await requireOwner();
  const today = todayISO();
  const [items, trips, { rules }] = await Promise.all([listNotifications(user.id), listTrips(user.id), loadRules()]);
  const upcoming = trips.filter((t) => (t.returnDate ?? t.arrivalDate) >= today);
  const reminders = deadlineReminders(
    upcoming.map((t) => ({ id: t.id, title: routeTitle(t), plans: planStoredTrip(t, today, rules).pets })),
    today,
  );
  return (
    <>
      <PageHeader title="Notifications" description="Updates from your vets, labs and bookings, and deadlines coming up." />
      <NotificationList items={items} reminders={reminders} />
    </>
  );
}
