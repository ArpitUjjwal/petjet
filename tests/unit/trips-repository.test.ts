// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createTripFromDraft, deletePet, deleteTrip, getTrip, listPets, listTrips, savePet } from "@/lib/trips/repository";

/* Runs against prisma/unit.db, created fresh by tests/unit/global-setup.ts */

const TODAY = "2026-11-15";
let ownerA: string;
let ownerB: string;

const profile = (name = "Milo", species = "CAT") => ({
  name,
  species,
  breed: "",
  birthYear: "2023",
  birthMonth: "3",
  birthDay: "",
  weightKg: "4.5",
  hasPedigree: null,
});
const health = {
  microchip: { status: "YES", number: "956000012345678", implantedOn: "2023-06-01" },
  rabies: { status: "VACCINATED", lastDoseOn: "2026-09-01", lastDoseKind: "PRIMARY", validUntil: "" },
};
const trip = {
  origin: "GB",
  destination: "FR",
  arrivalDate: "2027-03-15",
  returnDate: "2027-03-29",
  noReturnYet: false,
  transit: "NONE",
  accompaniment: "OWNER",
  purpose: "PERSONAL",
  departureAirport: "LHR",
  arrivalAirport: "CDG",
  petPlacement: "CABIN",
};

beforeAll(async () => {
  const stamp = Date.now();
  ownerA = (await db.user.create({ data: { email: `a-${stamp}@t.test`, name: "A", passwordHash: "x" } })).id;
  ownerB = (await db.user.create({ data: { email: `b-${stamp}@t.test`, name: "B", passwordHash: "x" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("pets", () => {
  it("creates, lists and updates a pet for its owner only", async () => {
    const created = await savePet(ownerA, { profile: profile("Pepper"), health }, TODAY);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const pets = await listPets(ownerA);
    const pepper = pets.find((p) => p.id === created.petId)!;
    expect(pepper).toMatchObject({ name: "Pepper", microchipNumber: "956000012345678", rabiesDoseKind: "PRIMARY", weightKg: 4.5 });
    expect((await listPets(ownerB)).some((p) => p.id === created.petId)).toBe(false);

    const updated = await savePet(ownerA, { profile: profile("Pepper Pot"), health }, TODAY, created.petId);
    expect(updated.ok).toBe(true);
    const otherOwner = await savePet(ownerB, { profile: profile("Hijack"), health }, TODAY, created.petId);
    expect(otherOwner).toEqual({ ok: false, message: "We couldn't find that pet." });
    expect((await db.pet.findUnique({ where: { id: created.petId } }))!.name).toBe("Pepper Pot");
  });

  it("returns field errors instead of saving bad data", async () => {
    const res = await savePet(ownerA, { profile: { ...profile(), name: "" }, health: { ...health, microchip: { status: "YES", number: "123" } } }, TODAY);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toMatchObject({
        "profile.name": "Enter your pet's name.",
        "health.microchip.number": "A standard microchip number has 15 digits.",
      });
    }
  });

  it("clears details that no longer apply", async () => {
    const res = await savePet(
      ownerA,
      { profile: profile("Nochip"), health: { microchip: { status: "NO", number: "956000012345678" }, rabies: { status: "NONE", lastDoseOn: "2026-01-01" } } },
      TODAY,
    );
    if (!res.ok) throw new Error();
    const pet = await db.pet.findUnique({ where: { id: res.petId } });
    expect(pet).toMatchObject({ microchipNumber: null, rabiesLastDose: null });
  });
});

describe("trips from the questionnaire", () => {
  it("creates new pets and the trip together", async () => {
    const res = await createTripFromDraft(
      ownerA,
      { pets: [{ profile: profile("Milo"), health }, { profile: profile("Luna"), health }], trip, recordsAvailable: "SOME" },
      TODAY,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const saved = await getTrip(ownerA, res.tripId);
    expect(saved).toMatchObject({ destination: "FR", arrivalAirport: "CDG", petPlacement: "CABIN", recordsAvailable: "SOME" });
    expect(saved!.pets.map((p) => p.pet.name)).toEqual(["Milo", "Luna"]);
    expect(await getTrip(ownerB, res.tripId)).toBeNull();
    expect((await listTrips(ownerB)).length).toBe(0);
  });

  it("reuses an existing pet and updates its health answers", async () => {
    const pet = await savePet(ownerA, { profile: profile("Biscuit", "DOG"), health }, TODAY);
    if (!pet.ok) throw new Error();
    const res = await createTripFromDraft(
      ownerA,
      {
        pets: [{ existingId: pet.petId, profile: profile("Biscuit", "DOG"), health: { ...health, rabies: { status: "UNKNOWN" } } }],
        trip: { ...trip, destination: "IE", arrivalAirport: "DUB", returnDate: "", noReturnYet: true },
        recordsAvailable: "NO",
      },
      TODAY,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect((await db.pet.findUnique({ where: { id: pet.petId } }))!.rabiesStatus).toBe("UNKNOWN");
    expect((await getTrip(ownerA, res.tripId))!.returnDate).toBeNull();
  });

  it("refuses another owner's pet", async () => {
    const pet = await savePet(ownerA, { profile: profile("Private"), health }, TODAY);
    if (!pet.ok) throw new Error();
    const res = await createTripFromDraft(
      ownerB,
      { pets: [{ existingId: pet.petId, profile: profile("Private"), health }], trip, recordsAvailable: "NO" },
      TODAY,
    );
    expect(res).toEqual({ ok: false, message: "We couldn't find one of those pets." });
    expect((await db.pet.findUnique({ where: { id: pet.petId } }))!.ownerId).toBe(ownerA);
  });

  it("re-checks coverage on the server", async () => {
    const res = await createTripFromDraft(
      ownerA,
      { pets: [{ profile: profile("Milo"), health }], trip: { ...trip, destination: "ES" }, recordsAvailable: "NO" },
      TODAY,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues?.[0].code).toBe("ROUTE_NOT_SUPPORTED");
  });

  it("re-validates answers on the server", async () => {
    const res = await createTripFromDraft(ownerA, { pets: [], trip: { ...trip, arrivalDate: "" }, recordsAvailable: "" }, TODAY);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors ?? {})).toEqual(expect.arrayContaining(["pets", "trip.arrivalDate", "recordsAvailable"]));
  });
});

describe("deleting", () => {
  it("removes a trip left with no pets but keeps trips with other pets", async () => {
    const res = await createTripFromDraft(
      ownerA,
      { pets: [{ profile: profile("Solo"), health }], trip, recordsAvailable: "NO" },
      TODAY,
    );
    const shared = await createTripFromDraft(
      ownerA,
      { pets: [{ profile: profile("One"), health }, { profile: profile("Two"), health }], trip, recordsAvailable: "NO" },
      TODAY,
    );
    if (!res.ok || !shared.ok) throw new Error();
    const solo = (await getTrip(ownerA, res.tripId))!.pets[0].petId;
    const one = (await getTrip(ownerA, shared.tripId))!.pets[0].petId;

    expect(await deletePet(ownerB, solo)).toEqual({ ok: false, message: "We couldn't find that pet." });
    expect(await deletePet(ownerA, solo)).toEqual({ ok: true });
    expect(await getTrip(ownerA, res.tripId)).toBeNull();

    await deletePet(ownerA, one);
    expect((await getTrip(ownerA, shared.tripId))!.pets.map((p) => p.pet.name)).toEqual(["Two"]);
  });

  it("only lets the owner delete a trip", async () => {
    const res = await createTripFromDraft(ownerA, { pets: [{ profile: profile("Keep"), health }], trip, recordsAvailable: "NO" }, TODAY);
    if (!res.ok) throw new Error();
    expect(await deleteTrip(ownerB, res.tripId)).toEqual({ ok: false, message: "We couldn't find that trip." });
    expect(await deleteTrip(ownerA, res.tripId)).toEqual({ ok: true });
  });
});
