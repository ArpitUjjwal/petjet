import { isAfter, isBefore, type ISODate } from "@/lib/rules/dates";
import type { Leg, PlanTask } from "@/lib/rules/types";
import { countryLabel } from "./options";
import { mergeTasks, nextTask, type MergedTask, type PetRef } from "./dashboard";
import type { PetPlan, TripRecord } from "./plan";

/*
 * A trip's plan laid out in date order. Each step sits on the day the owner can start it
 * (when its window opens in the future) or otherwise on its deadline, so the list reads as
 * "what happens when". Steps with no date at all are returned separately.
 */

export type TimelineEntryState = "done" | "next" | "upcoming" | "blocked" | "overdue" | "advice" | "travel" | "today";

export type TimelineEntry = {
  id: string;
  /** The day this entry sits on */
  date: ISODate;
  title: string;
  kind: "task" | "travel" | "today";
  state: TimelineEntryState;
  leg?: Leg;
  pets: PetRef[];
  task?: PlanTask;
  window?: { from?: ISODate; to?: ISODate };
};

export type TripTimeline = {
  entries: TimelineEntry[];
  /** Open steps with no date, such as answers we still need */
  undated: MergedTask[];
  doneCount: number;
};

function placement(task: PlanTask, today: ISODate): ISODate | undefined {
  const { from, to } = task.window ?? {};
  if (from && isAfter(from, today)) return from;
  return to ?? from;
}

const KIND_ORDER = { today: 0, task: 1, travel: 2 } as const;

export function buildTimeline(
  trip: Pick<TripRecord, "id" | "destination" | "origin" | "arrivalDate" | "returnDate">,
  plans: PetPlan[],
  today: ISODate,
): TripTimeline {
  const allPets = plans.map(({ pet }) => ({ id: pet.id, name: pet.name }));
  const merged = mergeTasks(plans, today);
  const entries: TimelineEntry[] = [];
  const undated: MergedTask[] = [];
  /* Counted per pet, like the dashboard's readiness ring */
  const doneCount = plans.reduce(
    (n, { plan }) => n + (plan.supported ? plan.tasks.filter((t) => t.blocking && t.status === "DONE").length : 0),
    0,
  );

  for (const m of merged) {
    const { task } = m;
    if (task.status === "DONE") continue;
    const date = placement(task, today);
    if (!date) {
      if (task.status !== "INFO") undated.push(m);
      continue;
    }
    const overdue = task.status === "TODO" && !!task.window?.to && isBefore(task.window.to, today);
    entries.push({
      id: `task-${m.key}`,
      date,
      title: task.title,
      kind: "task",
      state:
        task.status === "BLOCKED" ? "blocked" : overdue ? "overdue" : task.status === "INFO" ? "advice" : "upcoming",
      leg: task.leg,
      pets: m.pets,
      task,
      window: task.window,
    });
  }

  entries.push({
    id: "travel-out",
    date: trip.arrivalDate,
    title: `Arrive in ${countryLabel(trip.destination)}`,
    kind: "travel",
    state: "travel",
    leg: "OUTBOUND",
    pets: allPets,
  });
  if (trip.returnDate) {
    entries.push({
      id: "travel-home",
      date: trip.returnDate,
      title: `Back in ${countryLabel(trip.origin)}`,
      kind: "travel",
      state: "travel",
      leg: "RETURN",
      pets: allPets,
    });
  }
  if (!isAfter(today, trip.returnDate ?? trip.arrivalDate)) {
    entries.push({ id: "today", date: today, title: "Today", kind: "today", state: "today", pets: [] });
  }

  entries.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.leg === b.leg ? 0 : a.leg === "OUTBOUND" ? -1 : 1),
  );

  /* "Up next" is the same step the dashboard's next-step tile shows */
  const nextKey = nextTask(plans, today)?.key;
  const next = entries.find((e) => e.id === `task-${nextKey}` && e.state === "upcoming");
  if (next) next.state = "next";

  return { entries, undated, doneCount };
}

/** Groups entries under "March 2027" headings, keeping date order. */
export function groupByMonth(entries: TimelineEntry[]) {
  const groups: { key: string; label: string; entries: TimelineEntry[] }[] = [];
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    let g = groups.at(-1);
    if (!g || g.key !== key) {
      const [y, m] = key.split("-").map(Number);
      const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(Date.UTC(y, m - 1, 1)),
      );
      g = { key, label, entries: [] };
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}
