import { addDays, diffDays, formatDate, isBefore, maxDate, type ISODate } from "@/lib/rules/dates";
import type { PlanTask, TaskStatus } from "@/lib/rules/types";
import type { PetPlan, TripRecord, TripStatus } from "./plan";

/*
 * Everything the dashboard shows about a trip, derived from the engine's per-pet plans.
 * Pure: the same plans and "today" always give the same summary, so it is tested without a browser.
 */

export type PetRef = { id: string; name: string };

/** One task, merged across the pets that share it (same step, same status, same dates). */
export type MergedTask = {
  key: string;
  task: PlanTask;
  pets: PetRef[];
  status: TaskStatus;
  /** Last day the step can be done */
  due?: ISODate;
  /** Whole days from today to `due`; negative when overdue */
  daysLeft?: number;
};

const windowSig = (t: PlanTask) => `${t.window?.from ?? ""}|${t.window?.to ?? ""}`;

export function mergeTasks(plans: PetPlan[], today: ISODate, filter: (t: PlanTask) => boolean = () => true) {
  const merged = new Map<string, MergedTask>();
  for (const { pet, plan } of plans) {
    if (!plan.supported) continue;
    for (const task of plan.tasks) {
      if (!filter(task)) continue;
      const key = `${task.id}|${task.status}|${windowSig(task)}`;
      const existing = merged.get(key);
      if (existing) {
        existing.pets.push({ id: pet.id, name: pet.name });
        continue;
      }
      const due = task.window?.to;
      merged.set(key, {
        key,
        task,
        pets: [{ id: pet.id, name: pet.name }],
        status: task.status,
        due,
        daysLeft: due ? diffDays(due, today) : undefined,
      });
    }
  }
  return [...merged.values()];
}

/** "Bella", "Bella and Max", "Bella, Max and Luna" */
export function petNames(pets: { name: string }[]) {
  const names = pets.map((p) => p.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/* ---------- Readiness ---------- */

export type Readiness = {
  done: number;
  total: number;
  pct: number;
  perPet: { id: string; name: string; done: number; total: number; status: TripStatus }[];
};

/** Required (blocking) steps done, across every pet on the trip. Advice never counts. */
export function readiness(plans: PetPlan[]): Readiness {
  const perPet = plans.map(({ pet, plan }) => {
    if (!plan.supported) return { id: pet.id, name: pet.name, done: 0, total: 0, status: "UNSUPPORTED" as const };
    const required = plan.tasks.filter((t) => t.blocking);
    return {
      id: pet.id,
      name: pet.name,
      done: required.filter((t) => t.status === "DONE").length,
      total: required.length,
      status: plan.status,
    };
  });
  const done = perPet.reduce((n, p) => n + p.done, 0);
  const total = perPet.reduce((n, p) => n + p.total, 0);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, perPet };
}

/* ---------- Next task ---------- */

/**
 * Open required steps in the order to tackle them: nearest deadline first, undated steps
 * after dated ones. Blocked steps are left to the date-conflict warning, which says how to fix them.
 */
export function openTasks(plans: PetPlan[], today: ISODate): MergedTask[] {
  const open = mergeTasks(plans, today, (t) => t.blocking && (t.status === "TODO" || t.status === "VERIFY"));
  const rank = (m: MergedTask) => (m.status === "TODO" ? 0 : 1);
  return open.sort(
    (a, b) =>
      (a.due ? 0 : 1) - (b.due ? 0 : 1) ||
      (a.due && b.due ? a.due.localeCompare(b.due) : 0) ||
      rank(a) - rank(b),
  );
}

/** The step to act on next. */
export function nextTask(plans: PetPlan[], today: ISODate): MergedTask | null {
  return openTasks(plans, today)[0] ?? null;
}

/* ---------- Countdown ---------- */

export type Countdown =
  | { phase: "before"; days: number; label: string }
  | { phase: "travel-day"; days: 0; label: string }
  | { phase: "away"; days: number; label: string }
  | { phase: "done"; days: 0; label: string };

export function countdown(trip: Pick<TripRecord, "arrivalDate" | "returnDate">, today: ISODate): Countdown {
  const toArrival = diffDays(trip.arrivalDate, today);
  if (toArrival > 0) return { phase: "before", days: toArrival, label: toArrival === 1 ? "day to go" : "days to go" };
  if (toArrival === 0) return { phase: "travel-day", days: 0, label: "Travel day" };
  if (trip.returnDate) {
    const toReturn = diffDays(trip.returnDate, today);
    if (toReturn >= 0) return { phase: "away", days: toReturn, label: toReturn === 1 ? "day until home" : "days until home" };
  }
  return { phase: "done", days: 0, label: "Trip complete" };
}

/* ---------- Date conflicts and suggested dates ---------- */

export type DateSuggestion = { arrivalDate: ISODate; returnDate: ISODate | null };

/**
 * The earliest dates that clear every pet's date blockers, or null when a blocker can't be
 * fixed by changing dates (a banned breed, a wrong airport). Moving the arrival keeps the
 * trip the same length, as long as that still clears any return blocker.
 */
export function suggestDates(
  trip: Pick<TripRecord, "arrivalDate" | "returnDate">,
  plans: PetPlan[],
  today: ISODate,
): DateSuggestion | null {
  const supported = plans.flatMap(({ plan }) => (plan.supported ? [plan] : []));
  const blockers = supported.flatMap((p) => p.blockers);
  if (!blockers.length || blockers.some((b) => !b.earliestDate)) return null;

  const outbound = blockers.filter((b) => b.leg === "OUTBOUND").map((b) => b.earliestDate);
  const back = blockers.filter((b) => b.leg === "RETURN").map((b) => b.earliestDate);

  /* Never suggest today itself: the tapeworm and notice steps need at least a day */
  const arrival = outbound.length ? maxDate(...outbound, addDays(today, 1))! : trip.arrivalDate;
  let ret = trip.returnDate;
  if (ret && arrival !== trip.arrivalDate) ret = addDays(ret, diffDays(arrival, trip.arrivalDate));
  if (back.length) ret = maxDate(ret ?? undefined, ...back)!;
  if (ret && !isBefore(arrival, ret)) ret = addDays(arrival, 1);
  if (arrival === trip.arrivalDate && ret === trip.returnDate) return null;
  return { arrivalDate: arrival, returnDate: ret ?? null };
}

/* ---------- What needs attention ---------- */

export type AttentionKind = "conflict" | "unsupported" | "overdue" | "verify" | "due-soon" | "documents" | "note";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  tone: "danger" | "warn" | "info";
  title: string;
  /** Plain sentences, already naming the pet where it matters */
  lines: string[];
  /** Only on conflicts: dates that would work */
  suggestion?: DateSuggestion | null;
  /** Task to jump to in the checklist */
  taskId?: string;
  /** A page that resolves it */
  link?: { href: string; label: string };
};

export const DUE_SOON_DAYS = 14;

export function attention(
  trip: Pick<TripRecord, "arrivalDate" | "returnDate">,
  plans: PetPlan[],
  today: ISODate,
  /** Uploaded documents waiting for the owner to check and confirm */
  documentsToReview = 0,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const many = plans.length > 1;

  const blocked = plans.filter((p) => p.plan.supported && p.plan.status === "NOT_FEASIBLE");
  if (blocked.length) {
    const lines = blocked.flatMap(({ pet, plan }) =>
      plan.supported ? plan.blockers.map((b) => (many ? `${pet.name}: ${b.message}` : b.message)) : [],
    );
    items.push({
      id: "conflict",
      kind: "conflict",
      tone: "danger",
      title: "Your dates don't work yet",
      lines: [...new Set(lines)],
      suggestion: suggestDates(trip, plans, today),
    });
  }

  for (const { pet, plan } of plans) {
    if (plan.supported) continue;
    items.push({
      id: `unsupported-${pet.id}`,
      kind: "unsupported",
      tone: "warn",
      title: `We can't plan this trip for ${pet.name}`,
      lines: plan.reasons.map((r) => r.message),
    });
  }

  const open = mergeTasks(plans, today, (t) => t.blocking && t.status === "TODO");
  for (const m of open) {
    if (m.daysLeft === undefined) continue;
    const who = many ? ` for ${petNames(m.pets)}` : "";
    if (m.daysLeft < 0) {
      items.push({
        id: `overdue-${m.key}`,
        kind: "overdue",
        tone: "danger",
        title: `${m.task.title}${who} is overdue`,
        lines: [`It was due by ${formatDate(m.due!)}.`],
        taskId: m.task.id,
      });
    } else if (m.daysLeft <= DUE_SOON_DAYS) {
      items.push({
        id: `soon-${m.key}`,
        kind: "due-soon",
        tone: "warn",
        title: `${m.task.title}${who}`,
        lines: [m.daysLeft === 0 ? "Due today." : `Due in ${m.daysLeft} day${m.daysLeft === 1 ? "" : "s"}, by ${formatDate(m.due!)}.`],
        taskId: m.task.id,
      });
    }
  }

  const verify = mergeTasks(plans, today, (t) => t.blocking && t.status === "VERIFY");
  if (verify.length) {
    items.push({
      id: "verify",
      kind: "verify",
      tone: "warn",
      title: `We need ${verify.length} more answer${verify.length === 1 ? "" : "s"} from you`,
      lines: verify.map((m) => (many ? `${m.task.title} (${petNames(m.pets)})` : m.task.title)),
      taskId: verify[0].task.id,
    });
  }

  if (documentsToReview > 0) {
    items.push({
      id: "documents",
      kind: "documents",
      tone: "warn",
      title: `${documentsToReview} document${documentsToReview === 1 ? "" : "s"} to check`,
      lines: ["Details read from your uploads don't count towards your plan until you confirm them."],
      link: { href: "/app/documents?filter=review", label: "Review documents" },
    });
  }

  const notes = new Set(plans.flatMap(({ plan }) => (plan.supported ? plan.warnings : [])));
  if (notes.size) {
    items.push({ id: "notes", kind: "note", tone: "info", title: "Good to know", lines: [...notes] });
  }

  const order: Record<AttentionKind, number> = {
    conflict: 0,
    unsupported: 1,
    overdue: 2,
    "due-soon": 3,
    verify: 4,
    documents: 5,
    note: 6,
  };
  return items.sort((a, b) => order[a.kind] - order[b.kind]);
}

/* ---------- Which trip the dashboard shows ---------- */

/** The requested trip, else the next one coming up, else the most recent. */
export function pickTrip<T extends { id: string; arrivalDate: string }>(
  trips: T[],
  requested: string | undefined,
  today: ISODate,
): T | null {
  if (!trips.length) return null;
  const asked = requested ? trips.find((t) => t.id === requested) : undefined;
  if (asked) return asked;
  const sorted = [...trips].sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
  return sorted.find((t) => t.arrivalDate >= today) ?? sorted.at(-1)!;
}
