// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/rules/dates";
import { checkCoverage, type CoverageTrip } from "@/lib/trips/coverage";
import { ageLabel, windowLabel } from "@/lib/trips/format";
import { dateOfBirth, planTrip, toPetInput, type PetRecord, type TripRecord } from "@/lib/trips/plan";
import { draftSchema, issuesToErrors, petHealthSchema, petProfileSchema, tripSchema } from "@/lib/trips/schemas";

const TODAY = "2026-11-15";

const errorsOf = <T,>(r: { success: boolean; error?: unknown } & T) =>
  r.success ? {} : issuesToErrors((r as unknown as { error: Parameters<typeof issuesToErrors>[0] }).error);

describe("pet profile validation", () => {
  const ok = { name: " Milo ", species: "CAT", breed: "", birthYear: "2023", birthMonth: "3", birthDay: "", weightKg: "" };

  it("accepts month and year, trims text and drops empty optionals", () => {
    const r = petProfileSchema(TODAY).safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({ name: "Milo", birthYear: 2023, birthMonth: 3 });
      expect(r.data.birthDay).toBeUndefined();
      expect(r.data.breed).toBeUndefined();
      expect(r.data.weightKg).toBeUndefined();
    }
  });

  it("rejects other species, missing answers, impossible and future dates", () => {
    expect(errorsOf(petProfileSchema(TODAY).safeParse({ ...ok, species: "OTHER" }))).toHaveProperty("species");
    expect(errorsOf(petProfileSchema(TODAY).safeParse({ ...ok, name: "  " }))).toEqual({ name: "Enter your pet's name." });
    expect(errorsOf(petProfileSchema(TODAY).safeParse({ ...ok, birthYear: "2026", birthMonth: "2", birthDay: "30" }))).toEqual({
      birthDay: "That day doesn't exist in that month.",
    });
    expect(errorsOf(petProfileSchema(TODAY).safeParse({ ...ok, birthYear: "2026", birthMonth: "12" }))).toEqual({
      birthMonth: "The date of birth can't be in the future.",
    });
    expect(errorsOf(petProfileSchema(TODAY).safeParse({ ...ok, birthYear: "2026", birthMonth: "11", birthDay: "16" }))).toEqual({
      birthDay: "The date of birth can't be in the future.",
    });
    expect(petProfileSchema(TODAY).safeParse({ ...ok, birthYear: "2026", birthMonth: "11" }).success).toBe(true);
    expect(errorsOf(petProfileSchema(TODAY).safeParse({ ...ok, weightKg: "0" }))).toHaveProperty("weightKg");
  });
});

describe("pet health validation", () => {
  const base = {
    microchip: { status: "YES", number: "956 000 012 345 678", implantedOn: "2023-06-01" },
    rabies: { status: "VACCINATED", lastDoseOn: "2026-09-01", lastDoseKind: "PRIMARY", validUntil: "2029-09-01" },
  };

  it("normalises a microchip number with spaces", () => {
    const r = petHealthSchema(TODAY).safeParse(base);
    expect(r.success && r.data.microchip.number).toBe("956000012345678");
  });

  it("checks microchip length, future dates and validity order", () => {
    expect(errorsOf(petHealthSchema(TODAY).safeParse({ ...base, microchip: { ...base.microchip, number: "12345" } }))).toEqual({
      "microchip.number": "A standard microchip number has 15 digits.",
    });
    expect(
      errorsOf(petHealthSchema(TODAY).safeParse({ ...base, rabies: { ...base.rabies, lastDoseOn: "2026-12-01" } })),
    ).toHaveProperty(["rabies.lastDoseOn"]);
    expect(
      errorsOf(petHealthSchema(TODAY).safeParse({ ...base, rabies: { ...base.rabies, validUntil: "2026-08-01" } })),
    ).toHaveProperty(["rabies.validUntil"]);
  });

  it("requires an answer for microchip and rabies", () => {
    const r = errorsOf(petHealthSchema(TODAY).safeParse({ microchip: { status: "" }, rabies: { status: "" } }));
    expect(Object.keys(r).sort()).toEqual(["microchip.status", "rabies.status"]);
  });
});

describe("trip validation (the 'request missing travel details' branch)", () => {
  const trip = {
    origin: "GB",
    destination: "FR",
    arrivalDate: "2027-03-15",
    returnDate: "2027-03-29",
    noReturnYet: false,
    transit: "NONE",
    accompaniment: "OWNER",
    purpose: "PERSONAL",
  };

  it("accepts a complete trip and a trip without a return date yet", () => {
    expect(tripSchema(TODAY).safeParse(trip).success).toBe(true);
    expect(tripSchema(TODAY).safeParse({ ...trip, returnDate: "", noReturnYet: true }).success).toBe(true);
  });

  it("asks for every missing detail at once", () => {
    const r = errorsOf(
      tripSchema(TODAY).safeParse({ origin: "GB", destination: "", arrivalDate: "", noReturnYet: false, transit: "" }),
    );
    expect(r).toMatchObject({
      destination: "Choose where you're going.",
      arrivalDate: "Enter the date your pet arrives.",
      transit: "Tell us about any stopovers.",
      accompaniment: "Tell us who your pet travels with.",
      purpose: "Tell us the reason for the trip.",
      returnDate: "Enter your return date, or tick that you don't know it yet.",
    });
  });

  it("asks for a return date or the 'don't know yet' box", () => {
    expect(errorsOf(tripSchema(TODAY).safeParse({ ...trip, returnDate: "" }))).toEqual({
      returnDate: "Enter your return date, or tick that you don't know it yet.",
    });
  });

  it("rejects past, back-to-front, same-country and far-future trips", () => {
    expect(errorsOf(tripSchema(TODAY).safeParse({ ...trip, arrivalDate: "2026-11-01" }))).toHaveProperty("arrivalDate");
    expect(errorsOf(tripSchema(TODAY).safeParse({ ...trip, returnDate: "2027-03-15" }))).toHaveProperty("returnDate");
    expect(errorsOf(tripSchema(TODAY).safeParse({ ...trip, destination: "GB" }))).toHaveProperty("destination");
    expect(errorsOf(tripSchema(TODAY).safeParse({ ...trip, arrivalDate: addDays(TODAY, 731), returnDate: "" , noReturnYet: true}))).toHaveProperty("arrivalDate");
  });

  it("limits a trip to five pets", () => {
    const pet = {
      profile: { name: "A", species: "CAT", birthYear: "2020", birthMonth: "1" },
      health: { microchip: { status: "YES" }, rabies: { status: "UNKNOWN" } },
    };
    const r = draftSchema(TODAY).safeParse({ pets: Array(6).fill(pet), trip, recordsAvailable: "NO" });
    expect(errorsOf(r)).toHaveProperty("pets");
    expect(draftSchema(TODAY).safeParse({ pets: [pet], trip, recordsAvailable: "NO" }).success).toBe(true);
  });
});

describe("date of birth from month and year", () => {
  it("uses the last day of the month when the day is unknown", () => {
    expect(dateOfBirth(2023, 3, null, TODAY)).toEqual({ date: "2023-03-31", assumed: true });
    expect(dateOfBirth(2024, 2, null, TODAY)).toEqual({ date: "2024-02-29", assumed: true });
    expect(dateOfBirth(2023, 2, null, TODAY)).toEqual({ date: "2023-02-28", assumed: true });
    expect(dateOfBirth(2023, 3, 9, TODAY)).toEqual({ date: "2023-03-09", assumed: false });
  });

  it("never returns a future date", () => {
    expect(dateOfBirth(2026, 11, null, TODAY)).toEqual({ date: TODAY, assumed: true });
  });
});

describe("coverage check (supported species and route branches)", () => {
  const trip: CoverageTrip = {
    origin: "GB",
    destination: "FR",
    arrivalDate: "2027-03-15",
    transit: "NONE",
    purpose: "PERSONAL",
    accompaniment: "OWNER",
  };
  const milo = { name: "Milo", species: "CAT" };

  it("passes supported trips, including airside stopovers", () => {
    expect(checkCoverage([milo], trip, TODAY)).toEqual([]);
    expect(checkCoverage([milo], { ...trip, transit: "AIRSIDE" }, TODAY)).toEqual([]);
  });

  it("stops unsupported routes, species, stopovers and commercial moves", () => {
    expect(checkCoverage([milo], { ...trip, destination: "ES" }, TODAY).map((i) => i.code)).toEqual([
      "ROUTE_NOT_SUPPORTED",
    ]);
    const ferret = checkCoverage([{ name: "Bandit", species: "FERRET" }], { ...trip, destination: "US" }, TODAY);
    expect(ferret[0].code).toBe("SPECIES_NOT_SUPPORTED");
    expect(ferret[0].message).toMatch(/^Bandit: /);
    expect(checkCoverage([milo], { ...trip, transit: "LEAVES_AIRPORT" }, TODAY).map((i) => i.code)).toEqual([
      "TRANSIT_ENTRY",
    ]);
    expect(checkCoverage([milo], { ...trip, purpose: "COMMERCIAL" }, TODAY).map((i) => i.code)).toEqual([
      "COMMERCIAL_MOVEMENT",
    ]);
  });

  it("reports a shared problem once for several pets", () => {
    const issues = checkCoverage([milo, { name: "Luna", species: "CAT" }], { ...trip, destination: "ES" }, TODAY);
    expect(issues).toHaveLength(1);
  });
});

describe("planning a stored trip", () => {
  const pet = (over: Partial<PetRecord> = {}): PetRecord => ({
    id: "p1",
    name: "Milo",
    species: "CAT",
    breed: null,
    birthYear: 2023,
    birthMonth: 3,
    birthDay: null,
    hasPedigree: null,
    microchipStatus: "YES",
    microchipDate: "2023-06-01",
    rabiesStatus: "VACCINATED",
    rabiesLastDose: "2026-09-01",
    rabiesDoseKind: "PRIMARY",
    rabiesValidUntil: "2029-09-01",
    ...over,
  });
  const trip: TripRecord = {
    id: "t1",
    origin: "GB",
    destination: "FR",
    arrivalDate: "2027-03-15",
    returnDate: "2027-03-29",
    accompaniment: "OWNER",
    arrivalAirport: "CDG",
  };

  it("maps stored fields to engine input", () => {
    const { input, dobAssumed } = toPetInput(pet(), TODAY);
    expect(dobAssumed).toBe(true);
    expect(input).toMatchObject({
      dateOfBirth: "2023-03-31",
      microchip: { status: "YES", implantedOn: "2023-06-01" },
      rabies: { status: "VACCINATED", lastDoseOn: "2026-09-01", lastDoseKind: "PRIMARY" },
    });
  });

  it("explains the assumed birthday on the plan", () => {
    const result = planTrip(trip, [pet()], TODAY);
    const plan = result.pets[0].plan;
    expect(plan.supported && plan.warnings.join(" ")).toContain("last day of that month");
  });

  it("reports the worst status across pets", () => {
    const result = planTrip(
      { ...trip, arrivalDate: "2026-11-25", returnDate: null },
      [pet(), pet({ id: "p2", name: "Luna", rabiesStatus: "NONE", rabiesLastDose: null, rabiesDoseKind: null })],
      TODAY,
    );
    expect(result.pets.map((p) => (p.plan.supported ? p.plan.status : "x"))).toEqual(["IN_PROGRESS", "NOT_FEASIBLE"]);
    expect(result.status).toBe("NOT_FEASIBLE");
  });

  it("counts pets on the trip for the five-pet rule", () => {
    const six = Array.from({ length: 6 }, (_, i) => pet({ id: `p${i}`, name: `Pet ${i}` }));
    expect(planTrip(trip, six, TODAY).status).toBe("UNSUPPORTED");
  });
});

describe("formatting", () => {
  it("labels date windows", () => {
    expect(windowLabel({ from: "2027-03-06", to: "2027-03-15" })).toBe("6 Mar – 15 Mar 2027");
    expect(windowLabel({ from: "2026-12-30", to: "2027-01-02" })).toBe("30 Dec 2026 – 2 Jan 2027");
    expect(windowLabel({ to: "2027-02-21" })).toBe("By 21 Feb 2027");
    expect(windowLabel({ from: "2027-03-29" })).toBe("From 29 Mar 2027");
    expect(windowLabel(undefined)).toBeNull();
  });

  it("labels ages", () => {
    expect(ageLabel(2023, 3, TODAY)).toBe("3 years");
    expect(ageLabel(2026, 6, TODAY)).toBe("5 months");
    expect(ageLabel(2026, 11, TODAY)).toBe("Under 1 month");
    expect(ageLabel(2025, 10, TODAY)).toBe("13 months");
  });
});
