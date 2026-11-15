// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LAST_VERIFIED, RULES, SUPPORTED_ROUTE_SPECIES } from "@/lib/rules/catalog";
import {
  addDays,
  addMonths,
  diffDays,
  formatDate,
  isISODate,
  maxDate,
  minDate,
  todayISO,
} from "@/lib/rules/dates";
import { PlanInputError, evaluateTrip } from "@/lib/rules/engine";
import type { PetInput, Plan, PlanTask, SupportedPlan, TaskRecords, TripInput } from "@/lib/rules/types";

const TODAY = "2026-11-15";

function pet(over: Partial<PetInput> = {}): PetInput {
  return {
    name: "Milo",
    species: "CAT",
    dateOfBirth: "2023-05-01",
    microchip: { status: "YES", implantedOn: "2023-08-01" },
    rabies: { status: "VACCINATED", lastDoseOn: "2026-09-01", lastDoseKind: "PRIMARY", validUntil: "2029-09-01" },
    ...over,
  };
}

function trip(over: Partial<TripInput> = {}): TripInput {
  return {
    origin: "GB",
    destination: "FR",
    arrivalDate: "2027-03-15",
    returnDate: "2027-03-29",
    petCount: 1,
    purpose: "PERSONAL",
    accompaniment: "OWNER",
    ...over,
  };
}

function plan(p: Partial<PetInput> = {}, t: Partial<TripInput> = {}, records?: TaskRecords): SupportedPlan {
  const result = evaluateTrip(pet(p), trip(t), { today: TODAY, records });
  if (!result.supported) throw new Error(`Expected a supported plan: ${JSON.stringify(result.reasons)}`);
  return result;
}

function task(p: SupportedPlan, id: string): PlanTask {
  const t = p.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`No task ${id}. Tasks: ${p.tasks.map((x) => x.id).join(", ")}`);
  return t;
}

const ids = (p: SupportedPlan) => p.tasks.map((t) => t.id);

/* ------------------------------------------------------------------ */

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isISODate("2027-02-28")).toBe(true);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2027-02-29")).toBe(false);
    expect(isISODate("2027-13-01")).toBe(false);
    expect(isISODate("15/03/2027")).toBe(false);
    expect(isISODate(undefined)).toBe(false);
  });

  it("adds days across months and years", () => {
    expect(addDays("2027-02-27", 2)).toBe("2027-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-15", -9)).toBe("2027-03-06");
  });

  it("adds months, clamping to the end of shorter months", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2027-08-31", 6)).toBe("2028-02-29");
    expect(addMonths("2027-03-15", -6)).toBe("2026-09-15");
  });

  it("is unaffected by daylight-saving changes", () => {
    // UK clocks change on 28 Mar 2027 and 31 Oct 2027
    expect(diffDays("2027-03-29", "2027-03-27")).toBe(2);
    expect(addDays("2027-10-30", 2)).toBe("2027-11-01");
  });

  it("compares, picks and formats", () => {
    expect(maxDate("2027-01-01", undefined, "2026-12-31")).toBe("2027-01-01");
    expect(minDate("2027-01-01", "2026-12-31")).toBe("2026-12-31");
    expect(formatDate("2027-03-15")).toBe("15 Mar 2027");
    expect(todayISO("Europe/London", new Date("2026-11-15T23:30:00Z"))).toBe("2026-11-15");
    expect(todayISO("Asia/Kolkata", new Date("2026-11-15T23:30:00Z"))).toBe("2026-11-16");
  });
});

/* ------------------------------------------------------------------ */

describe("rules catalog", () => {
  it("has unique ids, official https sources and a verified date on every rule", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const r of RULES) {
      expect(r.sources.length, r.id).toBeGreaterThan(0);
      for (const s of r.sources) {
        expect(s.url, r.id).toMatch(/^https:\/\/(www\.gov\.uk|assets\.gov\.ie|www\.douane\.gouv\.fr|www\.cdc\.gov)\//);
      }
      expect(isISODate(r.lastVerified)).toBe(true);
      expect(r.summary.length, r.id).toBeGreaterThan(20);
    }
    expect(LAST_VERIFIED).toBe("2026-11-15");
  });

  it("covers only the supported routes and their returns", () => {
    const allowed = new Set([...Object.keys(SUPPORTED_ROUTE_SPECIES), "FR-GB", "IE-GB", "US-GB"]);
    for (const r of RULES) for (const route of r.routes) expect(allowed.has(route), `${r.id} ${route}`).toBe(true);
  });

  it("encodes the verified numbers as structured params", () => {
    const p = (id: string) => RULES.find((r) => r.id === id)!.params;
    expect(p("GB-EU-RABIES")).toMatchObject({ minAgeDays: 84, waitFullDays: 21 });
    expect(p("GB-EU-AHC")).toMatchObject({ entryValidityDays: 10, reentryValidityMonths: 6 });
    expect(p("IE-TAPEWORM")).toMatchObject({ minHours: 24, maxHours: 120 });
    expect(p("FR-MIN-AGE")).toMatchObject({ minAgeDays: 112 });
    expect(p("US-DOG-AGE")).toMatchObject({ minAgeMonths: 6 });
    expect(p("GB-ENTRY-TAPEWORM")).toMatchObject({ exemptFrom: ["IE", "FI", "MT", "NO"] });
  });

  it("marks the export certificate guidance as needing review", () => {
    expect(RULES.find((r) => r.id === "GB-EXPORT-NON-EU")!.reviewStatus).toBe("NEEDS_REVIEW");
    expect(RULES.filter((r) => r.reviewStatus === "NEEDS_REVIEW")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */

describe("unsupported trips", () => {
  const reasons = (r: Plan) => (r.supported ? [] : r.reasons.map((x) => x.code));

  it("refuses routes it hasn't verified instead of guessing", () => {
    const r = evaluateTrip(pet(), trip({ destination: "ES" }), { today: TODAY });
    expect(r.supported).toBe(false);
    expect(reasons(r)).toEqual(["ROUTE_NOT_SUPPORTED"]);
    if (!r.supported) expect(r.reasons[0].message).toContain("We only plan routes whose rules we have verified");
    expect(reasons(evaluateTrip(pet(), trip({ origin: "FR", destination: "GB" }), { today: TODAY }))).toEqual([
      "ROUTE_NOT_SUPPORTED",
    ]);
  });

  it("accepts lower-case and padded codes", () => {
    expect(evaluateTrip(pet(), trip({ origin: " gb", destination: "fr " }), { today: TODAY }).supported).toBe(true);
  });

  it("refuses species not on the route", () => {
    const rabbit = evaluateTrip(pet({ species: "rabbit" }), trip(), { today: TODAY });
    expect(reasons(rabbit)).toEqual(["SPECIES_NOT_SUPPORTED"]);
    const ferretUs = evaluateTrip(pet({ species: "FERRET" }), trip({ destination: "US" }), { today: TODAY });
    expect(reasons(ferretUs)).toEqual(["SPECIES_NOT_SUPPORTED"]);
    if (!ferretUs.supported) expect(ferretUs.reasons[0].message).toContain("dogs and cats only");
    expect(evaluateTrip(pet({ species: "ferret" }), trip(), { today: TODAY }).supported).toBe(true);
  });

  it("refuses more than five pets and commercial or unaccompanied movements", () => {
    expect(reasons(evaluateTrip(pet(), trip({ petCount: 6 }), { today: TODAY }))).toEqual(["TOO_MANY_PETS"]);
    expect(evaluateTrip(pet(), trip({ petCount: 5 }), { today: TODAY }).supported).toBe(true);
    expect(reasons(evaluateTrip(pet(), trip({ purpose: "COMMERCIAL" }), { today: TODAY }))).toEqual([
      "COMMERCIAL_MOVEMENT",
    ]);
    expect(
      reasons(evaluateTrip(pet(), trip({ accompaniment: "UNACCOMPANIED", petCount: 7 }), { today: TODAY })),
    ).toEqual(["TOO_MANY_PETS", "COMMERCIAL_MOVEMENT"]);
  });
});

describe("input validation", () => {
  const bad = (p: Partial<PetInput>, t: Partial<TripInput>, field: string) => {
    let err: unknown;
    try {
      evaluateTrip(pet(p), trip(t), { today: TODAY });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PlanInputError);
    expect((err as PlanInputError).field).toBe(field);
  };

  it("rejects malformed and impossible dates", () => {
    bad({}, { arrivalDate: "2027-02-30" }, "arrivalDate");
    bad({}, { arrivalDate: "" }, "arrivalDate");
    bad({}, { returnDate: "2027-03-10" }, "returnDate");
    bad({}, { returnDate: "2027-03-15" }, "returnDate");
    bad({ dateOfBirth: "2027-01-01" }, {}, "dateOfBirth");
    bad({ rabies: { status: "VACCINATED", lastDoseOn: "2026-12-01" } }, {}, "rabies.lastDoseOn");
    bad({}, { petCount: 0 }, "petCount");
    bad({}, { petCount: 1.5 }, "petCount");
  });

  it("requires today", () => {
    expect(() => evaluateTrip(pet(), trip(), { today: "" })).toThrow(PlanInputError);
  });
});

/* ------------------------------------------------------------------ */

describe("Great Britain to France", () => {
  it("builds a sourced plan for a vaccinated cat", () => {
    const p = plan();
    expect(p.route).toBe("GB-FR");
    expect(p.returnRoute).toBe("FR-GB");
    expect(p.status).toBe("IN_PROGRESS");
    expect(p.blockers).toEqual([]);
    expect(task(p, "microchip").status).toBe("DONE");
    expect(task(p, "rabies").status).toBe("DONE");
    expect(task(p, "age-france").status).toBe("DONE");
    expect(ids(p)).not.toContain("tapeworm-outbound");
    expect(ids(p)).not.toContain("tapeworm-return"); // cats don't need it
    expect(ids(p)).toContain("return-approved-route");
  });

  it("puts the animal health certificate in the 10-day window counting the issue date as day 1", () => {
    const ahc = task(plan(), "ahc");
    expect(ahc.window).toEqual({ from: "2027-03-06", to: "2027-03-15" });
    expect(ahc.officialVet).toBe(true);
    expect(ahc.service).toBe("ANIMAL_HEALTH_CERTIFICATE");
    expect(ahc.dependsOn).toEqual(["microchip", "rabies"]);
    expect(ahc.detail).toContain("covers your return");
  });

  it("lists every applied rule with its source, and every task's rule is in that list", () => {
    const p = plan();
    const ruleIds = new Set(p.rules.map((r) => r.id));
    for (const t of p.tasks) for (const id of t.ruleIds) expect(ruleIds.has(id), `${t.id} -> ${id}`).toBe(true);
    expect(ruleIds.has("GB-EU-AHC")).toBe(true);
    expect(ruleIds.has("IE-TAPEWORM")).toBe(false);
  });

  it("every dependency points to a task in the plan", () => {
    for (const p of [plan(), plan({ species: "DOG" }, { destination: "IE" }), plan({ species: "DOG" }, { destination: "US" })]) {
      const all = new Set(ids(p));
      for (const t of p.tasks) for (const d of t.dependsOn) expect(all.has(d), `${t.id} -> ${d}`).toBe(true);
    }
  });

  it("orders outbound before return, done steps first and advice last", () => {
    const p = plan({ species: "DOG", breed: "Labrador" });
    const legs = p.tasks.map((t) => t.leg);
    expect(legs.indexOf("RETURN")).toBeGreaterThan(legs.lastIndexOf("OUTBOUND"));
    const out = p.tasks.filter((t) => t.leg === "OUTBOUND");
    expect(out[0].status).toBe("DONE");
    const ret = p.tasks.filter((t) => t.leg === "RETURN");
    expect(ret.at(-1)!.status).toBe("INFO");
  });

  it("needs a dog's return tapeworm treatment 1 to 5 days before re-entering GB, done abroad", () => {
    const p = plan({ species: "DOG", breed: "Labrador" });
    const tw = task(p, "tapeworm-return");
    expect(tw.window).toEqual({ from: "2027-03-24", to: "2027-03-28" });
    expect(tw.abroad).toBe(true);
    expect(task(p, "tapeworm-after-return").status).toBe("INFO");
    expect(task(p, "tapeworm-after-return").window).toEqual({ from: "2027-03-29", to: "2027-04-26" });
  });

  it("is READY when every required step is evidenced", () => {
    const p = plan({}, {}, { ahcIssuedOn: "2027-03-10", approvedRouteBooked: true });
    expect(task(p, "ahc").status).toBe("DONE");
    expect(task(p, "return-document").status).toBe("DONE");
    expect(p.status).toBe("READY");
  });

  it("rejects a certificate issued outside its window", () => {
    const p = plan({}, {}, { ahcIssuedOn: "2027-03-01" });
    expect(task(p, "ahc").status).toBe("TODO");
    expect(p.warnings.join(" ")).toContain("isn't valid for arriving on 15 Mar 2027");
  });
});

describe("rabies vaccination and the 21-day wait", () => {
  it("blocks a trip when an unvaccinated pet can't finish the wait, and gives the earliest date", () => {
    const p = plan({ rabies: { status: "NONE" } }, { arrivalDate: "2026-11-25", returnDate: undefined });
    expect(p.status).toBe("NOT_FEASIBLE");
    expect(task(p, "rabies").status).toBe("BLOCKED");
    expect(p.blockers[0]).toMatchObject({ code: "RABIES_WAIT", leg: "OUTBOUND", earliestDate: "2026-12-07" });
    expect(p.earliestFeasibleArrival).toBe("2026-12-07");
    expect(p.blockers[0].message).toContain("7 Dec 2026");
  });

  it("schedules vaccination early enough when there's time", () => {
    const r = task(plan({ rabies: { status: "NONE" } }), "rabies");
    expect(r.status).toBe("TODO");
    expect(r.window).toEqual({ from: TODAY, to: "2027-02-21" });
    expect(r.service).toBe("RABIES_VACCINATION");
    expect(r.dependsOn).toEqual(["microchip"]);
  });

  it("counts 21 full days after the vaccination day (boundary)", () => {
    const vaxed = { status: "VACCINATED" as const, lastDoseOn: "2026-11-10", lastDoseKind: "PRIMARY" as const };
    expect(task(plan({ rabies: vaxed }, { arrivalDate: "2026-12-02", returnDate: undefined }), "rabies").status).toBe("DONE");
    const early = plan({ rabies: vaxed }, { arrivalDate: "2026-12-01", returnDate: undefined });
    expect(task(early, "rabies").status).toBe("BLOCKED");
    expect(early.earliestFeasibleArrival).toBe("2026-12-02");
  });

  it("follows the rules data, not hard-coded numbers", () => {
    const rules = RULES.map((r) =>
      r.id === "GB-EU-RABIES" ? { ...r, params: { ...r.params, waitFullDays: 30 } } : r,
    );
    const p = evaluateTrip(pet({ rabies: { status: "NONE" } }), trip(), { today: TODAY, rules });
    if (!p.supported) throw new Error();
    expect(task(p, "rabies").window?.to).toBe("2027-02-12");
  });

  it("needs no wait after a booster with unbroken cover", () => {
    const p = plan(
      { rabies: { status: "VACCINATED", lastDoseOn: "2026-11-14", lastDoseKind: "BOOSTER", validUntil: "2029-11-14" } },
      { arrivalDate: "2026-11-20", returnDate: undefined },
    );
    expect(task(p, "rabies").status).toBe("DONE");
    expect(p.blockers).toEqual([]);
  });

  it("never assumes an unknown vaccination is done", () => {
    const unknown = plan({ rabies: { status: "UNKNOWN" } });
    expect(task(unknown, "rabies").status).toBe("VERIFY");
    expect(task(unknown, "rabies").title).toBe("Check rabies vaccination");
    expect(unknown.status).toBe("NEEDS_INFO");

    const noDate = plan({ rabies: { status: "VACCINATED" } });
    expect(task(noDate, "rabies").status).toBe("VERIFY");
    expect(task(noDate, "rabies").title).toBe("Add the rabies vaccination date");
  });

  it("assumes a first vaccination when the dose type is unknown, and says so", () => {
    const r = task(plan({ rabies: { status: "VACCINATED", lastDoseOn: "2026-09-01" } }), "rabies");
    expect(r.status).toBe("DONE");
    expect(r.detail).toContain("assumed this was a first vaccination");
  });

  it("restarts vaccination given before the microchip", () => {
    const noChip = plan({ microchip: { status: "NO" } });
    expect(task(noChip, "microchip").status).toBe("TODO");
    expect(task(noChip, "rabies").status).toBe("TODO");
    expect(noChip.warnings.join(" ")).toContain("before microchipping doesn't count");

    const lateChip = plan({ microchip: { status: "YES", implantedOn: "2026-10-01" } });
    expect(task(lateChip, "rabies").status).toBe("TODO");
    expect(lateChip.warnings.join(" ")).toContain("implanted after the rabies vaccination");
  });

  it("restarts vaccination given before 12 weeks old", () => {
    const p = plan({
      dateOfBirth: "2026-06-01",
      microchip: { status: "YES", implantedOn: "2026-06-15" },
      rabies: { status: "VACCINATED", lastDoseOn: "2026-07-20", lastDoseKind: "PRIMARY" },
    });
    expect(task(p, "rabies").status).toBe("TODO");
    expect(p.warnings.join(" ")).toContain("before Milo was 12 weeks old");
  });

  it("restarts after a lapsed vaccination", () => {
    const p = plan({ rabies: { status: "VACCINATED", lastDoseOn: "2023-09-01", validUntil: "2026-09-01" } });
    expect(task(p, "rabies").status).toBe("TODO");
    expect(p.warnings.join(" ")).toMatch(/expired on 1 Sept? 2026/);
  });

  it("asks for a booster when the vaccine expires before the trip home", () => {
    const p = plan({
      rabies: { status: "VACCINATED", lastDoseOn: "2024-03-20", lastDoseKind: "BOOSTER", validUntil: "2027-03-20" },
    });
    const booster = task(p, "rabies-booster");
    expect(booster.window).toEqual({ from: TODAY, to: "2027-03-20" });
    expect(booster.service).toBe("RABIES_BOOSTER");
    expect(booster.leg).toBe("RETURN");
  });

  it("adds an advisory check when no expiry date is known", () => {
    const p = plan({ rabies: { status: "VACCINATED", lastDoseOn: "2026-09-01", lastDoseKind: "PRIMARY" } });
    expect(task(p, "rabies-validity")).toMatchObject({ status: "INFO", blocking: false });
  });
});

describe("young pets", () => {
  it("combines the 12-week vaccination age, the wait and France's 16-week rule", () => {
    const p = plan(
      { dateOfBirth: "2026-09-01", microchip: { status: "YES", implantedOn: "2026-10-01" }, rabies: { status: "NONE" } },
      { arrivalDate: "2026-12-20", returnDate: undefined },
    );
    expect(task(p, "rabies").window?.from).toBe("2026-11-24"); // 12 weeks old
    expect(task(p, "rabies").status).toBe("TODO"); // vaccinate 24 to 28 Nov, ready by 16 Dec
    expect(task(p, "age-france").status).toBe("BLOCKED");
    expect(p.blockers.map((b) => b.code)).toEqual(["TOO_YOUNG"]);
    expect(p.earliestFeasibleArrival).toBe("2026-12-22");
  });

  it("asks for a date of birth when an age rule applies", () => {
    const p = plan({ dateOfBirth: undefined });
    expect(task(p, "age-france").status).toBe("VERIFY");
    expect(p.status).toBe("NEEDS_INFO");
  });
});

describe("France restricted breeds", () => {
  const dogTo = (breed: string, hasPedigree?: boolean) =>
    plan({ species: "DOG", breed, hasPedigree }, { returnDate: undefined });

  it("blocks Category 1 dogs without a pedigree, with no date that fixes it", () => {
    const p = dogTo("American Staffordshire Terrier", false);
    expect(p.status).toBe("NOT_FEASIBLE");
    expect(p.blockers[0]).toMatchObject({ code: "BREED_BANNED", ruleId: "FR-DOG-CATEGORY" });
    expect(p.blockers[0].earliestDate).toBeUndefined();
    expect(p.earliestFeasibleArrival).toBeUndefined();
  });

  it("asks about the pedigree when unknown, and lists the documents when there is one", () => {
    expect(task(dogTo("Tosa Inu"), "france-breed").status).toBe("VERIFY");
    const ok = task(dogTo("Boerboel", true), "france-breed");
    expect(ok.status).toBe("TODO");
    expect(ok.detail).toContain("muzzled");
  });

  it("always blocks pit bull types and ignores Staffordshire bull terriers", () => {
    expect(dogTo("Pit Bull", true).status).toBe("NOT_FEASIBLE");
    expect(ids(dogTo("Staffordshire Bull Terrier", false))).not.toContain("france-breed");
    expect(ids(dogTo("Labrador"))).not.toContain("france-breed");
    expect(ids(plan({ species: "CAT", breed: "Tosa" }))).not.toContain("france-breed");
  });
});

describe("Great Britain to Ireland", () => {
  const dog = (t: Partial<TripInput> = {}, records?: TaskRecords) =>
    plan({ species: "DOG", breed: "Cockapoo" }, { destination: "IE", ...t }, records);

  it("schedules tapeworm treatment 24 to 120 hours before arrival, after the certificate", () => {
    const tw = task(dog(), "tapeworm-outbound");
    expect(tw.window).toEqual({ from: "2027-03-10", to: "2027-03-14" });
    expect(tw.dependsOn).toEqual(["ahc"]);
    expect(tw.detail).toContain("at least 24 hours and no more than 120 hours");
    expect(task(dog({}, { tapewormOutboundOn: "2027-03-12" }), "tapeworm-outbound").status).toBe("DONE");
    expect(task(dog({}, { tapewormOutboundOn: "2027-03-09" }), "tapeworm-outbound").status).toBe("TODO");
  });

  it("can't arrive today because the treatment needs 24 hours", () => {
    const vaxed = { status: "VACCINATED" as const, lastDoseOn: "2026-01-01", lastDoseKind: "BOOSTER" as const, validUntil: "2029-01-01" };
    const tomorrow = plan({ species: "DOG", rabies: vaxed }, { destination: "IE", arrivalDate: "2026-11-16", returnDate: undefined });
    expect(task(tomorrow, "tapeworm-outbound").status).toBe("TODO");
    const todayTrip = plan({ species: "DOG", rabies: vaxed }, { destination: "IE", arrivalDate: TODAY, returnDate: undefined });
    expect(todayTrip.blockers.map((b) => b.code)).toEqual(["TAPEWORM_WINDOW_PASSED"]);
    expect(todayTrip.earliestFeasibleArrival).toBe("2026-11-16");
  });

  it("only allows approved points of entry", () => {
    expect(task(dog(), "ireland-entry").status).toBe("TODO");
    expect(task(dog({ arrivalAirport: "dub" }), "ireland-entry").status).toBe("DONE");
    const belfast = dog({ arrivalAirport: "BFS" });
    expect(belfast.blockers[0]).toMatchObject({ code: "ENTRY_POINT", ruleId: "IE-ENTRY-POINT" });
    expect(belfast.earliestFeasibleArrival).toBeUndefined();
  });

  it("asks for advance notice", () => {
    expect(task(dog(), "ireland-notice").window).toEqual({ from: TODAY, to: "2027-03-14" });
    expect(task(dog({}, { irelandNoticeGiven: true }), "ireland-notice").status).toBe("DONE");
  });

  it("needs no return tapeworm treatment or approved route from Ireland", () => {
    const p = dog();
    expect(ids(p)).not.toContain("tapeworm-return");
    expect(ids(p)).not.toContain("return-approved-route");
    expect(p.warnings.join(" ")).toContain("No tapeworm treatment is needed to return");
  });

  it("does not ask cats for tapeworm treatment", () => {
    expect(ids(plan({}, { destination: "IE" }))).not.toContain("tapeworm-outbound");
  });
});

describe("Great Britain to the United States", () => {
  const usDog = (p: Partial<PetInput> = {}, t: Partial<TripInput> = {}, r?: TaskRecords) =>
    plan({ species: "DOG", breed: "Beagle", ...p }, { destination: "US", ...t }, r);

  it("needs the CDC form and microchip for dogs, with no rabies requirement on the way out", () => {
    const p = usDog({}, { returnDate: undefined });
    expect(ids(p)).toEqual(expect.arrayContaining(["microchip", "cdc-form", "age-usa", "us-healthy"]));
    expect(ids(p)).not.toContain("rabies");
    expect(ids(p)).not.toContain("ahc");
    expect(task(p, "cdc-form").window).toEqual({ from: TODAY, to: "2027-03-15" });
  });

  it("opens the CDC form window 6 months before arrival", () => {
    const p = usDog({}, { arrivalDate: "2027-09-15", returnDate: undefined });
    expect(task(p, "cdc-form").window).toEqual({ from: "2027-03-15", to: "2027-09-15" });
    expect(task(usDog({}, { returnDate: undefined }, { cdcFormSubmittedOn: "2027-03-10" }), "cdc-form").status).toBe("DONE");
  });

  it("blocks dogs under 6 months old", () => {
    const p = usDog({ dateOfBirth: "2026-10-01" }, { arrivalDate: "2027-02-01", returnDate: undefined });
    expect(p.blockers[0]).toMatchObject({ code: "TOO_YOUNG", earliestDate: "2027-04-01" });
  });

  it("needs rabies, a GB pet health certificate abroad and an approved route to come home", () => {
    const p = usDog({ rabies: { status: "NONE" } });
    const rabies = task(p, "rabies");
    expect(rabies.leg).toBe("RETURN");
    expect(rabies.window?.to).toBe("2027-03-07");
    expect(rabies.detail).toContain("Great Britain does when you come home");
    const cert = task(p, "return-certificate");
    expect(cert.window).toEqual({ from: "2027-03-20", to: "2027-03-29" });
    expect(cert).toMatchObject({ abroad: true, officialVet: true, service: "GB_PET_HEALTH_CERTIFICATE" });
    expect(ids(p)).toEqual(expect.arrayContaining(["tapeworm-return", "return-approved-route"]));
  });

  it("reports a return-only blocker separately from the arrival date", () => {
    const p = usDog(
      { rabies: { status: "NONE" } },
      { arrivalDate: "2026-11-20", returnDate: "2026-11-30" },
    );
    expect(p.blockers.map((b) => [b.code, b.leg])).toEqual([["RABIES_WAIT", "RETURN"]]);
    expect(p.earliestFeasibleArrival).toBeUndefined();
    expect(p.earliestFeasibleReturn).toBe("2026-12-07");
  });

  it("gives cats advisory checks only, and flags the unconfirmed export certificate", () => {
    const p = plan({}, { destination: "US", returnDate: undefined });
    expect(task(p, "us-cat")).toMatchObject({ status: "INFO", blocking: false });
    expect(task(p, "export-certificate-check")).toMatchObject({ status: "INFO", blocking: false });
    expect(p.rules.find((r) => r.id === "GB-EXPORT-NON-EU")!.reviewStatus).toBe("NEEDS_REVIEW");
    expect(p.status).toBe("READY");
  });
});

describe("returning from the EU after a long stay", () => {
  it("moves the certificate later so it still covers the return", () => {
    const p = plan({}, { returnDate: "2027-09-12" });
    expect(task(p, "ahc").window).toEqual({ from: "2027-03-12", to: "2027-03-15" });
    expect(task(p, "ahc").detail).toContain("get it on or after 12 Mar 2027");
    expect(ids(p)).toContain("return-document");
  });

  it("needs a GB pet health certificate abroad when the stay is over 6 months", () => {
    const p = plan({}, { returnDate: "2027-10-01" });
    expect(ids(p)).not.toContain("return-document");
    expect(task(p, "return-certificate")).toMatchObject({ abroad: true, window: { from: "2027-09-22", to: "2027-10-01" } });
  });
});

describe("dates and general behaviour", () => {
  it("blocks an arrival date in the past", () => {
    const p = plan({}, { arrivalDate: "2026-11-01", returnDate: undefined });
    expect(p.blockers[0]).toMatchObject({ code: "DATE_IN_PAST", earliestDate: TODAY });
  });

  it("recomputes when the departure date changes", () => {
    const early = plan({ rabies: { status: "NONE" } }, { arrivalDate: "2026-12-01", returnDate: undefined });
    const late = plan({ rabies: { status: "NONE" } }, { arrivalDate: "2027-01-10", returnDate: undefined });
    expect(early.status).toBe("NOT_FEASIBLE");
    expect(late.status).toBe("IN_PROGRESS");
    expect(task(late, "rabies").window?.to).toBe("2026-12-19");
  });

  it("asks for a return date when there isn't one", () => {
    expect(plan({}, { returnDate: undefined }).warnings[0]).toContain("No return date yet");
  });

  it("covers an authorised person travelling with the pet", () => {
    expect(task(plan({}, { accompaniment: "AUTHORISED_PERSON" }), "authorised-person").detail).toContain("within 5 days");
  });

  it("is deterministic and doesn't change its inputs", () => {
    const p1 = pet({ species: "DOG", breed: "Beagle" });
    const t1 = trip({ destination: "IE" });
    const before = JSON.stringify([p1, t1]);
    const a = evaluateTrip(p1, t1, { today: TODAY });
    const b = evaluateTrip(p1, t1, { today: TODAY });
    expect(a).toEqual(b);
    expect(JSON.stringify([p1, t1])).toBe(before);
  });

  it("never marks advisory tasks as blocking or vice versa", () => {
    for (const p of [plan(), plan({ species: "DOG" }, { destination: "US" }), plan({ species: "DOG" }, { destination: "IE" })]) {
      for (const t of p.tasks) expect(t.blocking, t.id).toBe(t.status !== "INFO");
    }
  });
});
