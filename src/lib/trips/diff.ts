import type { PlanTask } from "@/lib/rules/types";
import { petNames } from "./dashboard";
import { openWindow, windowLabel } from "./format";
import type { PetPlan, TripStatus } from "./plan";

/*
 * What changes in a trip's plan when its dates change. Used for the live preview in the
 * edit-dates dialog, so owners see the effect before saving.
 */

export type PlanChangeKind = "now-blocked" | "unblocked" | "moved" | "added" | "removed";

export type PlanChange = {
  kind: PlanChangeKind;
  taskId: string;
  title: string;
  pets: string;
  before?: string;
  after?: string;
};

export type PlanDiff = {
  statusBefore: TripStatus;
  statusAfter: TripStatus;
  changes: PlanChange[];
};

const ORDER: Record<PlanChangeKind, number> = { "now-blocked": 0, unblocked: 1, added: 2, moved: 3, removed: 4 };

function tasksById(entry: PetPlan | undefined) {
  if (!entry?.plan.supported) return new Map<string, PlanTask>();
  return new Map(entry.plan.tasks.map((t) => [t.id, t]));
}

export function diffPlans(
  before: { pets: PetPlan[]; status: TripStatus },
  after: { pets: PetPlan[]; status: TripStatus },
  /** When given, windows already open read as deadlines ("By 26 Nov"), as elsewhere in the app */
  today?: string,
): PlanDiff {
  const label = (w: PlanTask["window"]) => windowLabel(today ? openWindow(w, today) : w);
  const raw: (Omit<PlanChange, "pets"> & { pet: string })[] = [];

  for (const entry of after.pets) {
    const prev = before.pets.find((p) => p.pet.id === entry.pet.id);
    const a = tasksById(prev);
    const b = tasksById(entry);
    const pet = entry.pet.name;

    for (const [id, next] of b) {
      const old = a.get(id);
      if (!old) {
        raw.push({ kind: next.status === "BLOCKED" ? "now-blocked" : "added", taskId: id, title: next.title, pet });
        continue;
      }
      if (next.status === "BLOCKED" && old.status !== "BLOCKED") {
        raw.push({ kind: "now-blocked", taskId: id, title: next.title, pet });
      } else if (old.status === "BLOCKED" && next.status !== "BLOCKED") {
        raw.push({ kind: "unblocked", taskId: id, title: next.title, pet, after: label(next.window) ?? undefined });
      } else {
        const was = label(old.window);
        const now = label(next.window);
        if (was !== now && (was || now)) {
          raw.push({ kind: "moved", taskId: id, title: next.title, pet, before: was ?? undefined, after: now ?? undefined });
        }
      }
    }
    for (const [id, old] of a) {
      if (!b.has(id)) raw.push({ kind: "removed", taskId: id, title: old.title, pet });
    }
  }

  /* One line per change, listing every pet it applies to */
  const merged = new Map<string, PlanChange & { list: string[] }>();
  for (const c of raw) {
    const key = [c.kind, c.taskId, c.before, c.after].join("|");
    const existing = merged.get(key);
    if (existing) existing.list.push(c.pet);
    else merged.set(key, { kind: c.kind, taskId: c.taskId, title: c.title, before: c.before, after: c.after, pets: "", list: [c.pet] });
  }
  const changes = [...merged.values()]
    .map(({ list, ...c }) => ({ ...c, pets: petNames(list.map((name) => ({ name }))) }))
    .sort((x, y) => ORDER[x.kind] - ORDER[y.kind]);

  return { statusBefore: before.status, statusAfter: after.status, changes };
}
