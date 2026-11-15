// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/rules/dates";
import { evaluateTrip } from "@/lib/rules/engine";
import {
  attention,
  countdown,
  mergeTasks,
  nextTask,
  petNames,
  pickTrip,
  readiness,
  suggestDates,
} from "@/lib/trips/dashboard";
import { diffPlans } from "@/lib/trips/diff";
import { planStoredTrip, planTrip, type PetRecord, type StoredTrip, type TripRecord } from "@/lib/trips/plan";
import { ownerStep, recordsByPet, toTaskRecords } from "@/lib/trips/records";
import { buildTimeline, groupByMonth } from "@/lib/trips/timeline";

const TODAY = "2026-11-15";

const pet = (over: Partial<PetRecord> & { id: string; name: string }): PetRecord => ({
  species: "CAT",
  breed: null,
  birthYear: 2023,
  birthMonth: 3,
  birthDay: 10,
  hasPedigree: null,
  microchipStatus: "YES",
  microchipDate: "2023-06-01",
  rabiesStatus: "VACCINATED",
  rabiesLastDose: "2026-09-01",
  rabiesDoseKind: "PRIMARY",
  rabiesValidUntil: "2029-09-01",
  ...over,
});

const milo = pet({ id: "p-milo", name: "Milo" });
const luna = pet({ id: "p-luna", name: "Luna" });
/* A dog with no rabies vaccination yet */
const bella = pet({
  id: "p-bella",
  name: "Bella",
  species: "DOG",
  breed: "Cockapoo",
  birthYear: 2022,
  birthMonth: 1,
  rabiesStatus: "NONE",
  rabiesLastDose: null,
  rabiesDoseKind: null,
  rabiesValidUntil: null,
});

const trip = (over: Partial<TripRecord> = {}): TripRecord => ({
  id: "t1",
  origin: "GB",
  destination: "FR",
  arrivalDate: "2027-03-15",
  returnDate: "2027-03-29",
  accompaniment: "OWNER",
  arrivalAirport: "CDG",
  ...over,
});

describe("readiness", () => {
  it("counts required steps across every pet, never advice", () => {
    const plan = planTrip(trip(), [milo, bella], TODAY);
    const r = readiness(plan.pets);
    const required = plan.pets.flatMap((p) => (p.plan.supported ? p.plan.tasks.filter((t) => t.blocking) : []));
    expect(r.total).toBe(required.length);
    expect(r.done).toBe(required.filter((t) => t.status === "DONE").length);
    expect(r.pct).toBe(Math.round((r.done / r.total) * 100));
    expect(r.perPet.map((p) => p.name)).toEqual(["Milo", "Bella"]);
    expect(r.perPet[0].status).toBe("IN_PROGRESS");
  });

  it("is zero, not NaN, when nothing can be planned", () => {
    const plan = planTrip(trip({ destination: "ES" }), [milo], TODAY);
    expect(readiness(plan.pets)).toMatchObject({ done: 0, total: 0, pct: 0 });
  });
});

describe("next step", () => {
  it("is the open step with the nearest deadline, merged across pets that share it", () => {
    const plan = planTrip(trip(), [milo, luna], TODAY);
    const next = nextTask(plan.pets, TODAY)!;
    expect(next.task.id).toBe("ahc");
    expect(next.pets.map((p) => p.name)).toEqual(["Milo", "Luna"]);
    expect(next.due).toBe("2027-03-15");
    expect(next.daysLeft).toBe(120);
  });

  it("puts dated steps before ones that still need answers", () => {
    const unsure = pet({ id: "p-x", name: "Pip", rabiesStatus: "UNKNOWN", rabiesLastDose: null, rabiesDoseKind: null });
    const plan = planTrip(trip(), [unsure], TODAY);
    const next = nextTask(plan.pets, TODAY)!;
    expect(next.status).toBe("TODO");
    expect(next.due).toBeDefined();
  });

  it("is null when every required step is done", () => {
    const plan = planTrip(trip({ returnDate: null }), [milo], TODAY, {
      records: () => ({ ahcIssuedOn: "2027-03-10" }),
    });
    expect(plan.status).toBe("READY");
    expect(nextTask(plan.pets, TODAY)).toBeNull();
  });
});

describe("countdown", () => {
  it("counts down to arrival, then to coming home", () => {
    expect(countdown({ arrivalDate: "2026-11-25", returnDate: "2026-12-05" }, TODAY)).toMatchObject({ phase: "before", days: 10 });
    expect(countdown({ arrivalDate: "2026-11-16", returnDate: null }, TODAY)).toMatchObject({ days: 1, label: "day to go" });
    expect(countdown({ arrivalDate: TODAY, returnDate: null }, TODAY)).toMatchObject({ phase: "travel-day" });
    expect(countdown({ arrivalDate: "2026-11-10", returnDate: "2026-11-20" }, TODAY)).toMatchObject({ phase: "away", days: 5 });
    expect(countdown({ arrivalDate: "2026-11-01", returnDate: "2026-11-10" }, TODAY)).toMatchObject({ phase: "done" });
  });
});

describe("date conflicts", () => {
  const tooSoon = trip({ destination: "IE", arrivalAirport: "DUB", arrivalDate: addDays(TODAY, 10), returnDate: addDays(TODAY, 20) });

  it("suggests the earliest arrival that works, keeping the trip the same length", () => {
    const plan = planTrip(tooSoon, [bella], TODAY);
    expect(plan.status).toBe("NOT_FEASIBLE");
    const s = suggestDates(tooSoon, plan.pets, TODAY)!;
    expect(s.arrivalDate).toBe(addDays(TODAY, 22));
    expect(s.returnDate).toBe(addDays(TODAY, 32));
  });

  it("suggested dates really do clear the blockers", () => {
    const plan = planTrip(tooSoon, [bella, milo], TODAY);
    const s = suggestDates(tooSoon, plan.pets, TODAY)!;
    const moved = planTrip({ ...tooSoon, ...s }, [bella, milo], TODAY);
    expect(moved.status).not.toBe("NOT_FEASIBLE");
  });

  it("moves only the return date when only the journey home is blocked", () => {
    // The USA doesn't need rabies for a UK cat, but coming home to Great Britain does
    const usTrip = trip({ destination: "US", arrivalAirport: "JFK" });
    const cat = pet({ id: "p-c", name: "Tom", rabiesStatus: "NONE", rabiesLastDose: null, rabiesDoseKind: null });
    const late = planTrip({ ...usTrip, arrivalDate: addDays(TODAY, 5), returnDate: addDays(TODAY, 12) }, [cat], TODAY);
    expect(late.status).toBe("NOT_FEASIBLE");
    const s = suggestDates({ arrivalDate: addDays(TODAY, 5), returnDate: addDays(TODAY, 12) }, late.pets, TODAY)!;
    expect(s.arrivalDate).toBe(addDays(TODAY, 5));
    expect(s.returnDate).toBe(addDays(TODAY, 22));
  });

  it("offers no dates when the problem isn't about dates", () => {
    const staffie = pet({ id: "p-s", name: "Rex", species: "DOG", breed: "American Staffordshire Terrier", hasPedigree: false });
    const plan = planTrip(trip(), [staffie], TODAY);
    expect(plan.status).toBe("NOT_FEASIBLE");
    expect(suggestDates(trip(), plan.pets, TODAY)).toBeNull();
    expect(attention(trip(), plan.pets, TODAY)[0]).toMatchObject({ kind: "conflict", suggestion: null });
  });
});

describe("needs attention", () => {
  it("leads with the date conflict, naming each pet when there are several", () => {
    const t = trip({ destination: "IE", arrivalAirport: "DUB", arrivalDate: addDays(TODAY, 10), returnDate: addDays(TODAY, 20) });
    const plan = planTrip(t, [bella, milo], TODAY);
    const items = attention(t, plan.pets, TODAY);
    expect(items[0].kind).toBe("conflict");
    expect(items[0].tone).toBe("danger");
    expect(items[0].lines.every((l) => l.startsWith("Bella:"))).toBe(true);
    expect(items[0].suggestion?.arrivalDate).toBe(addDays(TODAY, 22));
  });

  it("flags steps due within two weeks, and questions we still need answered", () => {
    const t = trip({ arrivalDate: addDays(TODAY, 9), returnDate: addDays(TODAY, 20) });
    const unsure = pet({ id: "p-x", name: "Pip", microchipStatus: "UNKNOWN", microchipDate: null });
    const plan = planTrip(t, [unsure], TODAY);
    const items = attention(t, plan.pets, TODAY);
    expect(items.find((i) => i.kind === "due-soon" && i.title === "Animal health certificate")?.lines[0]).toMatch(/^Due in 9 days/);
    expect(items.find((i) => i.kind === "verify")?.lines).toContain("Microchip");
    expect(items.some((i) => i.kind === "conflict")).toBe(false);
  });

  it("shows engine notes once, even when several pets share them", () => {
    const plan = planTrip(trip({ returnDate: null }), [milo, luna], TODAY);
    const notes = attention(trip({ returnDate: null }), plan.pets, TODAY).filter((i) => i.kind === "note");
    expect(notes).toHaveLength(1);
    expect(notes[0].lines.filter((l) => l.startsWith("No return date yet"))).toHaveLength(1);
  });

  it("explains pets PetJet can't plan for", () => {
    const plan = planTrip(trip({ destination: "US", arrivalAirport: "JFK" }), [pet({ id: "f", name: "Bandit", species: "FERRET" })], TODAY);
    expect(attention(trip(), plan.pets, TODAY)[0]).toMatchObject({ kind: "unsupported", title: "We can't plan this trip for Bandit" });
  });
});

describe("which trip the dashboard shows", () => {
  const trips = [
    { id: "past", arrivalDate: "2026-10-01" },
    { id: "later", arrivalDate: "2027-05-01" },
    { id: "soon", arrivalDate: "2026-12-01" },
  ];
  it("shows the next trip, or the one asked for, or the most recent when all are past", () => {
    expect(pickTrip(trips, undefined, TODAY)?.id).toBe("soon");
    expect(pickTrip(trips, "later", TODAY)?.id).toBe("later");
    expect(pickTrip(trips, "someone-elses", TODAY)?.id).toBe("soon");
    expect(pickTrip([trips[0]], undefined, TODAY)?.id).toBe("past");
    expect(pickTrip([], undefined, TODAY)).toBeNull();
  });
});

describe("timeline", () => {
  it("lists steps in date order from today, with the flights as milestones", () => {
    const plan = planTrip(trip(), [milo], TODAY);
    const { entries, doneCount } = buildTimeline(trip(), plan.pets, TODAY);
    expect(entries[0]).toMatchObject({ kind: "today", date: TODAY });
    const dates = entries.map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
    const ahc = entries.find((e) => e.task?.id === "ahc")!;
    // The certificate can't be issued until its window opens 10 days before arrival
    expect(ahc.date).toBe("2027-03-06");
    expect(ahc.state).toBe("next");
    const arrive = entries.findIndex((e) => e.id === "travel-out");
    expect(entries[arrive]).toMatchObject({ title: "Arrive in France", date: "2027-03-15" });
    expect(entries.at(-1)).toMatchObject({ id: "travel-home", title: "Back in Great Britain" });
    expect(doneCount).toBeGreaterThan(0);
  });

  it("puts a step due on travel day before the flight", () => {
    const plan = planTrip(trip(), [milo], TODAY);
    const { entries } = buildTimeline(trip(), plan.pets, TODAY);
    const sameDay = entries.filter((e) => e.date === "2027-03-29");
    expect(sameDay.at(-1)?.kind).toBe("travel");
    expect(sameDay.length).toBeGreaterThan(1);
  });

  it("marks blocked steps and keeps undated questions aside", () => {
    const t = trip({ destination: "IE", arrivalAirport: "DUB", arrivalDate: addDays(TODAY, 10), returnDate: addDays(TODAY, 20) });
    const unsure = pet({ id: "p-x", name: "Pip", rabiesStatus: "UNKNOWN", rabiesLastDose: null, rabiesDoseKind: null });
    const plan = planTrip(t, [bella, unsure], TODAY);
    const tl = buildTimeline(t, plan.pets, TODAY);
    expect(tl.entries.find((e) => e.task?.id === "rabies")?.state).toBe("blocked");
    expect(tl.undated.map((m) => m.task.id)).toContain("rabies");
    expect(tl.undated.find((m) => m.task.id === "rabies")?.pets.map((p) => p.name)).toEqual(["Pip"]);
  });

  it("groups by month", () => {
    const plan = planTrip(trip(), [milo], TODAY);
    const groups = groupByMonth(buildTimeline(trip(), plan.pets, TODAY).entries);
    expect(groups[0].label).toBe("November 2026");
    expect(groups.at(-1)?.label).toBe("March 2027");
  });
});

describe("plan diff for a date change", () => {
  it("lists deadlines that move, once for all the pets they apply to", () => {
    const before = planTrip(trip(), [milo, luna], TODAY);
    const after = planTrip(trip({ arrivalDate: "2027-04-15", returnDate: "2027-04-29" }), [milo, luna], TODAY);
    const d = diffPlans(before, after);
    expect(d.statusBefore).toBe("IN_PROGRESS");
    expect(d.statusAfter).toBe("IN_PROGRESS");
    const ahc = d.changes.find((c) => c.taskId === "ahc")!;
    expect(ahc).toMatchObject({ kind: "moved", pets: "Milo and Luna", before: "6 Mar – 15 Mar 2027", after: "6 Apr – 15 Apr 2027" });
  });

  it("shows a step becoming impossible, and possible again", () => {
    const fine = trip({ destination: "IE", arrivalAirport: "DUB", arrivalDate: addDays(TODAY, 40), returnDate: addDays(TODAY, 50) });
    const tight = { ...fine, arrivalDate: addDays(TODAY, 10) };
    const a = planTrip(fine, [bella], TODAY);
    const b = planTrip(tight, [bella], TODAY);
    const worse = diffPlans(a, b);
    expect(worse.statusAfter).toBe("NOT_FEASIBLE");
    expect(worse.changes[0]).toMatchObject({ kind: "now-blocked", taskId: "rabies", pets: "Bella" });
    expect(diffPlans(b, a).changes[0]).toMatchObject({ kind: "unblocked", taskId: "rabies" });
  });

  it("reports steps that appear or disappear, such as the journey home", () => {
    const d = diffPlans(planTrip(trip(), [milo], TODAY), planTrip(trip({ returnDate: null }), [milo], TODAY));
    expect(d.changes.filter((c) => c.kind === "removed").map((c) => c.taskId)).toContain("return-approved-route");
  });

  it("is empty when nothing moves", () => {
    const p = planTrip(trip(), [milo], TODAY);
    expect(diffPlans(p, p).changes).toEqual([]);
  });
});

describe("task records", () => {
  it("turns stored rows into engine records, ignoring unknown keys", () => {
    expect(
      toTaskRecords([
        { key: "cdcFormSubmittedOn", doneOn: "2026-11-10", source: "OWNER" },
        { key: "irelandNoticeGiven", doneOn: "2026-11-11", source: "OWNER" },
        { key: "somethingElse", doneOn: "2026-11-11", source: "OWNER" },
      ]),
    ).toEqual({ cdcFormSubmittedOn: "2026-11-10", irelandNoticeGiven: true });
    const forPet = recordsByPet([{ petId: "a", key: "approvedRouteBooked", doneOn: TODAY, source: "OWNER" }]);
    expect(forPet("a")).toEqual({ approvedRouteBooked: true });
    expect(forPet("b")).toBeUndefined();
  });

  it("only offers owner ticks on owner steps that are open or done", () => {
    expect(ownerStep({ id: "cdc-form", status: "TODO" })?.key).toBe("cdcFormSubmittedOn");
    expect(ownerStep({ id: "cdc-form", status: "DONE" })).not.toBeNull();
    expect(ownerStep({ id: "france-breed", status: "VERIFY" })).toBeNull();
    expect(ownerStep({ id: "france-breed", status: "BLOCKED" })).toBeNull();
    expect(ownerStep({ id: "ahc", status: "TODO" })).toBeNull();
    expect(ownerStep({ id: "tapeworm-outbound", status: "TODO" })).toBeNull();
  });

  it("a recorded owner step completes the matching engine task", () => {
    const stored: StoredTrip = {
      ...trip({ destination: "IE", arrivalAirport: "DUB", accompaniment: "AUTHORISED_PERSON" }),
      pets: [{ pet: milo }],
      taskRecords: [
        { petId: milo.id, key: "irelandNoticeGiven", doneOn: TODAY, source: "OWNER" },
        { petId: milo.id, key: "authorisedDeclarationSigned", doneOn: TODAY, source: "OWNER" },
      ],
    };
    const plan = planStoredTrip(stored, TODAY);
    const tasks = plan.pets[0].plan.supported ? plan.pets[0].plan.tasks : [];
    expect(tasks.find((t) => t.id === "ireland-notice")?.status).toBe("DONE");
    expect(tasks.find((t) => t.id === "authorised-person")?.status).toBe("DONE");
  });

  it("the engine completes the authorised-person step only with a signed declaration", () => {
    const input = {
      name: "Milo",
      species: "CAT",
      microchip: { status: "YES" as const, implantedOn: "2023-06-01" },
      rabies: { status: "VACCINATED" as const, lastDoseOn: "2026-09-01", lastDoseKind: "PRIMARY" as const },
    };
    const t = { origin: "GB", destination: "FR", arrivalDate: "2027-03-15", petCount: 1, purpose: "PERSONAL" as const, accompaniment: "AUTHORISED_PERSON" as const };
    const open = evaluateTrip(input, t, { today: TODAY });
    const signed = evaluateTrip(input, t, { today: TODAY, records: { authorisedDeclarationSigned: true } });
    const find = (p: typeof open) => (p.supported ? p.tasks.find((x) => x.id === "authorised-person") : undefined);
    expect(find(open)).toMatchObject({ status: "TODO", window: { to: "2027-03-15" } });
    expect(find(signed)).toMatchObject({ status: "DONE" });
    expect(find(signed)?.window).toBeUndefined();
  });
});

describe("helpers", () => {
  it("joins pet names", () => {
    expect(petNames([])).toBe("");
    expect(petNames([{ name: "A" }])).toBe("A");
    expect(petNames([{ name: "A" }, { name: "B" }, { name: "C" }])).toBe("A, B and C");
  });
  it("merges only identical steps", () => {
    const old = pet({ id: "p-o", name: "Old", rabiesLastDose: "2026-11-01" });
    const plan = planTrip(trip({ arrivalDate: "2026-11-30", returnDate: null }), [milo, old], TODAY);
    const ahc = mergeTasks(plan.pets, TODAY, (t) => t.id === "ahc");
    // Different vaccination dates give different certificate windows, so they stay separate
    expect(ahc).toHaveLength(2);
  });
});
