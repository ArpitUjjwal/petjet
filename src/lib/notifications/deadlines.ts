import { formatDate, type ISODate } from "@/lib/rules/dates";
import { mergeTasks, petNames } from "@/lib/trips/dashboard";
import type { PetPlan } from "@/lib/trips/plan";

/*
 * Deadline reminders, worked out when the page loads (there is no background job).
 * Pure: the same plans and "today" always give the same reminders.
 */

export const REMINDER_DAYS = 7;

export type DeadlineReminder = {
  id: string;
  tripId: string;
  tripTitle: string;
  title: string;
  body: string;
  overdue: boolean;
  due: ISODate;
  daysLeft: number;
  href: string;
};

export function deadlineReminders(
  trips: { id: string; title: string; plans: PetPlan[] }[],
  today: ISODate,
  withinDays = REMINDER_DAYS,
): DeadlineReminder[] {
  const out: DeadlineReminder[] = [];
  for (const trip of trips) {
    const many = trip.plans.length > 1;
    for (const m of mergeTasks(trip.plans, today, (t) => t.blocking && t.status === "TODO")) {
      if (m.due === undefined || m.daysLeft === undefined || m.daysLeft > withinDays) continue;
      const overdue = m.daysLeft < 0;
      const who = many ? ` for ${petNames(m.pets)}` : "";
      out.push({
        id: `${trip.id}|${m.key}`,
        tripId: trip.id,
        tripTitle: trip.title,
        title: overdue ? `${m.task.title}${who} is overdue` : `${m.task.title}${who}`,
        body: overdue
          ? `It was due by ${formatDate(m.due)}.`
          : m.daysLeft === 0
            ? "Due today."
            : `Due in ${m.daysLeft} day${m.daysLeft === 1 ? "" : "s"}, by ${formatDate(m.due)}.`,
        overdue,
        due: m.due,
        daysLeft: m.daysLeft,
        href: `/app/trips/${trip.id}#task-${m.pets[0].id}-${m.task.id}`,
      });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title));
}
