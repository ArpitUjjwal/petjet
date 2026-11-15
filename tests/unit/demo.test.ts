// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DEMO_ACCOUNTS, DEMO_PET } from "../../prisma/demo-accounts";
import { DEMO_TRIP_DAYS, seedDemoJourney } from "../../prisma/demo-journey";
import { demoSwitchTargets, demoWhoFor, isDemoEmail } from "@/lib/auth/demo";
import { db } from "@/lib/db";
import { addDays, todayISO } from "@/lib/rules/dates";
import { planStoredTrip } from "@/lib/trips/plan";
import { getTrip } from "@/lib/trips/repository";
import { confirmDocument, countToReview } from "@/lib/documents/repository";
import { simulateVetResponse, simulationOn } from "@/lib/demo/simulate";
import { bookRecommended, listBookings } from "@/lib/flights/repository";
import { chooseInsurance } from "@/lib/insurance/repository";
import { insuranceOffers } from "@/lib/insurance/offers";
import { buildJourney, journeyComplete } from "@/lib/trips/journey";
import { proposeSlots } from "@/lib/vets/core";
import { requestAppointment } from "@/lib/vets/repository";

describe("demo switcher guards", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("recognises only the demo accounts", () => {
    expect(demoWhoFor(DEMO_ACCOUNTS.vet.email)).toBe("vet");
    expect(demoWhoFor(" Mariyam@PetJet.test ")).toBe("owner");
    expect(isDemoEmail("someone@example.com")).toBe(false);
  });

  it("offers all three accounts to a demo user, marking the current one", () => {
    const t = demoSwitchTargets(DEMO_ACCOUNTS.lab.email);
    expect(t.map((x) => [x.who, x.current])).toEqual([
      ["owner", false],
      ["vet", false],
      ["lab", true],
    ]);
  });

  it("offers nothing to real accounts, or when demo mode is off", () => {
    expect(demoSwitchTargets("real.owner@example.com")).toEqual([]);
    vi.stubEnv("DEMO_MODE", "false");
    expect(demoSwitchTargets(DEMO_ACCOUNTS.owner.email)).toEqual([]);
  });
});

describe("npm run db:demo", () => {
  const today = todayISO();
  let ownerId: string;
  let bystander: string;

  beforeAll(async () => {
    for (const acc of Object.values(DEMO_ACCOUNTS)) {
      await db.user.upsert({ where: { email: acc.email }, update: {}, create: { email: acc.email, name: acc.name, role: acc.role, passwordHash: "!" } });
    }
    ownerId = (await db.user.findUniqueOrThrow({ where: { email: DEMO_ACCOUNTS.owner.email } })).id;
    bystander = (await db.user.create({ data: { email: `demo-bystander-${Date.now()}@t.test`, name: "B", passwordHash: "x" } })).id;
    await db.pet.create({ data: { ownerId: bystander, name: "Untouched", species: "CAT", birthYear: 2020, birthMonth: 1 } });
    await db.notification.create({ data: { userId: bystander, kind: "LAB_RESULT", title: "Mine", body: "x" } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function snapshot() {
    const [pets, trips, docs, notes, user] = await Promise.all([
      db.pet.findMany({ where: { ownerId } }),
      db.trip.findMany({ where: { ownerId } }),
      db.document.findMany({ where: { ownerId }, orderBy: { fileName: "asc" } }),
      db.notification.count({ where: { userId: ownerId } }),
      db.user.findUniqueOrThrow({ where: { id: ownerId } }),
    ]);
    return {
      pets: pets.map((p) => [p.name, p.breed, p.weightKg, p.microchipNumber, p.rabiesStatus]),
      trips: trips.map((t) => [t.origin, t.destination, t.arrivalDate, t.returnDate]),
      docs: docs.map((d) => [d.fileName, d.type, d.status]),
      notes,
      plan: user.plan,
      insurance: trips.map((t) => t.insuranceOffer),
    };
  }

  it("sets the demo owner up a week before the trip", async () => {
    const seeded = await seedDemoJourney(today);
    const s = await snapshot();
    expect(s.pets).toEqual([[DEMO_PET.name, DEMO_PET.breed, DEMO_PET.weightKg, DEMO_PET.microchip, "VACCINATED"]]);
    expect(s.trips).toEqual([["GB", "FR", addDays(today, DEMO_TRIP_DAYS.out), addDays(today, DEMO_TRIP_DAYS.back)]]);
    expect(s.docs).toEqual([
      ["microchip-certificate-bella.pdf", "MICROCHIP", expect.stringMatching(/^(READY|NEEDS_REVIEW)$/)],
      ["rabies-vaccination-bella.pdf", "RABIES", "CONFIRMED"],
    ]);
    expect(s.plan).toBe("COMPLETE");

    /* The vet can issue the health certificate today */
    const trip = (await getTrip(ownerId, seeded.tripId))!;
    const ahc = planStoredTrip(trip, today).pets[0].plan;
    expect(ahc.supported && ahc.tasks.find((t) => t.id === "ahc")).toMatchObject({ status: "TODO", window: { from: today } });
  });

  it("gives the same state when run again, wiping what happened in between", async () => {
    const before = await snapshot();
    await db.notification.create({ data: { userId: ownerId, kind: "FLIGHT_BOOKED", title: "x", body: "x" } });
    await db.user.update({ where: { id: ownerId }, data: { plan: "EXPLORE" } });
    await db.trip.updateMany({ where: { ownerId }, data: { insuranceOffer: "meadow" } });
    await seedDemoJourney(today);
    expect(await snapshot()).toEqual(before);
  });

  it("leaves other owners alone", async () => {
    expect(await db.pet.count({ where: { ownerId: bystander } })).toBe(1);
    expect(await db.notification.count({ where: { userId: bystander } })).toBe(1);
  });
});

describe("guided happy path", () => {
  const today = todayISO();
  let ownerId: string;

  beforeAll(async () => {
    for (const acc of Object.values(DEMO_ACCOUNTS)) {
      await db.user.upsert({ where: { email: acc.email }, update: {}, create: { email: acc.email, name: acc.name, role: acc.role, passwordHash: "!" } });
    }
    ownerId = (await db.user.findUniqueOrThrow({ where: { email: DEMO_ACCOUNTS.owner.email } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function journey(tripId: string) {
    const trip = (await getTrip(ownerId, tripId))!;
    const plan = planStoredTrip(trip, today);
    return buildJourney({
      tripId,
      petNames: "Bella",
      plans: plan.pets,
      toReview: await countToReview(ownerId),
      legsNeeded: 2,
      legsBooked: (await listBookings(ownerId, tripId)).length,
      insurer: trip.insuranceOffer,
    });
  }
  const states = (steps: Awaited<ReturnType<typeof journey>>) => steps.map((s) => s.state);

  it("simulates replies only for demo accounts with demo mode on", () => {
    expect(simulationOn(DEMO_ACCOUNTS.owner.email)).toBe(true);
    expect(simulationOn("someone@example.com")).toBe(false);
    vi.stubEnv("DEMO_MODE", "false");
    expect(simulationOn(DEMO_ACCOUNTS.owner.email)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("goes from step 1 to ready to fly, every step succeeding", async () => {
    const seeded = await seedDemoJourney(today);
    expect(states(await journey(seeded.tripId))).toEqual(["current", "upcoming", "upcoming", "upcoming", "upcoming"]);

    /* 1. Check the microchip certificate */
    const confirmed = await confirmDocument(ownerId, seeded.reviewDocumentId, { fields: {}, acknowledged: true }, today);
    expect(confirmed.ok).toBe(true);
    expect(states(await journey(seeded.tripId))).toEqual(["done", "current", "upcoming", "upcoming", "upcoming"]);

    /* 2. Request the health certificate; the practice answers by itself */
    const vetUser = await db.user.findUniqueOrThrow({ where: { email: DEMO_ACCOUNTS.vet.email } });
    const provider =
      (await db.provider.findUnique({ where: { userId: vetUser.id } })) ??
      (await db.provider.create({
        data: { userId: vetUser.id, type: "VET", name: "Demo Vet", registrationNumber: "X", city: "London", postcode: "SE1", verified: true, officialVet: true, services: JSON.stringify(["ANIMAL_HEALTH_CERTIFICATE"]) },
      }));
    const trip = (await getTrip(ownerId, seeded.tripId))!;
    const ahc = planStoredTrip(trip, today).pets[0].plan;
    const window = ahc.supported ? ahc.tasks.find((t) => t.id === "ahc")!.window : undefined;
    const req = await requestAppointment(
      ownerId,
      { providerId: provider.id, petId: seeded.petId, tripId: seeded.tripId, taskId: "ahc", service: "ANIMAL_HEALTH_CERTIFICATE", slot: proposeSlots(provider.id, window, today)[0], documentIds: [], consent: false },
      today,
    );
    expect(req.ok).toBe(true);
    const sim = await simulateVetResponse(req.ok ? req.appointmentId : "", today);
    expect(sim).toMatchObject({ accepted: true, recorded: true });
    expect(states(await journey(seeded.tripId))).toEqual(["done", "done", "current", "upcoming", "upcoming"]);

    /* 3. Book both recommended flights */
    expect(await bookRecommended(ownerId, seeded.tripId)).toEqual({ ok: true, booked: 2 });
    expect(states(await journey(seeded.tripId))).toEqual(["done", "done", "done", "current", "upcoming"]);

    /* 4. Choose cover from the four offers */
    expect(insuranceOffers("FR", ["DOG"])).toHaveLength(4);
    expect(await chooseInsurance(ownerId, seeded.tripId, "nope")).toMatchObject({ ok: false });
    expect(await chooseInsurance(ownerId, seeded.tripId, "meadow")).toEqual({ ok: true });

    /* 5. Ready to fly */
    expect(journeyComplete(await journey(seeded.tripId))).toBe(true);
  });
});
