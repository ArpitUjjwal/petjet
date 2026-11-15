// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { planStoredTrip } from "@/lib/trips/plan";
import {
  clearOwnerStep,
  createTripFromDraft,
  getTrip,
  recordOwnerStep,
  updateTripDates,
} from "@/lib/trips/repository";

/* Module 5: changing dates and owner-confirmed steps, against prisma/unit.db */

const TODAY = "2026-11-15";
let ownerA: string;
let ownerB: string;
let usTripId: string;
let dogId: string;

const dog = {
  name: "Rolo",
  species: "DOG",
  breed: "Labrador",
  birthYear: "2021",
  birthMonth: "4",
  birthDay: "",
  weightKg: "",
  hasPedigree: null,
};
const health = {
  microchip: { status: "YES", number: "956000012345678", implantedOn: "2021-07-01" },
  rabies: { status: "VACCINATED", lastDoseOn: "2026-06-01", lastDoseKind: "PRIMARY", validUntil: "2029-06-01" },
};
const trip = {
  origin: "GB",
  destination: "US",
  arrivalDate: "2027-02-10",
  returnDate: "2027-02-24",
  noReturnYet: false,
  transit: "NONE",
  accompaniment: "OWNER",
  purpose: "PERSONAL",
  departureAirport: "LHR",
  arrivalAirport: "JFK",
  petPlacement: "HOLD",
};

const taskStatus = async (taskId: string) => {
  const t = (await getTrip(ownerA, usTripId))!;
  const entry = planStoredTrip(t, TODAY).pets[0];
  return entry.plan.supported ? entry.plan.tasks.find((x) => x.id === taskId)?.status : undefined;
};

beforeAll(async () => {
  const stamp = Date.now();
  ownerA = (await db.user.create({ data: { email: `m5a-${stamp}@t.test`, name: "A", passwordHash: "x" } })).id;
  ownerB = (await db.user.create({ data: { email: `m5b-${stamp}@t.test`, name: "B", passwordHash: "x" } })).id;
  const res = await createTripFromDraft(ownerA, { pets: [{ profile: dog, health }], trip, recordsAvailable: "YES" }, TODAY);
  if (!res.ok) throw new Error(JSON.stringify(res));
  usTripId = res.tripId;
  dogId = (await getTrip(ownerA, usTripId))!.pets[0].petId;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("changing a trip's dates", () => {
  it("saves new dates for the owner and the plan follows", async () => {
    const res = await updateTripDates(ownerA, usTripId, { arrivalDate: "2027-03-10", returnDate: "2027-03-24", noReturnYet: false }, TODAY);
    expect(res).toEqual({ ok: true });
    const saved = (await getTrip(ownerA, usTripId))!;
    expect(saved).toMatchObject({ arrivalDate: "2027-03-10", returnDate: "2027-03-24" });
    const cdc = planStoredTrip(saved, TODAY).pets[0].plan;
    expect(cdc.supported && cdc.tasks.find((t) => t.id === "cdc-form")?.window?.to).toBe("2027-03-10");
  });

  it("clears the return date when it isn't known yet", async () => {
    await updateTripDates(ownerA, usTripId, { arrivalDate: "2027-03-10", returnDate: "2027-03-24", noReturnYet: true }, TODAY);
    expect((await getTrip(ownerA, usTripId))!.returnDate).toBeNull();
    await updateTripDates(ownerA, usTripId, { arrivalDate: "2027-02-10", returnDate: "2027-02-24", noReturnYet: false }, TODAY);
  });

  it("rejects past, far-off and back-to-front dates", async () => {
    expect(await updateTripDates(ownerA, usTripId, { arrivalDate: "2026-11-01", noReturnYet: true }, TODAY)).toEqual({
      ok: false,
      errors: { arrivalDate: "The arrival date has already passed." },
    });
    expect(await updateTripDates(ownerA, usTripId, { arrivalDate: "2029-01-01", noReturnYet: true }, TODAY)).toMatchObject({
      errors: { arrivalDate: "We can plan trips up to two years ahead." },
    });
    expect(
      await updateTripDates(ownerA, usTripId, { arrivalDate: "2027-02-10", returnDate: "2027-02-01", noReturnYet: false }, TODAY),
    ).toMatchObject({ errors: { returnDate: "The return date must be after the arrival date." } });
    expect(await updateTripDates(ownerA, usTripId, { arrivalDate: "2027-02-10", noReturnYet: false }, TODAY)).toMatchObject({
      errors: { returnDate: "Enter your return date, or tick that you don't know it yet." },
    });
  });

  it("can't change someone else's trip", async () => {
    const res = await updateTripDates(ownerB, usTripId, { arrivalDate: "2027-05-01", noReturnYet: true }, TODAY);
    expect(res).toEqual({ ok: false, message: "We couldn't find that trip." });
    expect((await getTrip(ownerA, usTripId))!.arrivalDate).toBe("2027-02-10");
  });
});

describe("steps owners confirm themselves", () => {
  const ref = () => ({ tripId: usTripId, petId: dogId, taskId: "cdc-form" });

  it("records the CDC form and the step is done; undo reopens it", async () => {
    expect(await taskStatus("cdc-form")).toBe("TODO");
    expect(await recordOwnerStep(ownerA, { ...ref(), doneOn: "2026-11-14" }, TODAY)).toEqual({ ok: true });
    expect(await taskStatus("cdc-form")).toBe("DONE");
    const row = await db.taskRecord.findFirst({ where: { tripId: usTripId, petId: dogId } });
    expect(row).toMatchObject({ key: "cdcFormSubmittedOn", doneOn: "2026-11-14", source: "OWNER" });

    expect(await clearOwnerStep(ownerA, ref())).toEqual({ ok: true });
    expect(await taskStatus("cdc-form")).toBe("TODO");
    expect(await clearOwnerStep(ownerA, ref())).toEqual({ ok: false, message: "There was nothing to undo." });
  });

  it("refuses a date that wouldn't count, or one in the future", async () => {
    // The form is valid for 6 months before arrival on 10 Feb 2027
    expect(await recordOwnerStep(ownerA, { ...ref(), doneOn: "2026-07-01" }, TODAY)).toMatchObject({
      ok: false,
      errors: { doneOn: expect.stringContaining("doesn't count") },
    });
    expect(await recordOwnerStep(ownerA, { ...ref(), doneOn: "2026-11-16" }, TODAY)).toMatchObject({
      errors: { doneOn: "The date can't be in the future." },
    });
    expect(await recordOwnerStep(ownerA, { ...ref(), doneOn: "not-a-date" }, TODAY)).toMatchObject({
      errors: { doneOn: "Enter a valid date." },
    });
    expect(await db.taskRecord.count({ where: { tripId: usTripId } })).toBe(0);
  });

  it("never lets an owner tick a vet's step or a step that isn't in the plan", async () => {
    expect(await recordOwnerStep(ownerA, { ...ref(), taskId: "microchip", doneOn: TODAY }, TODAY)).toEqual({
      ok: false,
      message: "Your vet or your documents complete this step.",
    });
    // Ireland's advance notice is an owner step, but not on a trip to the USA
    expect(await recordOwnerStep(ownerA, { ...ref(), taskId: "ireland-notice", doneOn: TODAY }, TODAY)).toEqual({
      ok: false,
      message: "This step isn't part of this pet's plan.",
    });
  });

  it("keeps other owners out, and only undoes owner records", async () => {
    expect(await recordOwnerStep(ownerB, { ...ref(), doneOn: TODAY }, TODAY)).toEqual({
      ok: false,
      message: "We couldn't find that trip.",
    });
    await db.taskRecord.create({
      data: { tripId: usTripId, petId: dogId, key: "approvedRouteBooked", doneOn: TODAY, source: "VET" },
    });
    expect(await clearOwnerStep(ownerA, { ...ref(), taskId: "return-approved-route" })).toMatchObject({ ok: false });
    expect(await clearOwnerStep(ownerB, ref())).toMatchObject({ ok: false });
    expect(await taskStatus("return-approved-route")).toBe("DONE");
  });

  it("records are deleted with their trip", async () => {
    await recordOwnerStep(ownerA, { ...ref(), doneOn: TODAY }, TODAY);
    await db.trip.delete({ where: { id: usTripId } });
    expect(await db.taskRecord.count({ where: { tripId: usTripId } })).toBe(0);
  });
});
