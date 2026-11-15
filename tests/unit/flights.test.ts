// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  AIRLINES,
  canBookFlights,
  flightEligibility,
  isSnubNosed,
  petEligibility,
  searchFlights,
} from "@/lib/flights/core";
import { bookFlight, flightsForTrip, upgradePlan } from "@/lib/flights/repository";
import { planStoredTrip } from "@/lib/trips/plan";
import { getTrip } from "@/lib/trips/repository";

const cat = { name: "Milo", species: "CAT", breed: "British Shorthair", weightKg: 4.5 };
const dog = { name: "Bella", species: "DOG", breed: "Cockapoo", weightKg: 9 };

describe("schedules", () => {
  it("are the same every time, with three departures per airline on the route", () => {
    const a = searchFlights({ destination: "FR", leg: "OUTBOUND", date: "2026-12-01" });
    expect(a).toEqual(searchFlights({ destination: "FR", leg: "OUTBOUND", date: "2026-12-01" }));
    expect(new Set(a.map((f) => f.airline))).toEqual(new Set(["AF", "BA"]));
    expect(a).toHaveLength(6);
    expect(a.every((f) => f.from === "LHR" && f.to === "CDG")).toBe(true);
    expect(a.map((f) => f.depart)).toEqual([...a.map((f) => f.depart)].sort());
  });

  it("fly home for the return leg and use the trip's airports", () => {
    const r = searchFlights({ destination: "IE", leg: "RETURN", date: "2026-12-10", ukAirport: "MAN", destAirport: "DUB" });
    expect(r.every((f) => f.from === "DUB" && f.to === "MAN")).toBe(true);
  });

  it("land the next day on a late flight to New York only in UK time terms", () => {
    const us = searchFlights({ destination: "US", leg: "OUTBOUND", date: "2026-12-01" });
    expect(us.every((f) => f.durationMin === 480)).toBe(true);
    const morning = us.find((f) => f.depart === "10:15");
    if (morning) expect(morning.arrive).toBe("13:15");
  });

  it("have no flights for routes PetJet doesn't plan", () => {
    expect(searchFlights({ destination: "ES", leg: "OUTBOUND", date: "2026-12-01" })).toEqual([]);
  });
});

describe("pet eligibility", () => {
  it("a small cat fits Air France's cabin; a 9 kg dog goes in the hold", () => {
    expect(petEligibility(AIRLINES.AF, cat, { intoGB: false }).placement).toBe("CABIN");
    const bella = petEligibility(AIRLINES.AF, dog, { intoGB: false, preference: "CABIN" });
    expect(bella.placement).toBe("HOLD");
    expect(bella.cabin.reason).toBe("Bella plus a bag is about 10.5 kg, over the 8 kg cabin limit.");
    expect(bella.summary).toMatch(/hold.*over the 8 kg cabin limit/);
  });

  it("respects a preference for the hold", () => {
    expect(petEligibility(AIRLINES.AF, cat, { intoGB: false, preference: "HOLD" }).placement).toBe("HOLD");
  });

  it("airlines without cabin pets book the hold as cargo", () => {
    const r = petEligibility(AIRLINES.BA, cat, { intoGB: false });
    expect(r.placement).toBe("CARGO");
    expect(r.cabin.reason).toBe("British Airways doesn't take pets in the cabin.");
  });

  it("pets flying into Great Britain go as cargo, even on Air France", () => {
    const r = petEligibility(AIRLINES.AF, cat, { intoGB: true });
    expect(r.placement).toBe("CARGO");
    expect(r.cabin.reason).toBe("Pets can't fly into Great Britain in the cabin.");
  });

  it("snub-nosed breeds can't go in the hold, so a big pug has no option", () => {
    expect(isSnubNosed("French Bulldog")).toBe(true);
    expect(isSnubNosed("Cockapoo")).toBe(false);
    const pug = { name: "Otis", species: "DOG", breed: "Pug", weightKg: 9 };
    expect(petEligibility(AIRLINES.BA, pug, { intoGB: false })).toMatchObject({ placement: null, summary: expect.stringMatching(/can't fly/) });
    // A small one can still go in Air France's cabin
    expect(petEligibility(AIRLINES.AF, { ...pug, weightKg: 6 }, { intoGB: false }).placement).toBe("CABIN");
  });

  it("asks for the weight before promising the cabin, and refuses species the airline won't carry", () => {
    expect(petEligibility(AIRLINES.AF, { ...cat, weightKg: null }, { intoGB: false })).toMatchObject({
      placement: "HOLD",
      cabin: { ok: false, reason: "Add Milo's weight to check the 8 kg cabin limit." },
    });
    expect(petEligibility(AIRLINES.AF, { name: "Bandit", species: "FERRET", breed: null, weightKg: 1 }, { intoGB: false }).placement).toBeNull();
  });

  it("a flight works only when every pet has a place, and its price includes the pet fees", () => {
    const f = searchFlights({ destination: "FR", leg: "OUTBOUND", date: "2026-12-01" }).find((x) => x.airline === "AF")!;
    const both = flightEligibility(f, [cat, dog]);
    expect(both).toMatchObject({ ok: true, placement: "HOLD" });
    expect(both.price).toBe(f.fare + 55 + 165);
    expect(flightEligibility(f, [cat, { name: "Otis", species: "DOG", breed: "Pug", weightKg: 12 }]).ok).toBe(false);
  });
});

it("only the Complete plan can book flights", () => {
  expect(canBookFlights("COMPLETE")).toBe(true);
  expect(canBookFlights("PLAN")).toBe(false);
  expect(canBookFlights("EXPLORE")).toBe(false);
});

/* ---------- Booking, against prisma/unit.db ---------- */

let owner: string;
let tripId: string;

beforeAll(async () => {
  owner = (await db.user.create({ data: { email: `fl-${Date.now()}@t.test`, name: "Flyer", passwordHash: "x", plan: "PLAN" } })).id;
  const pet = await db.pet.create({
    data: {
      ownerId: owner,
      name: "Bella",
      species: "DOG",
      breed: "Cockapoo",
      weightKg: 9,
      birthYear: 2021,
      birthMonth: 1,
      microchipStatus: "YES",
      microchipNumber: "956000012345678",
      microchipDate: "2021-04-01",
      rabiesStatus: "VACCINATED",
      rabiesLastDose: "2026-09-01",
      rabiesDoseKind: "PRIMARY",
    },
  });
  tripId = (
    await db.trip.create({
      data: { ownerId: owner, origin: "GB", destination: "IE", arrivalDate: "2026-12-01", returnDate: "2026-12-10", pets: { create: [{ petId: pet.id }] } },
    })
  ).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("booking", () => {
  it("needs the Complete plan, then books the journey out and fills in the airports", async () => {
    const trip = (await getTrip(owner, tripId))!;
    const out = flightsForTrip(trip, "OUTBOUND").find((f) => f.airline === "EI")!;
    expect(await bookFlight(owner, { tripId, leg: "OUTBOUND", flightId: out.id })).toMatchObject({ ok: false, upgrade: true });

    expect(await upgradePlan(owner, "COMPLETE")).toEqual({ ok: true });
    expect(await upgradePlan(owner, "PLAN")).toMatchObject({ ok: false });

    expect(await bookFlight(owner, { tripId, leg: "OUTBOUND", flightId: "XX999-2026-12-01-LHRDUB" })).toMatchObject({ ok: false, message: expect.stringMatching(/isn't available/) });
    const res = await bookFlight(owner, { tripId, leg: "OUTBOUND", flightId: out.id });
    expect(res.ok).toBe(true);
    const saved = await db.booking.findFirst({ where: { tripId, leg: "OUTBOUND" } });
    expect(saved).toMatchObject({ airline: "EI", fromCode: "LHR", toCode: "DUB", placement: "CARGO" });
    expect(saved!.reference).toMatch(/^[A-Z2-9]{6}$/);
    expect(await db.trip.findUnique({ where: { id: tripId } })).toMatchObject({ departureAirport: "LHR", arrivalAirport: "DUB" });
    expect(await bookFlight(owner, { tripId, leg: "OUTBOUND", flightId: out.id })).toMatchObject({ ok: false, message: expect.stringMatching(/already booked/) });

    // Dublin is an approved point of entry, so that step is now done
    const plan = planStoredTrip((await getTrip(owner, tripId))!, "2026-11-15").pets[0].plan;
    expect(plan.supported && plan.tasks.find((t) => t.id === "ireland-entry")?.status).toBe("DONE");
  });

  it("flying home as cargo completes the approved-route step", async () => {
    const trip = (await getTrip(owner, tripId))!;
    const home = flightsForTrip(trip, "RETURN")[0];
    expect(home.from).toBe("DUB");
    expect(await bookFlight(owner, { tripId, leg: "RETURN", flightId: home.id })).toMatchObject({ ok: true });
    const record = await db.taskRecord.findFirst({ where: { tripId, key: "approvedRouteBooked" } });
    expect(record).toMatchObject({ source: "BOOKING", issuedBy: expect.any(String) });
  });

  it("other owners can't book on someone else's trip", async () => {
    const other = (await db.user.create({ data: { email: `fl2-${Date.now()}@t.test`, name: "X", passwordHash: "x", plan: "COMPLETE" } })).id;
    expect(await bookFlight(other, { tripId, leg: "OUTBOUND", flightId: "x" })).toMatchObject({ ok: false, message: "We couldn't find that trip." });
  });
});
